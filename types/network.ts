// ═══════════════════════════════════════════════════════════════
//  NEXUSCOMPUTE — GLOBAL TYPE DEFINITIONS
//  All network messages passed over WebRTC Data Channels
// ═══════════════════════════════════════════════════════════════

// --- TASK MODE ENUM ---
export type TaskMode =
  | 'llm'
  | 'image_gen'
  | 'federated_learning'
  | 'video_transcode'
  | 'vector_search'
  | 'ray_tracing'
  | 'custom_job';

// --- NETWORK MESSAGE DISCRIMINATING UNION ---
export type NetworkMessageType =
  | 'HEARTBEAT'
  | 'TENSOR_PAYLOAD'
  | 'NODE_DISCONNECT'
  | 'COMPUTE_TASK'
  | 'TASK_RESULT'
  | 'PROFILE_REPORT';

export type NetworkMessage =
  | { type: 'HEARTBEAT'; peerId: string; timestamp: number }
  | { type: 'TENSOR_PAYLOAD'; payload: TensorPayload }
  | { type: 'NODE_DISCONNECT'; peerId: string }
  | { type: 'COMPUTE_TASK'; task: ComputeTask }
  | { type: 'TASK_RESULT'; result: TaskResult }
  | { type: 'PROFILE_REPORT'; profile: HardwareProfile };

// --- TENSOR PAYLOAD ---
export interface TensorPayload {
  taskId: string;
  layerRange: [number, number];
  dimensions: number[];
  dataType: 'float32' | 'float16' | 'int4';
  tensorBuffer: ArrayBuffer;
}

// --- HARDWARE PROFILE ---
export interface HardwareProfile {
  peerId: string;
  engine: 'WEBGPU' | 'WASM_SIMD';
  maxBufferSize: number;
  flops: number;
  memoryBandwidthMBs: number;
  timestamp: number;
  deviceModel: string;
  isMobile: boolean;
  gpuVendor?: 'NVIDIA' | 'AMD' | 'Intel' | 'Apple' | 'Qualcomm' | 'ARM' | 'Unknown';
  acceleratorType?: 'discrete_gpu' | 'integrated_gpu' | 'npu' | 'cpu_only';
}

// --- COMPUTE TASK (Extended with all modes) ---
export interface ComputeTask {
  taskId: string;
  type:
    | 'MATRIX_MULTIPLY'
    | 'TRANSFORMER_FORWARD'
    | 'MAP_REDUCE'
    | 'IMAGE_DENOISE_STEP'
    | 'FEDERATED_GRADIENT'
    | 'VIDEO_TRANSCODE_CHUNK'
    | 'VECTOR_SEARCH_QUERY'
    | 'RAYTRACE_TILE'
    | 'CUSTOM_JOB_EXECUTE';
  layerRange?: [number, number];
  inputData: ArrayBuffer;
  dimensions: number[];
  redundantPeerId?: string;
  timestamp: number;

  // Mode-specific metadata (only populated for relevant task types)
  imageGenMeta?: ImageGenTaskMeta;
  federatedMeta?: FederatedTaskMeta;
  videoMeta?: VideoChunkMeta;
  vectorSearchMeta?: VectorSearchMeta;
  rayTraceMeta?: RayTraceTileMeta;
  customJobMeta?: CustomJobMeta;
}

// --- TASK RESULT ---
export interface TaskResult {
  taskId: string;
  peerId: string;
  outputData: ArrayBuffer;
  dimensions: number[];
  executionTimeMs: number;
  timestamp: number;
  // Mode-specific result metadata
  resultType?: ComputeTask['type'];
  rayTraceMeta?: { tileX: number; tileY: number; tileW: number; tileH: number };
  vectorSearchMeta?: { matches: VectorSearchMatch[] };
  federatedMeta?: { epoch: number; loss: number };
  videoMeta?: { chunkIndex: number; totalChunks: number };
  imageGenMeta?: { step: number; totalSteps: number };
  customJobMeta?: { output: string; error?: string; executionMs: number; chunkIndex: number };
}

// --- NETWORK NODE ---
export interface NetworkNode {
  peerId: string;
  profile: HardwareProfile;
  lastSeen: number;
  status: 'IDLE' | 'COMPUTING' | 'DISCONNECTED';
  assignedLayers?: [number, number];
}

// --- MODEL CONFIG ---
export interface ModelConfig {
  name: string;
  totalLayers: number;
  hiddenSize: number;
  vocabSize: number;
}

// ═══════════════════════════════════════════════════════════════
//  MODE-SPECIFIC METADATA INTERFACES
// ═══════════════════════════════════════════════════════════════

// --- IMAGE GENERATION (Stable Diffusion) ---
export interface ImageGenTaskMeta {
  prompt: string;
  seed: number;
  width: number;
  height: number;
  currentStep: number;
  totalSteps: number;
  guidanceScale: number;
}

// --- FEDERATED LEARNING ---
export interface FederatedTaskMeta {
  epoch: number;
  totalEpochs: number;
  learningRate: number;
  batchSize: number;
  datasetShardIndex: number;
}

// --- VIDEO TRANSCODE ---
export interface VideoChunkMeta {
  chunkIndex: number;
  totalChunks: number;
  frameStart: number;
  frameEnd: number;
  filterType: 'blur' | 'sharpen' | 'color_grade' | 'grayscale' | 'edge_detect';
  resolution: { width: number; height: number };
}

// --- VECTOR SEARCH ---
export interface VectorSearchMeta {
  queryText: string;
  topK: number;
  shardIndex: number;
  totalShards: number;
  embeddingDim: number;
}

export interface VectorSearchMatch {
  documentId: string;
  documentText: string;
  similarity: number;
  shardOrigin: string;
}

// --- RAY TRACING ---
export interface RayTraceTileMeta {
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  canvasWidth: number;
  canvasHeight: number;
  samplesPerPixel: number;
  maxBounces: number;
}

// --- CUSTOM JOB ---
export type CustomJobLanguage = 'javascript' | 'python' | 'wasm';

export interface CustomJobMeta {
  language: CustomJobLanguage;
  code: string;              // Source code (JS or Python)
  wasmBinaryB64?: string;    // Base64-encoded .wasm binary (for WASM mode)
  wasmEntryFn?: string;      // Export function name to call in the WASM module
  inputPayload: string;      // JSON-serialized input data
  chunkIndex: number;        // Which chunk this worker processes
  totalChunks: number;       // Total chunks across the mesh
  timeoutMs: number;         // Max execution time before kill
  projectFiles?: Record<string, string>; // Maps file relative paths to text content
  mainEntrypoint?: string;               // Main entrypoint file path
  envParams?: Record<string, string>;    // Custom execution environment parameters
}
