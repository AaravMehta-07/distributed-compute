/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ═══════════════════════════════════════════════════════════════
 *  FEDERATED LEARNING ENGINE — Distributed LoRA Finetuning
 *  Simulates privacy-preserving distributed model training
 *  via gradient exchange over WebRTC
 * ═══════════════════════════════════════════════════════════════
 */

import { FederatedTaskMeta } from '../types/network';

export const FL_CONFIG = {
  defaultEpochs: 10,
  defaultLearningRate: 0.001,
  defaultBatchSize: 32,
  weightsSize: 4096, // Simulated weight vector size
  loraRank: 8,
};

/**
 * Generates simulated base model weights
 */
export function generateBaseWeights(size: number = FL_CONFIG.weightsSize): ArrayBuffer {
  const buffer = new ArrayBuffer(size * 4);
  const weights = new Float32Array(buffer);
  // Xavier initialization
  const scale = Math.sqrt(2.0 / size);
  for (let i = 0; i < size; i++) {
    weights[i] = (Math.random() - 0.5) * 2.0 * scale;
  }
  return buffer;
}

/**
 * Generates a simulated training data shard
 */
export function generateTrainingBatch(
  shardIndex: number,
  batchSize: number
): { inputs: Float32Array; labels: Float32Array } {
  const featureSize = 64;
  const inputs = new Float32Array(batchSize * featureSize);
  const labels = new Float32Array(batchSize);

  // Deterministic per-shard data
  let rng = shardIndex * 7919 + 42;
  for (let b = 0; b < batchSize; b++) {
    let sum = 0;
    for (let f = 0; f < featureSize; f++) {
      rng = (rng * 1664525 + 1013904223) & 0xFFFFFFFF;
      const val = ((rng >>> 0) / 0xFFFFFFFF) - 0.5;
      inputs[b * featureSize + f] = val;
      sum += val * ((f + shardIndex) % 7 - 3) * 0.1;
    }
    labels[b] = 1.0 / (1.0 + Math.exp(-sum)); // Sigmoid target
  }

  return { inputs, labels };
}

/**
 * Computes local gradients via simulated forward+backward pass
 * Runs on WebGPU or WASM SIMD
 */
export async function computeGradients(
  weightsBuffer: ArrayBuffer,
  shardIndex: number,
  batchSize: number,
  learningRate: number,
  engine: 'WEBGPU' | 'WASM_SIMD'
): Promise<{ gradientBuffer: ArrayBuffer; loss: number }> {
  const weights = new Float32Array(weightsBuffer);
  const size = weights.length;
  const gradients = new Float32Array(size);
  const startTime = performance.now();

  const { inputs, labels } = generateTrainingBatch(shardIndex, batchSize);
  const featureSize = 64;
  let totalLoss = 0;

  if (engine === 'WEBGPU' && typeof window !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();

        const shaderCode = `
          @group(0) @binding(0) var<storage, read> weights: array<f32>;
          @group(0) @binding(1) var<storage, read_write> grads: array<f32>;

          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let idx = gid.x;
            if (idx >= arrayLength(&weights)) { return; }
            let w = weights[idx];
            // Simulated gradient: L2 regularization + noise
            let grad = w * 0.01 + sin(f32(idx) * 0.001) * 0.001;
            grads[idx] = grad;
          }
        `;

        const shaderMod = device.createShaderModule({ code: shaderCode });
        const bufW = device.createBuffer({ size: weights.byteLength, usage: GPUBufferUsage.STORAGE, mappedAtCreation: true });
        new Float32Array(bufW.getMappedRange()).set(weights);
        bufW.unmap();

        const bufG = device.createBuffer({ size: weights.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

        const layout = device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
          ],
        });

        const bg = device.createBindGroup({
          layout,
          entries: [
            { binding: 0, resource: { buffer: bufW } },
            { binding: 1, resource: { buffer: bufG } },
          ],
        });

        const pipeline = device.createComputePipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
          compute: { module: shaderMod, entryPoint: 'main' },
        });

        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(size / 64));
        pass.end();

        const readBuf = device.createBuffer({ size: weights.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        enc.copyBufferToBuffer(bufG, 0, readBuf, 0, weights.byteLength);
        device.queue.submit([enc.finish()]);

        await readBuf.mapAsync(GPUMapMode.READ);
        gradients.set(new Float32Array(readBuf.getMappedRange()));

        readBuf.destroy();
        bufW.destroy();
        bufG.destroy();
        device.destroy();

        // Compute simulated loss
        for (let b = 0; b < batchSize; b++) {
          let pred = 0;
          for (let f = 0; f < Math.min(featureSize, size); f++) {
            pred += weights[f] * inputs[b * featureSize + f];
          }
          pred = 1.0 / (1.0 + Math.exp(-pred));
          const err = labels[b] - pred;
          totalLoss += err * err;
        }
        totalLoss /= batchSize;

        return { gradientBuffer: gradients.buffer, loss: totalLoss };
      }
    } catch (err) {
      console.warn('[FederatedLearning] WebGPU gradient computation failed:', err);
    }
  }

  // CPU fallback: simulated SGD
  for (let b = 0; b < batchSize; b++) {
    let pred = 0;
    for (let f = 0; f < Math.min(featureSize, size); f++) {
      pred += weights[f] * inputs[b * featureSize + f];
    }
    pred = 1.0 / (1.0 + Math.exp(-pred));
    const err = labels[b] - pred;
    totalLoss += err * err;

    // Accumulate gradient
    for (let f = 0; f < Math.min(featureSize, size); f++) {
      gradients[f] += -2 * err * (pred * (1 - pred)) * inputs[b * featureSize + f] / batchSize;
    }
  }
  totalLoss /= batchSize;

  // L2 regularization
  for (let i = 0; i < size; i++) {
    gradients[i] += weights[i] * 0.001;
  }

  // Realistic latency
  const elapsed = performance.now() - startTime;
  if (elapsed < 50) await new Promise(r => setTimeout(r, 50 - elapsed));

  return { gradientBuffer: gradients.buffer, loss: totalLoss };
}

/**
 * Aggregates gradients from multiple workers using FedAvg
 */
export function aggregateGradients(
  gradientBuffers: ArrayBuffer[],
  baseWeightsBuffer: ArrayBuffer,
  learningRate: number
): { updatedWeights: ArrayBuffer; avgLoss: number } {
  if (gradientBuffers.length === 0) {
    return { updatedWeights: baseWeightsBuffer.slice(0), avgLoss: 0 };
  }

  const baseWeights = new Float32Array(baseWeightsBuffer);
  const size = baseWeights.length;
  const updated = new Float32Array(size);
  const avgGrad = new Float32Array(size);

  // Average all gradients (FedAvg)
  for (const buf of gradientBuffers) {
    const grad = new Float32Array(buf);
    for (let i = 0; i < Math.min(size, grad.length); i++) {
      avgGrad[i] += grad[i] / gradientBuffers.length;
    }
  }

  // Apply gradient descent step
  for (let i = 0; i < size; i++) {
    updated[i] = baseWeights[i] - learningRate * avgGrad[i];
  }

  // Compute simulated average loss from gradient magnitudes
  let gradMag = 0;
  for (let i = 0; i < size; i++) {
    gradMag += avgGrad[i] * avgGrad[i];
  }
  const avgLoss = Math.sqrt(gradMag / size);

  return { updatedWeights: updated.buffer, avgLoss };
}
