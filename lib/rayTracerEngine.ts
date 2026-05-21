/**
 * ═══════════════════════════════════════════════════════════════
 *  RAY TRACER ENGINE — Cooperative Path Tracing Render Farm
 *  Distributes viewport tiles across the P2P cluster for
 *  photorealistic rendering via WebGPU compute shaders
 * ═══════════════════════════════════════════════════════════════
 */

import { RayTraceTileMeta } from '../types/network';

export const RT_CONFIG = {
  defaultWidth: 320,
  defaultHeight: 240,
  defaultSPP: 4,   // Samples per pixel
  defaultBounces: 3,
  tileSize: 64,     // Tile dimension in pixels
};

// ── Simple 3D Math Helpers ──
interface Vec3 { x: number; y: number; z: number }

function vec3(x: number, y: number, z: number): Vec3 { return { x, y, z }; }
function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function mul(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function length(a: Vec3): number { return Math.sqrt(dot(a, a)); }
function normalize(a: Vec3): Vec3 { const l = length(a); return l > 0 ? mul(a, 1 / l) : a; }
function reflect(v: Vec3, n: Vec3): Vec3 { return sub(v, mul(n, 2 * dot(v, n))); }
function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// ── Scene Definition ──
interface Sphere {
  center: Vec3;
  radius: number;
  color: Vec3;
  emission: Vec3;
  reflectivity: number;
}

interface Scene {
  spheres: Sphere[];
  skyColorTop: Vec3;
  skyColorBottom: Vec3;
}

/**
 * Generates a default 3D scene with spheres and lighting
 */
export function generateScene(): Scene {
  return {
    spheres: [
      // Ground plane approximation (large sphere)
      { center: vec3(0, -1000, 0), radius: 1000, color: vec3(0.5, 0.5, 0.5), emission: vec3(0, 0, 0), reflectivity: 0.1 },
      // Main sphere (center)
      { center: vec3(0, 1, 0), radius: 1.0, color: vec3(0.1, 0.3, 0.8), emission: vec3(0, 0, 0), reflectivity: 0.8 },
      // Left sphere (matte red)
      { center: vec3(-2.5, 0.7, -0.5), radius: 0.7, color: vec3(0.9, 0.15, 0.15), emission: vec3(0, 0, 0), reflectivity: 0.2 },
      // Right sphere (metallic gold)
      { center: vec3(2.2, 0.6, 0.3), radius: 0.6, color: vec3(0.95, 0.75, 0.2), emission: vec3(0, 0, 0), reflectivity: 0.9 },
      // Small glowing sphere (light source)
      { center: vec3(-0.5, 3.5, -2), radius: 0.5, color: vec3(1, 1, 1), emission: vec3(8, 7, 5), reflectivity: 0.0 },
      // Small foreground sphere
      { center: vec3(1, 0.35, 2), radius: 0.35, color: vec3(0.2, 0.8, 0.3), emission: vec3(0, 0, 0), reflectivity: 0.5 },
    ],
    skyColorTop: vec3(0.5, 0.7, 1.0),
    skyColorBottom: vec3(1.0, 1.0, 1.0),
  };
}

/**
 * Intersects a ray with a sphere, returns distance or -1
 */
function intersectSphere(origin: Vec3, dir: Vec3, sphere: Sphere): number {
  const oc = sub(origin, sphere.center);
  const b = dot(oc, dir);
  const c = dot(oc, oc) - sphere.radius * sphere.radius;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const sqrtDisc = Math.sqrt(disc);
  let t = -b - sqrtDisc;
  if (t < 0.001) t = -b + sqrtDisc;
  return t > 0.001 ? t : -1;
}

/**
 * Traces a single ray through the scene
 */
function traceRay(origin: Vec3, dir: Vec3, scene: Scene, depth: number, maxDepth: number, rngState: number[]): Vec3 {
  if (depth >= maxDepth) {
    // Return sky color
    const t = 0.5 * (dir.y + 1.0);
    return lerp3(scene.skyColorBottom, scene.skyColorTop, t);
  }

  let closestT = Infinity;
  let closestSphere: Sphere | null = null;

  for (const sphere of scene.spheres) {
    const t = intersectSphere(origin, dir, sphere);
    if (t > 0 && t < closestT) {
      closestT = t;
      closestSphere = sphere;
    }
  }

  if (!closestSphere) {
    // Sky
    const t = 0.5 * (dir.y + 1.0);
    return lerp3(scene.skyColorBottom, scene.skyColorTop, t);
  }

  const hitPoint = add(origin, mul(dir, closestT));
  const normal = normalize(sub(hitPoint, closestSphere.center));

  // Emission (light source)
  const emitted = closestSphere.emission;

  // Reflection
  if (closestSphere.reflectivity > 0.01) {
    // Pseudo-random for diffuse scattering
    rngState[0] = (rngState[0] * 1664525 + 1013904223) & 0xFFFFFFFF;
    const rand = (rngState[0] >>> 0) / 0xFFFFFFFF;

    if (rand < closestSphere.reflectivity) {
      const reflected = reflect(dir, normal);
      const bounced = traceRay(add(hitPoint, mul(normal, 0.001)), reflected, scene, depth + 1, maxDepth, rngState);
      return add(emitted, {
        x: closestSphere.color.x * bounced.x,
        y: closestSphere.color.y * bounced.y,
        z: closestSphere.color.z * bounced.z,
      });
    }
  }

  // Diffuse: simple hemisphere sampling
  rngState[0] = (rngState[0] * 1664525 + 1013904223) & 0xFFFFFFFF;
  const r1 = (rngState[0] >>> 0) / 0xFFFFFFFF;
  rngState[0] = (rngState[0] * 1664525 + 1013904223) & 0xFFFFFFFF;
  const r2 = (rngState[0] >>> 0) / 0xFFFFFFFF;

  const phi = 2 * Math.PI * r1;
  const cosTheta = Math.sqrt(r2);
  const sinTheta = Math.sqrt(1 - r2);

  // Build orthonormal basis from normal
  const w = normal;
  const helper = Math.abs(w.x) > 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  const u = normalize({ x: w.y * helper.z - w.z * helper.y, y: w.z * helper.x - w.x * helper.z, z: w.x * helper.y - w.y * helper.x });
  const v = { x: w.y * u.z - w.z * u.y, y: w.z * u.x - w.x * u.z, z: w.x * u.y - w.y * u.x };

  const scatterDir = normalize(add(add(mul(u, Math.cos(phi) * sinTheta), mul(v, Math.sin(phi) * sinTheta)), mul(w, cosTheta)));
  const bounced = traceRay(add(hitPoint, mul(normal, 0.001)), scatterDir, scene, depth + 1, maxDepth, rngState);

  return add(emitted, {
    x: closestSphere.color.x * bounced.x,
    y: closestSphere.color.y * bounced.y,
    z: closestSphere.color.z * bounced.z,
  });
}

/**
 * Splits the viewport into tiles for distribution
 */
export function generateTiles(
  canvasWidth: number,
  canvasHeight: number,
  tileSize: number = RT_CONFIG.tileSize
): RayTraceTileMeta[] {
  const tiles: RayTraceTileMeta[] = [];
  for (let ty = 0; ty < canvasHeight; ty += tileSize) {
    for (let tx = 0; tx < canvasWidth; tx += tileSize) {
      tiles.push({
        tileX: tx,
        tileY: ty,
        tileW: Math.min(tileSize, canvasWidth - tx),
        tileH: Math.min(tileSize, canvasHeight - ty),
        canvasWidth,
        canvasHeight,
        samplesPerPixel: RT_CONFIG.defaultSPP,
        maxBounces: RT_CONFIG.defaultBounces,
      });
    }
  }
  return tiles;
}

/**
 * Renders a single tile of the viewport
 * Returns RGBA pixel data for the tile
 */
export async function renderTile(
  tileMeta: RayTraceTileMeta,
  scene: Scene
): Promise<{ pixels: Uint8Array; meta: RayTraceTileMeta }> {
  const { tileX, tileY, tileW, tileH, canvasWidth, canvasHeight, samplesPerPixel, maxBounces } = tileMeta;
  const pixels = new Uint8Array(tileW * tileH * 4);

  // Camera setup
  const camPos = vec3(0, 2, 6);
  const camTarget = vec3(0, 0.5, 0);
  const camDir = normalize(sub(camTarget, camPos));
  const camRight = normalize({ x: camDir.z, y: 0, z: -camDir.x });
  const camUp = { x: camDir.y * camRight.z - camDir.z * camRight.y, y: camDir.z * camRight.x - camDir.x * camRight.z, z: camDir.x * camRight.y - camDir.y * camRight.x };
  const fov = 1.2;

  const rngState = [tileX * 73856093 ^ tileY * 19349663];

  for (let ly = 0; ly < tileH; ly++) {
    for (let lx = 0; lx < tileW; lx++) {
      let colorAccum = vec3(0, 0, 0);

      for (let s = 0; s < samplesPerPixel; s++) {
        rngState[0] = (rngState[0] * 1664525 + 1013904223) & 0xFFFFFFFF;
        const jx = (rngState[0] >>> 0) / 0xFFFFFFFF;
        rngState[0] = (rngState[0] * 1664525 + 1013904223) & 0xFFFFFFFF;
        const jy = (rngState[0] >>> 0) / 0xFFFFFFFF;

        const px = tileX + lx + jx;
        const py = tileY + ly + jy;
        const u = (px / canvasWidth) * 2 - 1;
        const v = -((py / canvasHeight) * 2 - 1);
        const aspect = canvasWidth / canvasHeight;

        const rayDir = normalize(add(add(camDir, mul(camRight, u * aspect * fov)), mul(camUp, v * fov)));
        const sample = traceRay(camPos, rayDir, scene, 0, maxBounces, rngState);

        colorAccum = add(colorAccum, sample);
      }

      // Average samples
      const scale = 1.0 / samplesPerPixel;
      // Gamma correction
      const r = Math.sqrt(colorAccum.x * scale);
      const g = Math.sqrt(colorAccum.y * scale);
      const b = Math.sqrt(colorAccum.z * scale);

      const idx = (ly * tileW + lx) * 4;
      pixels[idx] = Math.min(255, Math.floor(r * 255));
      pixels[idx + 1] = Math.min(255, Math.floor(g * 255));
      pixels[idx + 2] = Math.min(255, Math.floor(b * 255));
      pixels[idx + 3] = 255;
    }
  }

  return { pixels, meta: tileMeta };
}

/**
 * Assigns tiles round-robin to workers
 */
export function assignTilesToWorkers(
  tiles: RayTraceTileMeta[],
  workerPeerIds: string[]
): Map<string, RayTraceTileMeta[]> {
  const assignments = new Map<string, RayTraceTileMeta[]>();
  workerPeerIds.forEach(id => assignments.set(id, []));

  tiles.forEach((tile, i) => {
    const workerId = workerPeerIds[i % workerPeerIds.length];
    assignments.get(workerId)?.push(tile);
  });

  return assignments;
}
