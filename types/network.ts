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

export interface TensorPayload {
  taskId: string;
  layerRange: [number, number];
  dimensions: number[];
  dataType: 'float32' | 'float16' | 'int4';
  tensorBuffer: ArrayBuffer; // Binary serialized data
}

export interface HardwareProfile {
  peerId: string;
  engine: 'WEBGPU' | 'WASM_SIMD';
  maxBufferSize: number; // in bytes
  flops: number; // Raw measured FLOPS
  memoryBandwidthMBs: number; // Raw measured memory bandwidth (MB/s)
  timestamp: number;
  deviceModel: string;
  isMobile: boolean;
}

export interface ComputeTask {
  taskId: string;
  type: 'MATRIX_MULTIPLY' | 'TRANSFORMER_FORWARD' | 'MAP_REDUCE';
  layerRange?: [number, number];
  inputData: ArrayBuffer; // Binary serialized input data
  dimensions: number[];
  redundantPeerId?: string; // If this task is sent to multiple nodes for MSE verification
  timestamp: number;
}

export interface TaskResult {
  taskId: string;
  peerId: string;
  outputData: ArrayBuffer; // Binary serialized output data
  dimensions: number[];
  executionTimeMs: number;
  timestamp: number;
}

export interface NetworkNode {
  peerId: string;
  profile: HardwareProfile;
  lastSeen: number;
  status: 'IDLE' | 'COMPUTING' | 'DISCONNECTED';
  assignedLayers?: [number, number];
}

export interface ModelConfig {
  name: string;
  totalLayers: number;
  hiddenSize: number;
  vocabSize: number;
}
