/* eslint-disable @typescript-eslint/no-explicit-any */
interface Navigator {
  gpu?: {
    requestAdapter(options?: any): Promise<any>;
  };
}

declare const GPUBufferUsage: {
  MAP_READ: number;
  MAP_WRITE: number;
  COPY_SRC: number;
  COPY_DST: number;
  INDEX: number;
  VERTEX: number;
  UNIFORM: number;
  STORAGE: number;
  INDIRECT: number;
  QUERY_RESOLVE: number;
};

declare const GPUShaderStage: {
  COMPUTE: number;
  VERTEX: number;
  FRAGMENT: number;
};

declare const GPUMapMode: {
  READ: number;
  WRITE: number;
};
