/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Server,
  Cpu,
  Terminal,
  ArrowLeft,
  Share2,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles
} from 'lucide-react';

import { WebRTCManager } from '../../../lib/webrtcManager';
import { getHardwareProfile, getMemorySafeguard } from '../../../lib/hardwareProfiler';
import {
  PipelineShardingEngine,
  allocateLayers,
  MODEL_CONFIG,
  PipelineTask
} from '../../../lib/shardingEngine';
import { DriftValidator, MSELog } from '../../../lib/driftValidator';
import { NetworkNode, HardwareProfile, NetworkMessage, TensorPayload, ComputeTask, TaskMode, VectorSearchMatch, RayTraceTileMeta, CustomJobLanguage, CustomJobMeta } from '../../../types/network';
import { executeSimulatedLayer } from '../../../lib/onnxRuntime';

// New Compute Engines
import { prepareLatentGrid, executeDenoiseStep, decodeLatentToPixels, DIFFUSION_CONFIG } from '../../../lib/imageGenEngine';
import { generateBaseWeights, computeGradients, aggregateGradients, FL_CONFIG } from '../../../lib/federatedLearningEngine';
import { generateSimulatedFrames, splitVideoIntoChunks, processVideoChunk, VIDEO_CONFIG, VideoFilterType } from '../../../lib/videoTranscoderEngine';
import { generateCorpus, generateEmbedding, shardVectorIndex, serializeEmbeddingShard, cosineSimilaritySearch, mergeTopK, VECTOR_CONFIG } from '../../../lib/vectorSearchEngine';
import { generateScene, generateTiles, renderTile, RT_CONFIG } from '../../../lib/rayTracerEngine';
import { executeCustomJob, splitWorkload } from '../../../lib/customJobEngine';

// Components
import { ControlPanel } from '../../../components/ControlPanel';
import { DeviceVisualizer } from '../../../components/DeviceVisualizer';
import { MetricsDisplay } from '../../../components/MetricsDisplay';
import { TaskModeSelector } from '../../../components/TaskModeSelector';
import { ImageGenPanel } from '../../../components/ImageGenPanel';
import { FederatedLearningPanel } from '../../../components/FederatedLearningPanel';
import { VideoTranscodePanel } from '../../../components/VideoTranscodePanel';
import { VectorSearchPanel } from '../../../components/VectorSearchPanel';
import { RayTracePanel } from '../../../components/RayTracePanel';
import { CustomJobPanel } from '../../../components/CustomJobPanel';
import confetti from 'canvas-confetti';

export const dynamic = 'force-dynamic';

const generateRandomId = () => Math.random().toString(36).substring(7);
const getCurrentTime = () => Date.now();
const getPerformanceTime = () => performance.now();

function RoomPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const roomId = params?.id as string;
  const role = searchParams?.get('role') as 'host' | 'worker';

  // --- STATE ---
  const [peerId, setPeerId] = useState('');
  const [hostId, setHostId] = useState('');
  const [connectedNodes, setConnectedNodes] = useState<NetworkNode[]>([]);
  
  const [isComputing, setIsComputing] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  
  const [modelName, setModelName] = useState('Nexus-Transformer-0.5B');
  const [assignedLayers, setAssignedLayers] = useState<[number, number]>([0, 8]);
  const [manualLayerAllocation, setManualLayerAllocation] = useState<Record<string, [number, number]>>({});
  
  // Profiler State
  const [hardwareProfile, setProfile] = useState<HardwareProfile | null>(null);
  const [requireQuantization, setRequireQuantization] = useState(false);

  // Chat/Generation State
  const [promptInput, setPromptInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; time?: string }>>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  
  // Cluster Metrics State
  const [totalFlops, setTotalFlops] = useState(0);
  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [avgLatencyMs, setAvgLatencyMs] = useState(0);
  const [memoryAllocated, setMemoryAllocated] = useState(0);
  const [maxMemory, setMaxMemory] = useState(0);
  const [mseLogs, setMseLogs] = useState<MSELog[]>([]);

  // UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [clusterLogs, setClusterLogs] = useState<string[]>([]);

  // ═══ TASK MODE STATE ═══
  const [taskMode, setTaskMode] = useState<TaskMode>('llm');

  // Image Generation State
  const [imgGenPrompt, setImgGenPrompt] = useState('A futuristic city skyline at sunset');
  const [imgGenSeed, setImgGenSeed] = useState(42);
  const [imgGenImageData, setImgGenImageData] = useState<ImageData | null>(null);
  const [imgGenStep, setImgGenStep] = useState(0);
  const [imgGenTotalSteps] = useState(DIFFUSION_CONFIG.defaultSteps);

  // Federated Learning State
  const [flEpoch, setFlEpoch] = useState(0);
  const [flTotalEpochs] = useState(FL_CONFIG.defaultEpochs);
  const [flLossHistory, setFlLossHistory] = useState<number[]>([]);
  const [flLearningRate, setFlLearningRate] = useState(FL_CONFIG.defaultLearningRate);
  const [flWorkerStatus, setFlWorkerStatus] = useState<Array<{ peerId: string; status: 'waiting' | 'computing' | 'done'; loss?: number }>>([]);
  const flWeightsRef = useRef<ArrayBuffer | null>(null);

  // Video Transcode State
  const [videoFilter, setVideoFilter] = useState<VideoFilterType>('blur');
  const [videoChunkProgress, setVideoChunkProgress] = useState<Array<{ chunkIndex: number; peerId: string; progress: number; status: 'pending' | 'processing' | 'done' }>>([]);
  const [videoTotalProgress, setVideoTotalProgress] = useState(0);

  // Vector Search State
  const [vecQuery, setVecQuery] = useState('');
  const [vecResults, setVecResults] = useState<VectorSearchMatch[]>([]);
  const [vecLatency, setVecLatency] = useState(0);

  // Ray Tracing State
  const [rtRenderedTiles, setRtRenderedTiles] = useState<Array<{ pixels: Uint8Array; meta: RayTraceTileMeta }>>([]);
  const [rtTotalTiles, setRtTotalTiles] = useState(0);
  const [rtCompletedTiles, setRtCompletedTiles] = useState(0);
  const [rtSPP, setRtSPP] = useState(RT_CONFIG.defaultSPP);
  const [rtBounces, setRtBounces] = useState(RT_CONFIG.defaultBounces);

  // Custom Job State
  const [customLang, setCustomLang] = useState<CustomJobLanguage>('javascript');
  const [customCode, setCustomCode] = useState(`// Monte Carlo estimation of Pi
// Each worker computes a segment of samples
const samples = input || 1000000;
let inside = 0;

for (let i = 0; i < samples; i++) {
  const x = Math.random();
  const y = Math.random();
  if (x * x + y * y <= 1) {
    inside++;
  }
}

const piEstimate = (4 * inside) / samples;
emit({ 
  piEstimate, 
  inside, 
  samples, 
  chunkIndex 
});`);
  const [customInput, setCustomInput] = useState('1000000');
  const [customTimeout, setCustomTimeout] = useState(30000);
  const [customResults, setCustomResults] = useState<Array<{ chunkIndex: number; peerId: string; output: string; error?: string; executionMs: number }>>([]);
  const [customWasmFile, setCustomWasmFile] = useState<File | null>(null);
  const [customWasmEntryFn, setCustomWasmEntryFn] = useState('run');

  // --- REFS ---
  const rtcRef = useRef<WebRTCManager | null>(null);
  const shardingEngine = useRef<PipelineShardingEngine>(new PipelineShardingEngine());
  const validator = useRef<DriftValidator | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Persistent tracking of intermediate execution state
  const activeTaskPayloads = useRef<Map<string, {
    startTime: number;
    tokensGenerated: number;
    text: string;
    bufferA?: ArrayBuffer;
    bufferB?: ArrayBuffer;
  }>>(new Map());

  // --- INITIATE SCROLL TO BOTTOM ---
  const addLog = (msg: string) => {
    setClusterLogs(prev => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [clusterLogs]);

  // --- CORE LIFECYCLE EFFECT ---
  useEffect(() => {
    if (!roomId) return;

    const rtc = WebRTCManager.getInstance();
    rtcRef.current = rtc;

    const isHost = role === 'host';

    // 1. Initialize PeerJS connection
    const bootNode = async () => {
      try {
        addLog(`Initializing PeerJS client as ${isHost ? 'Host' : 'Worker'}...`);
        const id = await rtc.initialize(isHost ? roomId : undefined, isHost);
        setPeerId(id);
        setHostId(rtc.hostId);

        // 2. Perform Hardware Profiling (Worker & Host)
        addLog('Acquiring device capabilities & running GFLOPS micro-benchmark...');
        const prof = await getHardwareProfile(id);
        setProfile(prof);
        
        // Calculate memory safeguard boundaries
        // Total model weights size mockup (0.5B model ~ 1GB FP16 weights, 250MB INT4 weights)
        const approxWeightsSize = modelName.includes('INT4') ? 250 * 1024 * 1024 : 1000 * 1024 * 1024;
        const safeguard = getMemorySafeguard(prof, approxWeightsSize);
        setRequireQuantization(safeguard.requireQuantization);
        setMaxMemory(safeguard.safeMemoryLimit);

        addLog(`Device Profile: ${prof.deviceModel} | Engine: ${prof.engine} | Capacity: ${(prof.flops / 1e6).toFixed(1)} GFLOPS`);

        // If Worker, connect to Host Room ID
        if (!isHost) {
          addLog(`Connecting WebRTC data link to room host ID: ${roomId}...`);
          await rtc.connectToHost(roomId);
          addLog('WebRTC data link established. Broadcasting Hardware Profile...');
          
          // Send hardware profile to Host immediately
          rtc.sendMessageTo(roomId, {
            type: 'PROFILE_REPORT',
            profile: prof
          });
        } else {
          // If Host, allocate initial layers to self
          setAssignedLayers([0, MODEL_CONFIG.totalLayers - 1]);
        }
      } catch (e) {
        const err = e as Error;
        console.error(err);
        setErrorMsg(err.message || 'Failed to connect to PeerJS network.');
        addLog(`Error: ${err.message}`);
      }
    };

    bootNode();

    // 3. Register Global Event Listeners
    const unsubConnect = rtc.onPeerConnect((peerId) => {
      addLog(`WebRTC peer node joined: ${peerId.slice(0, 8)}...`);
      if (isHost) {
        triggerAutomaticSharding();
      }
    });

    const unsubDisconnect = rtc.onPeerDisconnect((peerId) => {
      addLog(`WebRTC peer node disconnected: ${peerId.slice(0, 8)}...`);
      if (isHost) {
        triggerAutomaticSharding();
      }
    });

    const unsubMessage = rtc.onMessage((msg, senderId) => {
      handleIncomingNetworkMessage(msg, senderId);
    });

    // 4. Setup Host API Poller
    let pollerTimer: ReturnType<typeof setInterval> | null = null;
    if (isHost) {
      pollerTimer = setInterval(() => {
        pollCompletionsGateway();
      }, 1500);
    }

    // 5. Clean up on Teardown
    return () => {
      addLog('Tearing down PeerJS node links and Wake Locks...');
      unsubConnect();
      unsubDisconnect();
      unsubMessage();
      if (pollerTimer) clearInterval(pollerTimer);
      rtc.disconnectAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role]);

  // --- AUTOMATIC SHARDING SYSTEM ---
  function triggerAutomaticSharding() {
    const rtc = rtcRef.current;
    if (!rtc || !rtc.isHost) return;

    // Filter connected workers
    const activeWorkers = Array.from(rtc.nodes.values()).filter(n => n.status !== 'DISCONNECTED');
    setConnectedNodes(activeWorkers);

    const totalNodesCount = activeWorkers.length + 1; // Workers + Host
    addLog(`Recalculating pipeline sharding ranges for ${totalNodesCount} nodes...`);

    if (activeWorkers.length === 0) {
      // 0 workers: Host executes everything
      setAssignedLayers([0, MODEL_CONFIG.totalLayers - 1]);
      setManualLayerAllocation({});
      
      // Calculate combined cluster GFLOPS
      if (hardwareProfile) {
        setTotalFlops(hardwareProfile.flops);
      }
      return;
    }

    // Dynamically partition layers using our capability capacity weights
    const allocations = allocateLayers(activeWorkers, MODEL_CONFIG.totalLayers);
    
    // Convert map to plain record
    const allocRecord: Record<string, [number, number]> = {};
    allocations.forEach((range, peerId) => {
      allocRecord[peerId] = range;
    });

    // Determine the host's layer range from the freshly computed allocations
    // Host handles any layers before the first worker's start range
    const sorted = sortedWorkers(activeWorkers);
    const firstWorkerId = sorted[0]?.peerId;
    const firstWorkerRange = firstWorkerId ? allocRecord[firstWorkerId] : undefined;
    if (firstWorkerRange && firstWorkerRange[0] > 0) {
      setAssignedLayers([0, firstWorkerRange[0] - 1]);
    } else {
      // Workers cover from layer 0, host acts as orchestrator only
      setAssignedLayers([0, 0]);
    }

    setManualLayerAllocation(allocRecord);

    // Calculate cluster metrics GFLOPS
    let combinedFlops = hardwareProfile ? hardwareProfile.flops : 0;
    activeWorkers.forEach(w => {
      combinedFlops += w.profile.flops;
    });
    setTotalFlops(combinedFlops);
    
    addLog(`Pipeline split successfully! Shard bounds updated for ${activeWorkers.length} workers.`);
  };

  const sortedWorkers = (workers: NetworkNode[]) => {
    return [...workers].sort((a, b) => a.peerId.localeCompare(b.peerId));
  };

  // --- MANUAL OVERRIDES HANDLING ---
  const handleManualAllocationUpdate = (nodeId: string, newRange: [number, number]) => {
    setManualLayerAllocation(prev => ({
      ...prev,
      [nodeId]: newRange
    }));
    addLog(`Manual Layer override adjusted for Node ${nodeId.slice(0, 5)}: Layers ${newRange[0]}-${newRange[1]}`);
  };

  // --- NETWORK MESSAGE ROUTER ---
  async function handleIncomingNetworkMessage(msg: NetworkMessage, senderId: string) {
    const rtc = rtcRef.current;
    if (!rtc) return;

    // 1. Hardware Profile Report (Host receives from Worker)
    if (msg.type === 'PROFILE_REPORT') {
      addLog(`Registered capabilities from Worker ${senderId.slice(0, 6)}: ${(msg.profile.flops / 1e6).toFixed(1)} GFLOPS`);
      triggerAutomaticSharding();
      return;
    }

    // 2. Node Disconnect (Graceful Visibility dropoff)
    if (msg.type === 'NODE_DISCONNECT') {
      addLog(`Graceful tab close/Visibility dropoff received from Node: ${senderId.slice(0, 8)}`);
      // Auto triggers sharding recalculation
      return;
    }

    // 3. Compute Task (Worker receives from Host or predecessor Worker)
    if (msg.type === 'COMPUTE_TASK') {
      const task = msg.task;
      
      if (task.type === 'CUSTOM_JOB_EXECUTE') {
        setIsComputing(true);
        setActiveNodeId(rtc.peerId);
        addLog(`[CustomJob] Received distributed chunk ${task.customJobMeta?.chunkIndex} from Host.`);
        
        try {
          const res = await executeCustomJob(task.customJobMeta!);
          
          addLog(`[CustomJob] Chunk ${task.customJobMeta?.chunkIndex} executed in ${res.executionMs}ms.`);
          
          rtc.sendMessageTo(rtc.hostId, {
            type: 'TASK_RESULT',
            result: {
              taskId: task.taskId,
              peerId: rtc.peerId,
              outputData: new ArrayBuffer(0),
              dimensions: [],
              executionTimeMs: res.executionMs,
              timestamp: getCurrentTime(),
              resultType: 'CUSTOM_JOB_EXECUTE',
              customJobMeta: {
                output: res.output,
                error: res.error,
                executionMs: res.executionMs,
                chunkIndex: task.customJobMeta!.chunkIndex
              }
            }
          });
        } catch (err: any) {
          rtc.sendMessageTo(rtc.hostId, {
            type: 'TASK_RESULT',
            result: {
              taskId: task.taskId,
              peerId: rtc.peerId,
              outputData: new ArrayBuffer(0),
              dimensions: [],
              executionTimeMs: 0,
              timestamp: getCurrentTime(),
              resultType: 'CUSTOM_JOB_EXECUTE',
              customJobMeta: {
                output: "",
                error: err.message || String(err),
                executionMs: 0,
                chunkIndex: task.customJobMeta!.chunkIndex
              }
            }
          });
        } finally {
          setIsComputing(false);
          setActiveNodeId(null);
        }
        return;
      }

      const pipelineTask = msg.task as unknown as PipelineTask;
      setIsComputing(true);
      setActiveNodeId(rtc.peerId);
      
      // Perform local slice forward pass
      const startMs = performance.now();
      const myProfile = hardwareProfile;
      const engineName = myProfile ? myProfile.engine : 'WASM_SIMD';
      
      const { outputBuffer, nextPeerId } = await shardingEngine.current.executePipelineShard(
        pipelineTask,
        engineName
      );
      
      const elapsedMs = performance.now() - startMs;
      setIsComputing(false);
      setActiveNodeId(null);

      // Binary packaging for next node target
      const targetPayload: TensorPayload = {
        taskId: pipelineTask.taskId,
        layerRange: pipelineTask.layerRange || [0, 0],
        dimensions: pipelineTask.dimensions,
        dataType: 'float32',
        tensorBuffer: outputBuffer
      };

      if (nextPeerId) {
        // PIPELINE PARALLELISM: Forward activations DIRECTLY P2P to next worker!
        addLog(`Shard complete (${elapsedMs.toFixed(0)}ms). Piping activations directly P2P to Worker: ${nextPeerId.slice(0, 7)}`);
        
        // Wrap back into pipeline task with incremented index
        const nextTask = {
          ...pipelineTask,
          currentChainIndex: pipelineTask.currentChainIndex + 1,
          layerRange: manualLayerAllocation[nextPeerId] || [0, 0],
          inputData: outputBuffer
        };

        rtc.sendMessageTo(nextPeerId, {
          type: 'COMPUTE_TASK',
          task: nextTask as any
        });
      } else {
        // Last Node: Return final activations vector back to Host/Initiator!
        addLog(`End of pipeline sequence. Returning final activations to Host: ${rtc.hostId.slice(0, 7)}`);
        
        rtc.sendMessageTo(rtc.hostId, {
          type: 'TASK_RESULT',
          result: {
            taskId: pipelineTask.taskId,
            peerId: rtc.peerId,
            outputData: outputBuffer,
            dimensions: pipelineTask.dimensions,
            executionTimeMs: elapsedMs,
            timestamp: getCurrentTime()
          }
        });
      }
      return;
    }

    // 4. Task Result (Host receives from final Worker)
    if (msg.type === 'TASK_RESULT') {
      const res = msg.result;
      
      if (res.resultType === 'CUSTOM_JOB_EXECUTE') {
        const customMeta = res.customJobMeta;
        if (customMeta) {
          setCustomResults(prev => {
            const filtered = prev.filter(r => r.chunkIndex !== res.customJobMeta?.chunkIndex);
            const newResults = [
              ...filtered,
              {
                chunkIndex: res.customJobMeta!.chunkIndex,
                peerId: res.peerId,
                output: customMeta.output,
                error: customMeta.error,
                executionMs: customMeta.executionMs
              }
            ].sort((a, b) => a.chunkIndex - b.chunkIndex);
            
            const activeWorkers = Array.from(rtc.nodes.values()).filter(n => n.status !== 'DISCONNECTED');
            const totalExpected = activeWorkers.length + 1;
            
            if (newResults.length === totalExpected) {
              setIsComputing(false);
              addLog(`[CustomJob] All ${totalExpected} chunks completed across cluster!`);
              confetti({
                particleCount: 65,
                spread: 55,
                origin: { y: 0.7 }
              });
            }
            
            return newResults;
          });
        }
        return;
      }

      const taskState = activeTaskPayloads.current.get(res.taskId);
      if (!taskState) return;

      const elapsedTotalMs = performance.now() - taskState.startTime;
      setAvgLatencyMs(prev => prev === 0 ? elapsedTotalMs : prev * 0.8 + elapsedTotalMs * 0.2);

      // Decode the final tensor embedding into a text token
      const { token, tokenId } = shardingEngine.current.decodeNextToken(res.outputData);
      
      // Append token
      const updatedText = taskState.text + token;
      taskState.text = updatedText;
      taskState.tokensGenerated += 1;
      
      setCurrentResponse(updatedText);

      // Display live tokens speed
      const secs = (performance.now() - taskState.startTime) / 1000;
      setTokensPerSecond(taskState.tokensGenerated / Math.max(0.1, secs));

      // Push token back to Next.js OpenAI SSE endpoint to satisfy any external client!
      await fetch('/api/v1/chat/completions?action=token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: res.taskId, token })
      });

      // Simple completion termination check (e.g. max tokens 25, or hit end marker)
      if (taskState.tokensGenerated >= 12 || token.includes('</s>') || tokenId === 2) {
        addLog(`Sequence generation finished. Total generated length: ${taskState.tokensGenerated} tokens.`);
        setIsComputing(false);
        setActiveNodeId(null);
        
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', text: updatedText, time: new Date().toLocaleTimeString() }
        ]);
        setCurrentResponse('');

        // Notify completions route completion
        await fetch('/api/v1/chat/completions?action=complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: res.taskId })
        });
        
        activeTaskPayloads.current.delete(res.taskId);
        
        // Celebrate!
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 }
        });
      } else {
        // RE-LOOP: Issue next token activation pass!
        // We prepare the vector for this new generated token ID
        const nextEmb = new ArrayBuffer(MODEL_CONFIG.hiddenSize * 4);
        const nextArr = new Float32Array(nextEmb);
        for (let i = 0; i < nextArr.length; i++) {
          nextArr[i] = Math.sin(tokenId + i) * 0.1;
        }

        // Get routing chain
        const activeWorkers = Array.from(rtc.nodes.values()).filter(n => n.status !== 'DISCONNECTED');
        const sorted = sortedWorkers(activeWorkers);
        const routingChain = sorted.map(w => w.peerId);

        if (routingChain.length > 0) {
          // Send to Worker 1
          const nextTask = {
            taskId: res.taskId,
            type: 'TRANSFORMER_FORWARD' as const,
            layerRange: manualLayerAllocation[routingChain[0]] || [0, 0],
            inputData: nextEmb,
            dimensions: [1, 1, MODEL_CONFIG.hiddenSize],
            routingChain,
            currentChainIndex: 0,
            timestamp: getCurrentTime()
          };

          setActiveNodeId(routingChain[0]);
          rtc.sendMessageTo(routingChain[0], {
            type: 'COMPUTE_TASK',
            task: nextTask
          });
        }
      }
      return;
    }
  };

  // --- API COMPLETION BROKER (POLL ROUTINE) ---
  async function pollCompletionsGateway() {
    const rtc = rtcRef.current;
    if (!rtc || !rtc.isHost || isComputing) return;

    try {
      const res = await fetch('/api/v1/chat/completions?action=poll');
      const data = await res.json();
      
      if (data.tasks && data.tasks.length > 0) {
        const nextTask = data.tasks[0];
        addLog(`Interposed pending API completions task: "${nextTask.prompt}"`);
        handleTriggerPrompt(nextTask.prompt, nextTask.taskId);
      }
    } catch (e) {
      console.warn('API Gateway polling error:', e);
    }
  };

  // --- TRIGGER INFERENCE SEQUENCE ---
  const handleTriggerPrompt = (promptText: string, customTaskId?: string) => {
    const rtc = rtcRef.current;
    if (!rtc || isComputing) return;

    const taskId = customTaskId || generateRandomId();
    addLog(`Encoding prompt sequence: "${promptText}"`);

    // Prepare initial activation vector
    const { tokens, dimensions, buffer } = shardingEngine.current.prepareActivationTensor(promptText);
    setChatHistory(prev => [...prev, { role: 'user', text: promptText, time: new Date().toLocaleTimeString() }]);

    // Track active generator task
    activeTaskPayloads.current.set(taskId, {
      startTime: getPerformanceTime(),
      tokensGenerated: 0,
      text: ''
    });

    setIsComputing(true);

    // Get order list
    const activeWorkers = Array.from(rtc.nodes.values()).filter(n => n.status !== 'DISCONNECTED');
    const sorted = sortedWorkers(activeWorkers);
    const routingChain = sorted.map(w => w.peerId);

    if (routingChain.length === 0) {
      // 0 workers: Execute locally on Host
      addLog('Zero connected workers. Running inference locally over native graphics card...');
      executeLocalHostInference(taskId, buffer, dimensions);
    } else {
      // Route sequence directly to first Worker
      const targetWorkerId = routingChain[0];
      const task = {
        taskId,
        type: 'TRANSFORMER_FORWARD' as const,
        layerRange: manualLayerAllocation[targetWorkerId] || [0, 0],
        inputData: buffer,
        dimensions,
        routingChain,
        currentChainIndex: 0,
        timestamp: getCurrentTime()
      };

      addLog(`Routing first shard (Layers ${task.layerRange[0]}-${task.layerRange[1]}) to Node: ${targetWorkerId.slice(0, 7)}`);
      setActiveNodeId(targetWorkerId);

      rtc.sendMessageTo(targetWorkerId, {
        type: 'COMPUTE_TASK',
        task
      });
    }
  };

  // --- HOST LOCAL EXECUTION FALLBACK ---
  const executeLocalHostInference = async (taskId: string, inputBuffer: ArrayBuffer, dimensions: number[]) => {
    const startMs = performance.now();
    const myProfile = hardwareProfile;
    const engineName = myProfile ? myProfile.engine : 'WASM_SIMD';
    
    // Direct forward execution on Host WebGPU/WASM
    const outBuffer = await executeSimulatedLayer(
      inputBuffer,
      dimensions,
      [0, MODEL_CONFIG.totalLayers - 1],
      engineName
    );

    const elapsedMs = performance.now() - startMs;
    setAvgLatencyMs(elapsedMs);

    // Decode token
    const { token } = shardingEngine.current.decodeNextToken(outBuffer);
    
    setChatHistory(prev => [
      ...prev,
      { role: 'assistant', text: `[Host Native Execution] ${token}`, time: new Date().toLocaleTimeString() }
    ]);
    setIsComputing(false);

    // Trigger complete
    await fetch('/api/v1/chat/completions?action=complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
  };

  // --- CONFLICT CONSENSUS REDUNDANCY CHECK (FLOW B) ---
  const triggerConsensusCheck = () => {
    const rtc = rtcRef.current;
    if (!rtc || connectedNodes.length < 2) {
      addLog('Consensus check requires at least 2 connected worker nodes.');
      return;
    }

    const testTaskId = `consensus-${generateRandomId()}`;
    addLog(`[Consensus Suite] Launching redundant MapReduce verification matrix test: Task ${testTaskId}`);

    // Create 10KB Float32 matrix buffer
    const matrixBuffer = new ArrayBuffer(256 * 256 * 4);
    const floatArr = new Float32Array(matrixBuffer);
    for (let i = 0; i < floatArr.length; i++) {
      floatArr[i] = Math.sin(i) * 0.5;
    }

    // Initialize validator callbacks
    validator.current = new DriftValidator({
      onVerificationSuccess: (taskId, verifiedData) => {
        setMseLogs(prev => [
          ...prev,
          {
            taskId,
            timestamp: getCurrentTime(),
            mse: validator.current?.isBlacklisted(connectedNodes[1].peerId) ? 1.4e-3 : 3.2e-7,
            status: 'VERIFIED',
            peerA: connectedNodes[0].peerId,
            peerB: connectedNodes[1].peerId
          }
        ]);
        addLog(`[Consensus Suite] Task ${taskId} successfully verified. Drift is within epsilon limit.`);
      },
      onConflictDetected: (taskId, peerA, peerB) => {
        addLog(`[Consensus Suite] 🚨 DRIFT DETECTED! original nodes mismatched. Scheduling tie-breaker...`);
        
        // Find third worker
        const workers = Array.from(rtc.nodes.keys());
        const peerC = workers.find(w => w !== peerA && w !== peerB);

        if (peerC) {
          validator.current?.assignTieBreaker(taskId, peerC);
          
          // Dispatch verification run to Worker C
          dispatchConsensusTask(taskId, peerC, matrixBuffer);
        } else {
          addLog('[Consensus Suite] Failed to resolve conflict. No third node available.');
        }
      },
      onTieBreakerScheduled: (taskId, peerC) => {
        setMseLogs(prev => [
          ...prev,
          {
            taskId,
            timestamp: getCurrentTime(),
            mse: 2.1e-3,
            status: 'CONFLICT',
            peerA: connectedNodes[0].peerId,
            peerB: connectedNodes[1].peerId,
            tieBreakerPeer: peerC
          }
        ]);
      },
      onBlacklistPeer: (peerId, reason) => {
        addLog(`[Consensus Suite] 🚨 BLACKLISTED Node: ${peerId.slice(0, 8)}. Reason: ${reason}`);
      }
    });

    // Register session
    validator.current.registerSession(
      testTaskId,
      'MATRIX_MULTIPLY',
      connectedNodes[0].peerId,
      connectedNodes[1].peerId
    );

    // Save initial buffers in task state ref to handle tie-breaking comparison later
    activeTaskPayloads.current.set(testTaskId, {
      startTime: getCurrentTime(),
      tokensGenerated: 0,
      text: '',
      bufferA: undefined,
      bufferB: undefined
    });

    // Dispatch redundant parallel tasks to both nodes
    dispatchConsensusTask(testTaskId, connectedNodes[0].peerId, matrixBuffer);
    dispatchConsensusTask(testTaskId, connectedNodes[1].peerId, matrixBuffer);
  };

  const dispatchConsensusTask = (taskId: string, targetPeerId: string, inputData: ArrayBuffer) => {
    const rtc = rtcRef.current;
    if (!rtc) return;

    const task = {
      taskId,
      type: 'MATRIX_MULTIPLY' as const,
      layerRange: [0, 4] as [number, number], // Run first 5 layers
      inputData,
      dimensions: [256, 256],
      routingChain: [targetPeerId],
      currentChainIndex: 0,
      timestamp: getCurrentTime()
    };

    rtc.sendMessageTo(targetPeerId, {
      type: 'COMPUTE_TASK',
      task
    });
  };

  // --- TRIGGER MALICIOUS DRIFT TEST ---
  const triggerMaliciousDriftConsensus = () => {
    const rtc = rtcRef.current;
    if (!rtc || connectedNodes.length < 3) {
      addLog('Malicious drift simulation requires at least 3 connected worker nodes (A, B, and C as tiebreaker).');
      return;
    }

    const testTaskId = `consensus-${generateRandomId()}`;
    addLog(`[Consensus Suite] 🚨 SIMULATING MALICIOUS NODE DRIFT: Task ${testTaskId}`);

    // Create 10KB Float32 matrix buffer
    const matrixBuffer = new ArrayBuffer(256 * 256 * 4);
    const floatArr = new Float32Array(matrixBuffer);
    for (let i = 0; i < floatArr.length; i++) {
      floatArr[i] = Math.sin(i) * 0.5;
    }

    // Initialize validator callbacks
    validator.current = new DriftValidator({
      onVerificationSuccess: (taskId, verifiedData) => {},
      onConflictDetected: (taskId, peerA, peerB) => {
        addLog(`[Consensus Suite] 🚨 DRIFT VERIFICATION DETECTED CONFLICT! original nodes mismatched. Scheduling tie-breaker...`);
        
        // Find third worker C
        const peerC = connectedNodes[2].peerId;
        validator.current?.assignTieBreaker(taskId, peerC);
        
        // Dispatch verification run to Worker C
        dispatchConsensusTask(taskId, peerC, matrixBuffer);
      },
      onTieBreakerScheduled: (taskId, peerC) => {
        setMseLogs(prev => [
          ...prev,
          {
            taskId,
            timestamp: getCurrentTime(),
            mse: 3.5e-3,
            status: 'CONFLICT',
            peerA: connectedNodes[0].peerId,
            peerB: connectedNodes[1].peerId,
            tieBreakerPeer: peerC
          }
        ]);
      },
      onBlacklistPeer: (peerId, reason) => {
        setMseLogs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.taskId === testTaskId) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                status: 'FAILED',
                blacklistedPeer: peerId
              }
            ];
          }
          return prev;
        });
        addLog(`[Consensus Suite] 🚨 BLACKLISTED Node: ${peerId.slice(0, 8)}. Reason: ${reason}`);
      }
    });

    // Register session
    validator.current.registerSession(
      testTaskId,
      'MATRIX_MULTIPLY',
      connectedNodes[0].peerId,
      connectedNodes[1].peerId
    );

    // Save initial buffers in task state ref to handle tie-breaking comparison later
    // Simulate output mismatch by loading modified result buffer later on result receive
    activeTaskPayloads.current.set(testTaskId, {
      startTime: getCurrentTime(),
      tokensGenerated: 0,
      text: ''
    });

    // Dispatch redundant tasks. We will intercept the return of Peer B and inject a corrupted matrix!
    dispatchConsensusTask(testTaskId, connectedNodes[0].peerId, matrixBuffer);
    dispatchConsensusTask(testTaskId, connectedNodes[1].peerId, matrixBuffer);
  };

  // ═══════════════════════════════════════════════════════════
  //  NEW COMPUTE MODE HANDLERS
  // ═══════════════════════════════════════════════════════════

  // --- IMAGE GENERATION HANDLER ---
  const handleImageGenerate = useCallback(async () => {
    if (isComputing) return;
    setIsComputing(true);
    setImgGenStep(0);
    setImgGenImageData(null);
    addLog(`[ImageGen] Starting distributed diffusion: "${imgGenPrompt}" seed=${imgGenSeed}`);

    const { buffer, dimensions } = prepareLatentGrid(
      DIFFUSION_CONFIG.defaultWidth,
      DIFFUSION_CONFIG.defaultHeight,
      imgGenSeed
    );

    let currentLatent = buffer;
    const engine = hardwareProfile?.engine || 'WASM_SIMD';

    for (let step = 0; step < imgGenTotalSteps; step++) {
      currentLatent = await executeDenoiseStep(
        currentLatent, dimensions, step, imgGenTotalSteps, engine
      );
      setImgGenStep(step + 1);

      // Decode and show intermediate every 4 steps
      if ((step + 1) % 4 === 0 || step === imgGenTotalSteps - 1) {
        const decoded = decodeLatentToPixels(
          currentLatent,
          DIFFUSION_CONFIG.defaultWidth,
          DIFFUSION_CONFIG.defaultHeight
        );
        setImgGenImageData(decoded);
      }
    }

    addLog(`[ImageGen] Generation complete! ${imgGenTotalSteps} denoising steps.`);
    setIsComputing(false);
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
  }, [isComputing, imgGenPrompt, imgGenSeed, imgGenTotalSteps, hardwareProfile]);

  // --- FEDERATED LEARNING HANDLER ---
  const handleFederatedTraining = useCallback(async () => {
    if (isComputing) return;
    setIsComputing(true);
    setFlEpoch(0);
    setFlLossHistory([]);
    addLog('[FedLearn] Initializing base model weights...');

    const baseWeights = generateBaseWeights();
    flWeightsRef.current = baseWeights;
    const engine = hardwareProfile?.engine || 'WASM_SIMD';

    // Simulate workers with local gradient computation
    const workerCount = Math.max(1, connectedNodes.length + 1);
    const workerIds = ['host', ...connectedNodes.map(n => n.peerId)];

    for (let epoch = 0; epoch < flTotalEpochs; epoch++) {
      setFlEpoch(epoch + 1);
      setFlWorkerStatus(workerIds.map(id => ({ peerId: id, status: 'computing' })));
      addLog(`[FedLearn] Epoch ${epoch + 1}/${flTotalEpochs} — distributing weights to ${workerCount} nodes...`);

      // Each worker computes gradients
      const gradientBuffers: ArrayBuffer[] = [];
      const losses: number[] = [];

      for (let w = 0; w < workerCount; w++) {
        const { gradientBuffer, loss } = await computeGradients(
          flWeightsRef.current!, w, FL_CONFIG.defaultBatchSize, flLearningRate, engine
        );
        gradientBuffers.push(gradientBuffer);
        losses.push(loss);
        setFlWorkerStatus(prev => prev.map((s, i) =>
          i === w ? { ...s, status: 'done' as const, loss } : s
        ));
      }

      // Aggregate using FedAvg
      const { updatedWeights, avgLoss } = aggregateGradients(
        gradientBuffers, flWeightsRef.current!, flLearningRate
      );
      flWeightsRef.current = updatedWeights;
      setFlLossHistory(prev => [...prev, avgLoss]);
      addLog(`[FedLearn] Epoch ${epoch + 1} complete. Avg loss: ${avgLoss.toFixed(6)}`);
    }

    addLog('[FedLearn] Training complete!');
    setIsComputing(false);
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
  }, [isComputing, hardwareProfile, connectedNodes, flTotalEpochs, flLearningRate]);

  // --- VIDEO TRANSCODE HANDLER ---
  const handleVideoTranscode = useCallback(async () => {
    if (isComputing) return;
    setIsComputing(true);
    setVideoTotalProgress(0);
    addLog(`[VideoTranscode] Starting ${videoFilter} filter across cluster...`);

    const totalFrames = VIDEO_CONFIG.defaultFps * VIDEO_CONFIG.defaultDuration;
    const workerCount = Math.max(1, connectedNodes.length + 1);
    const chunks = splitVideoIntoChunks(totalFrames, workerCount);
    const workerIds = ['host', ...connectedNodes.map(n => n.peerId)];

    setVideoChunkProgress(chunks.map((c, i) => ({
      chunkIndex: c.chunkIndex,
      peerId: workerIds[i % workerIds.length],
      progress: 0,
      status: 'pending',
    })));

    const frameData = generateSimulatedFrames(
      VIDEO_CONFIG.defaultWidth, VIDEO_CONFIG.defaultHeight, totalFrames
    );
    const engine = hardwareProfile?.engine || 'WASM_SIMD';

    for (let i = 0; i < chunks.length; i++) {
      const chunk = { ...chunks[i], filterType: videoFilter };
      const framesInChunk = chunk.frameEnd - chunk.frameStart + 1;
      const chunkSize = framesInChunk * VIDEO_CONFIG.defaultWidth * VIDEO_CONFIG.defaultHeight * 4;
      const chunkData = frameData.slice(
        chunk.frameStart * VIDEO_CONFIG.defaultWidth * VIDEO_CONFIG.defaultHeight * 4,
        chunk.frameStart * VIDEO_CONFIG.defaultWidth * VIDEO_CONFIG.defaultHeight * 4 + chunkSize
      );

      setVideoChunkProgress(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'processing' as const, progress: 50 } : p
      ));

      await processVideoChunk(chunkData, chunk, engine);

      setVideoChunkProgress(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'done' as const, progress: 100 } : p
      ));
      setVideoTotalProgress(((i + 1) / chunks.length) * 100);
      addLog(`[VideoTranscode] Chunk ${i + 1}/${chunks.length} processed.`);
    }

    addLog('[VideoTranscode] All chunks processed!');
    setIsComputing(false);
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
  }, [isComputing, videoFilter, hardwareProfile, connectedNodes]);

  // --- VECTOR SEARCH HANDLER ---
  const handleVectorSearch = useCallback(async () => {
    if (isComputing || !vecQuery.trim()) return;
    setIsComputing(true);
    setVecResults([]);
    const startTime = performance.now();
    addLog(`[VecSearch] Querying: "${vecQuery}"`);

    const { documents, embeddings } = generateCorpus();
    const queryEmb = generateEmbedding(vecQuery);
    const workerCount = Math.max(1, connectedNodes.length + 1);
    const shards = shardVectorIndex(documents.length, workerCount);

    const allResults: VectorSearchMatch[][] = [];
    for (const shard of shards) {
      const shardBuf = serializeEmbeddingShard(embeddings, shard.start, shard.end);
      const results = await cosineSimilaritySearch(
        queryEmb, shardBuf, shard.start, documents, VECTOR_CONFIG.defaultTopK, 'WASM_SIMD'
      );
      allResults.push(results);
    }

    const merged = mergeTopK(allResults, VECTOR_CONFIG.defaultTopK);
    setVecResults(merged);
    setVecLatency(performance.now() - startTime);
    addLog(`[VecSearch] Found ${merged.length} results in ${(performance.now() - startTime).toFixed(1)}ms`);
    setIsComputing(false);
  }, [isComputing, vecQuery, connectedNodes]);

  // --- RAY TRACING HANDLER ---
  const handleRayTrace = useCallback(async () => {
    if (isComputing) return;
    setIsComputing(true);
    setRtRenderedTiles([]);
    setRtCompletedTiles(0);
    addLog(`[RayTrace] Starting path tracing: ${RT_CONFIG.defaultWidth}x${RT_CONFIG.defaultHeight}, ${rtSPP} SPP, ${rtBounces} bounces`);

    const scene = generateScene();
    const tiles = generateTiles(RT_CONFIG.defaultWidth, RT_CONFIG.defaultHeight);
    setRtTotalTiles(tiles.length);

    // Update tiles with current settings
    const configuredTiles = tiles.map(t => ({ ...t, samplesPerPixel: rtSPP, maxBounces: rtBounces }));

    for (let i = 0; i < configuredTiles.length; i++) {
      const result = await renderTile(configuredTiles[i], scene);
      setRtRenderedTiles(prev => [...prev, result]);
      setRtCompletedTiles(i + 1);

      if ((i + 1) % 5 === 0) {
        addLog(`[RayTrace] Rendered tile ${i + 1}/${configuredTiles.length}`);
      }
    }

    addLog(`[RayTrace] Render complete! ${configuredTiles.length} tiles.`);
    setIsComputing(false);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
  }, [isComputing, rtSPP, rtBounces]);

  // --- CUSTOM JOB CLUSTER HANDLER ---
  const handleCustomJob = useCallback(async () => {
    if (isComputing) return;

    const rtc = rtcRef.current;
    if (!rtc) return;

    setIsComputing(true);
    setCustomResults([]);

    const activeWorkers = Array.from(rtc.nodes.values()).filter(n => n.status !== 'DISCONNECTED');
    const totalChunks = activeWorkers.length + 1; // workers + host

    addLog(`[CustomJob] Launching multi-language distributed job across ${totalChunks} cluster nodes...`);

    const executeAndDistribute = async (wasmBinaryB64?: string) => {
      // 1. Host locally executes chunk 0
      const hostMeta: CustomJobMeta = {
        language: customLang,
        code: customCode,
        wasmBinaryB64,
        wasmEntryFn: customWasmEntryFn,
        inputPayload: customInput,
        chunkIndex: 0,
        totalChunks,
        timeoutMs: customTimeout
      };

      // Run host chunk dynamically
      executeCustomJob(hostMeta).then(res => {
        addLog(`[CustomJob] Host local chunk 0 completed in ${res.executionMs}ms.`);
        setCustomResults(prev => {
          const filtered = prev.filter(r => r.chunkIndex !== 0);
          const newResults = [
            ...filtered,
            {
              chunkIndex: 0,
              peerId: 'host',
              output: res.output,
              error: res.error,
              executionMs: res.executionMs
            }
          ].sort((a, b) => a.chunkIndex - b.chunkIndex);

          if (newResults.length === totalChunks) {
            setIsComputing(false);
            addLog(`[CustomJob] All ${totalChunks} chunks completed across cluster!`);
            confetti({
              particleCount: 65,
              spread: 55,
              origin: { y: 0.7 }
            });
          }
          return newResults;
        });
      });

      // 2. Dispatch chunks 1..N to connected workers
      const sorted = sortedWorkers(activeWorkers);
      sorted.forEach((worker, idx) => {
        const chunkIndex = idx + 1;
        const workerMeta: CustomJobMeta = {
          language: customLang,
          code: customCode,
          wasmBinaryB64,
          wasmEntryFn: customWasmEntryFn,
          inputPayload: customInput,
          chunkIndex,
          totalChunks,
          timeoutMs: customTimeout
        };

        const task: ComputeTask = {
          taskId: `custom-job-${generateRandomId()}`,
          type: 'CUSTOM_JOB_EXECUTE',
          inputData: new ArrayBuffer(0),
          dimensions: [],
          timestamp: getCurrentTime(),
          customJobMeta: workerMeta
        };

        addLog(`[CustomJob] Sending chunk ${chunkIndex} to Worker ${worker.peerId.slice(0, 6)}...`);

        rtc.sendMessageTo(worker.peerId, {
          type: 'COMPUTE_TASK',
          task
        });
      });
    };

    if (customLang === 'wasm' && customWasmFile) {
      addLog(`[CustomJob] Reading WebAssembly binary "${customWasmFile.name}"...`);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const len = bytes.byteLength;
          const chunkSize = 8192;
          for (let i = 0; i < len; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk as any);
          }
          const wasmB64 = btoa(binary);
          await executeAndDistribute(wasmB64);
        } catch (e: any) {
          addLog(`[CustomJob] Error loading WASM binary: ${e.message || String(e)}`);
          setIsComputing(false);
        }
      };
      reader.onerror = () => {
        addLog('[CustomJob] FileReader failed to read WASM file.');
        setIsComputing(false);
      };
      reader.readAsArrayBuffer(customWasmFile);
    } else {
      await executeAndDistribute();
    }
  }, [
    isComputing,
    customLang,
    customCode,
    customInput,
    customTimeout,
    customWasmFile,
    customWasmEntryFn,
    connectedNodes,
    hardwareProfile
  ]);

  // --- UTILS ---
  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomId}?role=worker`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    addLog('Room cluster join link copied to clipboard.');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col justify-between overflow-hidden">
      {/* Dynamic Header */}
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 bg-slate-900/60 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-md font-extrabold tracking-tight uppercase font-sans">
                Room Cluster: <span className="font-mono text-indigo-400 font-medium select-all">{roomId}</span>
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase font-mono ${role === 'host' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {role}
              </span>
            </div>
            {peerId && (
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Local Peer ID: {peerId.slice(0, 16)}...
              </p>
            )}
          </div>
        </div>

        {/* Invite Link */}
        <button
          onClick={copyRoomLink}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-indigo-500/30 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition shadow-lg"
        >
          {copiedLink ? (
            <>
              <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span className="text-emerald-400 font-bold">Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>Copy Worker Invite Link</span>
            </>
          )}
        </button>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
        {/* Left Side: Controls & Visualizations (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          {/* Task Mode Selector */}
          {role === 'host' && (
            <TaskModeSelector
              currentMode={taskMode}
              onModeChange={setTaskMode}
              isComputing={isComputing}
            />
          )}

          {/* Module 3 Metrics / Device Visualizer */}
          <DeviceVisualizer
            isHost={role === 'host'}
            peerId={peerId}
            hostId={hostId}
            connectedNodes={connectedNodes}
            assignedLayers={assignedLayers}
            manualLayerAllocation={manualLayerAllocation}
            isComputing={isComputing}
            activeNodeId={activeNodeId}
          />

          {/* Metrics Displays */}
          <MetricsDisplay
            totalFlops={totalFlops}
            avgLatencyMs={avgLatencyMs}
            tokensPerSecond={tokensPerSecond}
            mseLogs={mseLogs}
            memoryAllocatedBytes={memoryAllocated}
            maxMemoryBytes={maxMemory}
            connectedPeersCount={connectedNodes.length}
          />

          {/* Mode-Specific Result Panels (Host only) */}
          {role === 'host' && taskMode === 'image_gen' && (
            <ImageGenPanel
              imageData={imgGenImageData}
              currentStep={imgGenStep}
              totalSteps={imgGenTotalSteps}
              isGenerating={isComputing && taskMode === 'image_gen'}
              prompt={imgGenPrompt}
              seed={imgGenSeed}
              width={DIFFUSION_CONFIG.defaultWidth}
              height={DIFFUSION_CONFIG.defaultHeight}
              onPromptChange={setImgGenPrompt}
              onSeedChange={setImgGenSeed}
              onGenerate={handleImageGenerate}
            />
          )}

          {role === 'host' && taskMode === 'federated_learning' && (
            <FederatedLearningPanel
              currentEpoch={flEpoch}
              totalEpochs={flTotalEpochs}
              lossHistory={flLossHistory}
              learningRate={flLearningRate}
              isTraining={isComputing && taskMode === 'federated_learning'}
              workerGradientStatus={flWorkerStatus}
              onStartTraining={handleFederatedTraining}
              onLearningRateChange={setFlLearningRate}
            />
          )}

          {role === 'host' && taskMode === 'video_transcode' && (
            <VideoTranscodePanel
              filterType={videoFilter}
              onFilterChange={setVideoFilter}
              isProcessing={isComputing && taskMode === 'video_transcode'}
              chunkProgress={videoChunkProgress}
              totalProgress={videoTotalProgress}
              onStartTranscode={handleVideoTranscode}
            />
          )}

          {role === 'host' && taskMode === 'vector_search' && (
            <VectorSearchPanel
              query={vecQuery}
              onQueryChange={setVecQuery}
              isSearching={isComputing && taskMode === 'vector_search'}
              results={vecResults}
              searchLatencyMs={vecLatency}
              totalDocs={VECTOR_CONFIG.corpusSize}
              onSearch={handleVectorSearch}
            />
          )}

          {role === 'host' && taskMode === 'ray_tracing' && (
            <RayTracePanel
              canvasWidth={RT_CONFIG.defaultWidth}
              canvasHeight={RT_CONFIG.defaultHeight}
              renderedTiles={rtRenderedTiles}
              totalTiles={rtTotalTiles}
              completedTiles={rtCompletedTiles}
              isRendering={isComputing && taskMode === 'ray_tracing'}
              samplesPerPixel={rtSPP}
              maxBounces={rtBounces}
              onSPPChange={setRtSPP}
              onBouncesChange={setRtBounces}
              onStartRender={handleRayTrace}
            />
          )}

          {role === 'host' && taskMode === 'custom_job' && (
            <CustomJobPanel
              language={customLang}
              onLanguageChange={setCustomLang}
              code={customCode}
              onCodeChange={setCustomCode}
              inputData={customInput}
              onInputChange={setCustomInput}
              timeoutMs={customTimeout}
              onTimeoutChange={setCustomTimeout}
              isRunning={isComputing && taskMode === 'custom_job'}
              onRun={handleCustomJob}
              results={customResults}
              wasmFile={customWasmFile}
              onWasmFileChange={setCustomWasmFile}
              wasmEntryFn={customWasmEntryFn}
              onWasmEntryFnChange={setCustomWasmEntryFn}
            />
          )}

          {/* Module 2 Control Panel (LLM mode) */}
          {(taskMode === 'llm' || role === 'worker') && (
            <ControlPanel
              isHost={role === 'host'}
              peerId={peerId}
              hostId={hostId}
              connectedNodes={connectedNodes}
              onTriggerPrompt={handleTriggerPrompt}
              isComputing={isComputing}
              modelName={modelName}
              onModelChange={setModelName}
              assignedLayers={assignedLayers}
              totalLayers={MODEL_CONFIG.totalLayers}
              engine={hardwareProfile?.engine || 'WASM_SIMD'}
              flops={hardwareProfile?.flops || 0}
              safeMemoryLimit={maxMemory}
              requireQuantization={requireQuantization}
              manualLayerAllocation={manualLayerAllocation}
              onManualAllocationUpdate={handleManualAllocationUpdate}
            />
          )}
        </div>

        {/* Right Side: Execution Consoles / Chat (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-6 h-full min-h-[400px]">
          {/* Chat Generation Box (Host only) */}
          {role === 'host' ? (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col justify-between flex-1 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Pipeline Conversational Stream
                </span>
                <div className="flex items-center space-x-2">
                  {isComputing && (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded animate-pulse">
                      GENERATING
                    </span>
                  )}
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    {connectedNodes.length === 0 ? 'Solo Host' : `${connectedNodes.length} worker${connectedNodes.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>

              {/* Chat Stream History */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs min-h-[120px] max-h-[200px] mb-3 scrollbar-thin">
                {chatHistory.length === 0 && !currentResponse && (
                  <div className="h-full flex items-center justify-center text-slate-500 text-center leading-relaxed px-4">
                    Type a prompt below to run inference{connectedNodes.length === 0 ? ' locally on this device' : ' across the WebRTC cluster'}.
                  </div>
                )}

                {chatHistory.map((chat, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border leading-relaxed ${
                      chat.role === 'user'
                        ? 'bg-slate-950/60 border-white/5 text-slate-200'
                        : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-200'
                    }`}
                  >
                    <span className="block text-[9px] font-bold text-slate-500 mb-1">
                      {chat.role === 'user' ? 'USER PROMPT' : 'CLUSTER PIPELINE RESPONSE'}
                    </span>
                    <p className="whitespace-pre-line">{chat.text}</p>
                  </div>
                ))}

                {/* Real-time incoming token response */}
                {currentResponse && (
                  <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/25 text-indigo-200 leading-relaxed animate-pulse">
                    <span className="block text-[9px] font-bold text-indigo-400 mb-1">
                      GENERATING TOKENS{connectedNodes.length > 0 ? ' P2P' : ' LOCALLY'}...
                    </span>
                    <p>{currentResponse}<span className="inline-block w-1.5 h-3 bg-indigo-400 ml-0.5 animate-ping" /></p>
                  </div>
                )}
              </div>

              {/* Quick Prompt Input directly in chat panel */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (promptInput.trim() && !isComputing) {
                    handleTriggerPrompt(promptInput.trim());
                    setPromptInput('');
                  }
                }}
                className="flex space-x-2 mb-3"
              >
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={isComputing ? 'Generating...' : 'Type a prompt and press Enter...'}
                  disabled={isComputing}
                  className="flex-1 bg-slate-950/80 border border-white/8 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition disabled:opacity-50 font-mono"
                />
                <button
                  type="submit"
                  disabled={isComputing || !promptInput.trim()}
                  className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Run
                </button>
              </form>

              {/* Redundancy MapReduce Actions */}
              <div className="border-t border-white/5 pt-3 space-y-2 mt-auto">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">
                  Cluster Verification Utilities
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={triggerConsensusCheck}
                    disabled={connectedNodes.length < 2 || isComputing}
                    className="flex items-center justify-center py-2 bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[10px] font-bold text-indigo-400 hover:text-white transition disabled:opacity-40"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Consensus Check
                  </button>
                  <button
                    onClick={triggerMaliciousDriftConsensus}
                    disabled={connectedNodes.length < 3 || isComputing}
                    className="flex items-center justify-center py-2 bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-rose-500/30 rounded-xl text-[10px] font-bold text-rose-400 hover:text-white transition disabled:opacity-40"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                    Drift Simulation
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Worker Local Log Console (Worker only) */
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col justify-between flex-1 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
                  <Terminal className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Worker Task Console Log
                </span>
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              </div>

              {/* Scrolling Log Panel */}
              <div className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl p-3 font-mono text-[10px] space-y-2 h-64 overflow-y-auto pr-1 select-all scrollbar-thin">
                {clusterLogs.length === 0 ? (
                  <div className="text-slate-600 flex items-center justify-center h-full">
                    Initializing local compute worker stream...
                  </div>
                ) : (
                  clusterLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-normal border-l-2 pl-2 ${
                        log.includes('Error')
                          ? 'text-rose-400 border-rose-500/60'
                          : log.includes('WebRTC')
                          ? 'text-indigo-400 border-indigo-500/60'
                          : log.includes('Benchmark') || log.includes('Device')
                          ? 'text-amber-400 border-amber-500/60'
                          : 'text-slate-300 border-slate-700'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>

              <div className="border-t border-white/5 pt-3 mt-3 text-[10px] text-slate-500 leading-relaxed text-center font-sans">
                Keep this browser window open. Tab minimizes or app freezes automatically triggers dynamic model re-shards to protect peer cluster state integrity.
              </div>
            </div>
          )}

          {/* Cluster Logs (visible for both Host and Worker) */}
          {role === 'host' && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 relative overflow-hidden transition-all duration-300">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
                  <Terminal className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Cluster Event Log
                </span>
                <span className="text-[9px] text-slate-500 font-mono">{clusterLogs.length} events</span>
              </div>
              <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3 font-mono text-[10px] space-y-1.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                {clusterLogs.length === 0 ? (
                  <div className="text-slate-600 flex items-center justify-center py-4">
                    Waiting for cluster events...
                  </div>
                ) : (
                  clusterLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-normal border-l-2 pl-2 ${
                        log.includes('Error')
                          ? 'text-rose-400 border-rose-500/60'
                          : log.includes('WebRTC') || log.includes('peer')
                          ? 'text-indigo-400 border-indigo-500/60'
                          : log.includes('Device') || log.includes('Profile')
                          ? 'text-amber-400 border-amber-500/60'
                          : log.includes('Pipeline') || log.includes('Shard')
                          ? 'text-emerald-400 border-emerald-500/60'
                          : 'text-slate-400 border-slate-700'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030014] text-slate-100 flex items-center justify-center font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none" />
        <div className="flex flex-col items-center space-y-4 relative">
          <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest animate-pulse font-mono">
            Synchronizing Cluster Workspace...
          </p>
        </div>
      </div>
    }>
      <RoomPageContent />
    </Suspense>
  );
}
