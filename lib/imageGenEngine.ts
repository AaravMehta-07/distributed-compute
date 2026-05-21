/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ═══════════════════════════════════════════════════════════════
 *  IMAGE GENERATION ENGINE — Distributed Stable Diffusion Pipeline
 *  Simulates sharded U-Net denoising across WebRTC-connected nodes
 * ═══════════════════════════════════════════════════════════════
 */

import { ImageGenTaskMeta } from '../types/network';

// Default diffusion parameters
export const DIFFUSION_CONFIG = {
  defaultSteps: 20,
  defaultWidth: 256,
  defaultHeight: 256,
  latentChannels: 4,
  latentScale: 8, // Latent grid is 1/8 of pixel space
  guidanceScale: 7.5,
};

/**
 * Prepares the initial latent noise grid for diffusion
 */
export function prepareLatentGrid(
  width: number,
  height: number,
  seed: number
): { buffer: ArrayBuffer; dimensions: number[] } {
  const latentW = Math.floor(width / DIFFUSION_CONFIG.latentScale);
  const latentH = Math.floor(height / DIFFUSION_CONFIG.latentScale);
  const channels = DIFFUSION_CONFIG.latentChannels;
  const size = latentW * latentH * channels;

  const buffer = new ArrayBuffer(size * 4);
  const arr = new Float32Array(buffer);

  // Seeded pseudo-random noise (deterministic for reproducibility)
  let rng = seed;
  for (let i = 0; i < size; i++) {
    rng = (rng * 1664525 + 1013904223) & 0xFFFFFFFF;
    // Box-Muller approximation for Gaussian noise
    const u1 = ((rng >>> 0) / 0xFFFFFFFF);
    rng = (rng * 1664525 + 1013904223) & 0xFFFFFFFF;
    const u2 = ((rng >>> 0) / 0xFFFFFFFF);
    arr[i] = Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
  }

  return { buffer, dimensions: [1, channels, latentH, latentW] };
}

/**
 * Executes a single U-Net denoising step on a latent grid
 * Runs on WebGPU compute shaders or WASM SIMD fallback
 */
export async function executeDenoiseStep(
  latentBuffer: ArrayBuffer,
  dimensions: number[],
  currentStep: number,
  totalSteps: number,
  engine: 'WEBGPU' | 'WASM_SIMD'
): Promise<ArrayBuffer> {
  const size = dimensions.reduce((a, b) => a * b, 1);
  const input = new Float32Array(latentBuffer);
  const output = new Float32Array(size);

  const timestep = 1.0 - (currentStep / totalSteps);
  const noiseScale = timestep * 0.15;
  const startTime = performance.now();

  if (engine === 'WEBGPU' && typeof window !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const device = await adapter.requestDevice();

        const shaderCode = `
          @group(0) @binding(0) var<storage, read> input: array<f32>;
          @group(0) @binding(1) var<storage, read_write> output: array<f32>;
          @group(0) @binding(2) var<uniform> params: vec4<f32>;

          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let idx = gid.x;
            if (idx >= arrayLength(&input)) { return; }
            let val = input[idx];
            let t = params.x;
            let noise = params.y;
            // Simulated U-Net: predict noise and subtract
            let predicted = val * (1.0 - t) + sin(val * 3.14159) * noise;
            output[idx] = val - predicted * t * 0.5;
          }
        `;

        const shaderModule = device.createShaderModule({ code: shaderCode });

        const bufIn = device.createBuffer({
          size: input.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
          mappedAtCreation: true,
        });
        new Float32Array(bufIn.getMappedRange()).set(input);
        bufIn.unmap();

        const bufOut = device.createBuffer({
          size: input.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        const paramData = new Float32Array([timestep, noiseScale, 0, 0]);
        const bufParams = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        new Float32Array(bufParams.getMappedRange()).set(paramData);
        bufParams.unmap();

        const layout = device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            { binding: 0, resource: { buffer: bufIn } },
            { binding: 1, resource: { buffer: bufOut } },
            { binding: 2, resource: { buffer: bufParams } },
          ],
        });

        const pipeline = device.createComputePipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
          compute: { module: shaderModule, entryPoint: 'main' },
        });

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(size / 64));
        pass.end();

        const readBuf = device.createBuffer({
          size: input.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        encoder.copyBufferToBuffer(bufOut, 0, readBuf, 0, input.byteLength);
        device.queue.submit([encoder.finish()]);

        await readBuf.mapAsync(GPUMapMode.READ);
        output.set(new Float32Array(readBuf.getMappedRange()));

        readBuf.destroy();
        bufIn.destroy();
        bufOut.destroy();
        bufParams.destroy();
        device.destroy();

        return output.buffer;
      }
    } catch (err) {
      console.warn('[ImageGen] WebGPU denoise failed, falling back to WASM:', err);
    }
  }

  // WASM SIMD / CPU fallback
  for (let i = 0; i < size; i++) {
    const val = input[i];
    const predicted = val * (1.0 - timestep) + Math.sin(val * Math.PI) * noiseScale;
    output[i] = val - predicted * timestep * 0.5;
  }

  // Simulate realistic GPU latency
  const elapsed = performance.now() - startTime;
  const targetMs = 40;
  if (elapsed < targetMs) {
    await new Promise(r => setTimeout(r, targetMs - elapsed));
  }

  return output.buffer;
}

/**
 * Decodes a latent grid into RGBA pixel data (VAE decoder simulation)
 */
export function decodeLatentToPixels(
  latentBuffer: ArrayBuffer,
  width: number,
  height: number
): ImageData {
  const latentW = Math.floor(width / DIFFUSION_CONFIG.latentScale);
  const latentH = Math.floor(height / DIFFUSION_CONFIG.latentScale);
  const channels = DIFFUSION_CONFIG.latentChannels;
  const latent = new Float32Array(latentBuffer);

  const imageData = new ImageData(width, height);
  const pixels = imageData.data;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const lx = Math.floor((px / width) * latentW);
      const ly = Math.floor((py / height) * latentH);
      const baseIdx = (ly * latentW + lx) * channels;

      // Map 4 latent channels to RGB using simple decode
      const r = Math.tanh(latent[baseIdx] || 0) * 0.5 + 0.5;
      const g = Math.tanh(latent[baseIdx + 1] || 0) * 0.5 + 0.5;
      const b = Math.tanh(latent[baseIdx + 2] || 0) * 0.5 + 0.5;

      const idx = (py * width + px) * 4;
      pixels[idx] = Math.floor(r * 255);
      pixels[idx + 1] = Math.floor(g * 255);
      pixels[idx + 2] = Math.floor(b * 255);
      pixels[idx + 3] = 255;
    }
  }

  return imageData;
}

/**
 * Assigns denoising steps to workers
 */
export function assignDenoiseSteps(
  totalSteps: number,
  workerCount: number
): Map<number, [number, number]> {
  const assignment = new Map<number, [number, number]>();
  if (workerCount === 0) return assignment;

  const stepsPerWorker = Math.max(1, Math.floor(totalSteps / workerCount));
  let current = 0;

  for (let i = 0; i < workerCount; i++) {
    const end = i === workerCount - 1 ? totalSteps - 1 : Math.min(current + stepsPerWorker - 1, totalSteps - 1);
    assignment.set(i, [current, end]);
    current = end + 1;
  }

  return assignment;
}
