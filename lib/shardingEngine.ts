/* eslint-disable @typescript-eslint/no-unused-vars */
import { NetworkNode, HardwareProfile, ComputeTask, TensorPayload } from '../types/network';
import { executeSimulatedLayer } from './onnxRuntime';

// Model Config (Default 24 layers, 1024 hidden size - ultra light transformer)
export const MODEL_CONFIG = {
  name: 'Nexus-Transformer-0.5B',
  totalLayers: 24,
  hiddenSize: 1024,
  vocabSize: 32000
};

/**
 * Basic character/subword tokenizer simulation
 */
export class SubwordTokenizer {
  private vocab: string[] = [];

  constructor() {
    // Generate a basic mockup vocabulary
    this.vocab = ['<pad>', '<s>', '</s>', '<unk>', 'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
  }

  public encode(text: string): number[] {
    const tokens: number[] = [];
    // Convert to lowercase and simple character-based mapping for robust mock-tokenization
    const cleanText = text.toLowerCase();
    
    // Add start token
    tokens.push(1); 

    // Quick sub-word token mapping
    const words = cleanText.split(/\s+/);
    for (const word of words) {
      if (word.length === 0) continue;
      
      const vocabIndex = this.vocab.indexOf(word);
      if (vocabIndex > -1) {
        tokens.push(vocabIndex);
      } else {
        // Fallback to simple deterministic char-based token IDs
        for (let i = 0; i < word.length; i++) {
          tokens.push((word.charCodeAt(i) % 100) + 20);
        }
      }
    }
    return tokens;
  }

  public decode(tokenIds: number[]): string {
    let result = '';
    for (const id of tokenIds) {
      if (id === 0 || id === 1) continue; // Skip padding / start
      if (id === 2) {
        result += ' '; // End token is space
        continue;
      }
      
      if (id < this.vocab.length) {
        result += ' ' + this.vocab[id];
      } else {
        // Decode deterministic char values
        const charCode = (id - 20) + 97; // lowercase a-z
        result += String.fromCharCode(Math.max(32, Math.min(126, charCode)));
      }
    }
    return result.trim().replace(/\s+/g, ' ');
  }
}

/**
 * Dynamic layer allocation algorithm.
 * Groups nodes, scores their performance, and allocates sequence range blocks.
 */
export function allocateLayers(
  workers: NetworkNode[],
  totalLayers: number = MODEL_CONFIG.totalLayers
): Map<string, [number, number]> {
  const allocation = new Map<string, [number, number]>();
  
  if (workers.length === 0) {
    return allocation;
  }

  // 1. Calculate execution capacity score for each node
  // Score = FLOPS * 0.7 + MemoryBandwidth * 0.3
  const scoredNodes = workers.map(worker => {
    const profile = worker.profile;
    // Normalize capabilities
    const flopsScore = profile.flops / 1e6; // MFLOPS
    const bwScore = profile.memoryBandwidthMBs;
    const score = flopsScore * 0.7 + bwScore * 0.3;

    return {
      peerId: worker.peerId,
      score: Math.max(1, score),
      isMobile: profile.isMobile
    };
  });

  const totalScore = scoredNodes.reduce((sum, node) => sum + node.score, 0);

  // 2. Allocate layers proportionally based on relative scores
  let currentLayer = 0;
  
  scoredNodes.forEach((node, idx) => {
    if (idx === scoredNodes.length - 1) {
      // Last node gets all remaining layers
      allocation.set(node.peerId, [currentLayer, totalLayers - 1]);
    } else {
      let nodeLayers = Math.max(1, Math.round((node.score / totalScore) * totalLayers));
      
      // Ensure we do not overshoot total count
      if (currentLayer + nodeLayers >= totalLayers) {
        nodeLayers = totalLayers - currentLayer - 1;
      }
      
      // Prevent mobile/slow devices from getting overloaded
      if (node.isMobile) {
        nodeLayers = Math.min(nodeLayers, 3); // Max 3 layers for mobile devices
      }

      const endLayer = Math.max(currentLayer, currentLayer + nodeLayers - 1);
      allocation.set(node.peerId, [currentLayer, endLayer]);
      currentLayer = endLayer + 1;
    }
  });

  return allocation;
}

export interface PipelineTask extends ComputeTask {
  routingChain: string[]; // List of worker Peer IDs in order of layer execution
  currentChainIndex: number;
  promptText?: string;
}

/**
 * Pipeline Execution Coordinator
 */
export class PipelineShardingEngine {
  private tokenizer = new SubwordTokenizer();

  /**
   * Encodes a prompt and generates starting activation tensor
   */
  public prepareActivationTensor(prompt: string, hiddenSize: number = MODEL_CONFIG.hiddenSize): {
    tokens: number[];
    dimensions: number[];
    buffer: ArrayBuffer;
  } {
    const tokens = this.tokenizer.encode(prompt);
    
    // Create initial activation vector (Sequence Length x Hidden Size)
    const seqLen = 1; // Single token activation pass for token-by-token generation
    const dimensions = [1, seqLen, hiddenSize];
    const size = seqLen * hiddenSize;
    
    const buffer = new ArrayBuffer(size * 4); // Float32
    const floatArray = new Float32Array(buffer);
    
    // Fill activation with token-embedding-like random weights seeded by token IDs
    for (let i = 0; i < size; i++) {
      const tokenId = tokens[i % tokens.length];
      floatArray[i] = Math.sin(tokenId + i) * 0.1; // Seeding embeddings deterministically
    }

    return { tokens, dimensions, buffer };
  }

  /**
   * Executes local portion of a pipeline task (Runs on the Worker node)
   */
  public async executePipelineShard(
    task: PipelineTask,
    engine: 'WEBGPU' | 'WASM_SIMD'
  ): Promise<{
    outputBuffer: ArrayBuffer;
    nextPeerId: string | null; // Next peer in pipeline, or null if complete
  }> {
    const layerRange = task.layerRange || [0, 0];
    console.log(`[Worker Engine] Executing assigned layers ${layerRange[0]}-${layerRange[1]} using ${engine}`);
    
    // Run mathematical operations over chosen engine
    const outputBuffer = await executeSimulatedLayer(
      task.inputData,
      task.dimensions,
      layerRange,
      engine
    );

    const nextIndex = task.currentChainIndex + 1;
    const nextPeerId = nextIndex < task.routingChain.length ? task.routingChain[nextIndex] : null;

    return {
      outputBuffer,
      nextPeerId
    };
  }

  /**
   * Decodes output activations from final layer into a new text token
   */
  public decodeNextToken(
    finalBuffer: ArrayBuffer,
    vocabSize: number = MODEL_CONFIG.vocabSize
  ): { token: string; tokenId: number } {
    const floatArray = new Float32Array(finalBuffer);
    
    // Simple mock classification: project embedding space back to vocab token
    let maxIdx = 0;
    let maxVal = -Infinity;
    
    // Sample top logits
    for (let i = 0; i < Math.min(floatArray.length, vocabSize); i++) {
      // Softmax/Argmax simulation: deterministic projection based on activation state
      const logitVal = Math.sin(floatArray[i % floatArray.length] * 1000.0) + Math.cos(i);
      if (logitVal > maxVal) {
        maxVal = logitVal;
        maxIdx = i;
      }
    }

    const decoded = this.tokenizer.decode([maxIdx]);
    return {
      token: decoded || '...',
      tokenId: maxIdx
    };
  }
}
export default PipelineShardingEngine;
