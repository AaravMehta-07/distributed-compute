'use client';

import React, { useState } from 'react';
import { Cpu, Server, Play, Settings, Users, Sparkles, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NetworkNode } from '../types/network';

interface ControlPanelProps {
  isHost: boolean;
  peerId: string;
  hostId: string;
  connectedNodes: NetworkNode[];
  onTriggerPrompt: (prompt: string) => void;
  isComputing: boolean;
  modelName: string;
  onModelChange: (name: string) => void;
  assignedLayers: [number, number];
  totalLayers: number;
  engine: string;
  flops: number;
  safeMemoryLimit: number;
  requireQuantization: boolean;
  manualLayerAllocation: Record<string, [number, number]>;
  onManualAllocationUpdate: (peerId: string, range: [number, number]) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isHost,
  hostId,
  connectedNodes,
  onTriggerPrompt,
  isComputing,
  modelName,
  onModelChange,
  assignedLayers,
  totalLayers,
  engine,
  flops,
  safeMemoryLimit,
  requireQuantization,
  manualLayerAllocation,
  onManualAllocationUpdate,
}) => {
  const [prompt, setPrompt] = useState('Write a high-performance matrix multiplication algorithm in WebGPU.');
  const [showConfig, setShowConfig] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isComputing) {
      onTriggerPrompt(prompt);
    }
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-indigo-500/5 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/20">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-indigo-400 to-violet-300">
              Nexus Orchestration Console
            </h2>
            <p className="text-xs text-slate-400 flex items-center mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isComputing ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-400'}`} />
              {isHost ? 'Active Cluster Initiator Node' : 'Active Compute Participant Worker'}
            </p>
          </div>
        </div>

        {isHost && (
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
            title="Model & Quantization Configuration"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Configuration Section (Expandable) */}
      <AnimatePresence>
        {showConfig && isHost && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-slate-950/50 rounded-xl p-4 border border-white/5 overflow-hidden"
          >
            <h3 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center">
              <Sliders className="w-4 h-4 mr-2" /> Model Configuration Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Cluster Shard Model</label>
                <select
                  value={modelName}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="Nexus-Transformer-0.5B">Nexus-Transformer-0.5B (Simulated/OPFS Cache)</option>
                  <option value="Qwen1.5-0.5B-Chat">Qwen-1.5-0.5B-Chat (ONNX WebGPU Core)</option>
                  <option value="Nexus-Llama-3-8B-INT4">DeepSeek-R1-Distill-1.5B (INT4 Quantized)</option>
                </select>
              </div>
              
              <div className="flex flex-col justify-end">
                <div className="flex items-center space-x-2 text-xs text-slate-400 mt-2 md:mt-0">
                  <span className={`w-3 h-3 rounded-full ${requireQuantization ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span>Memory Capping: Safe limit <strong>{(safeMemoryLimit / (1024 * 1024)).toFixed(0)}MB</strong></span>
                </div>
                {requireQuantization && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    * Dynamic INT4 Quantization active. VRAM buffer constraints exceeded.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host Mode UI */}
      {isHost ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Submit Sequence Prompt to WebRTC Cluster</span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-mono">
                {connectedNodes.length} worker{connectedNodes.length !== 1 ? 's' : ''} connected
              </span>
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter prompt to execute..."
                rows={3}
                disabled={isComputing}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none disabled:opacity-60"
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-slate-500">
                Shift + Enter to submit
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Pool Size: <strong>{(connectedNodes.length + 1)} Nodes</strong></span>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isComputing || connectedNodes.length === 0}
                className="flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play className="w-4 h-4 mr-2" />
                {isComputing ? 'Computing Cluster Shards...' : 'Execute Shards'}
              </button>
            </div>
          </div>

          {/* Dynamic Layer Sharding Overrides */}
          {connectedNodes.length > 0 && (
            <div className="border-t border-white/5 pt-4 mt-4">
              <h3 className="text-xs font-semibold text-indigo-300 mb-3 flex items-center uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 mr-1.5" /> Pipeline Shard Distribution Tuning
              </h3>
              
              <div className="space-y-3">
                {/* Host Node Shard */}
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between text-xs space-y-2 md:space-y-0">
                  <div className="flex items-center space-x-2">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <div>
                      <span className="font-mono text-slate-200">Host (You)</span>
                      <p className="text-[10px] text-slate-500">{engine} | {(flops / 1e6).toFixed(1)} GFLOPS</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-mono text-[10px]">
                      Layers {assignedLayers[0]} - {assignedLayers[1]}
                    </span>
                    <span className="text-slate-400 font-bold">{assignedLayers[1] - assignedLayers[0] + 1} layers</span>
                  </div>
                </div>

                {/* Worker Node Shards */}
                {connectedNodes.map((node) => {
                  const nodeRange = manualLayerAllocation[node.peerId] || [0, 0];
                  
                  return (
                    <div key={node.peerId} className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between text-xs space-y-2 md:space-y-0">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="font-mono text-slate-200">{node.peerId.slice(0, 8)}...</span>
                          <p className="text-[10px] text-slate-500">
                            {node.profile.engine} | {(node.profile.flops / 1e6).toFixed(1)} GFLOPS
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {/* Interactive Sliders for Manual Layer Range Override */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="range"
                            min={0}
                            max={totalLayers - 1}
                            value={nodeRange[0]}
                            onChange={(e) => onManualAllocationUpdate(node.peerId, [parseInt(e.target.value), nodeRange[1]])}
                            className="w-16 accent-indigo-500 h-1 rounded"
                            title="Start Layer"
                          />
                          <input
                            type="range"
                            min={0}
                            max={totalLayers - 1}
                            value={nodeRange[1]}
                            onChange={(e) => onManualAllocationUpdate(node.peerId, [nodeRange[0], parseInt(e.target.value)])}
                            className="w-16 accent-indigo-500 h-1 rounded"
                            title="End Layer"
                          />
                        </div>
                        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono text-[10px]">
                          Layers {nodeRange[0]} - {nodeRange[1]}
                        </span>
                        <span className="text-slate-400 font-bold">{nodeRange[1] - nodeRange[0] + 1} layers</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      ) : (
        /* Worker Mode UI */
        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-950/60 rounded-xl p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-slate-400">Node WebRTC Connection Status</span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs animate-pulse font-mono">
                ACTIVE WORKER
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs py-1">
              <div>
                <span className="text-slate-500">Your Engine</span>
                <p className="font-mono text-slate-200 mt-0.5 flex items-center">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400 mr-1" /> {engine}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Device Model</span>
                <p className="font-semibold text-slate-200 mt-0.5 truncate">{navigator.userAgent.split(' ')[0]} (Node)</p>
              </div>
              <div>
                <span className="text-slate-500">Benchmark Performance</span>
                <p className="font-mono text-slate-200 mt-0.5 font-bold">{(flops / 1e6).toFixed(1)} GFLOPS</p>
              </div>
              <div>
                <span className="text-slate-500">Memory Cap Limit</span>
                <p className="font-mono text-slate-200 mt-0.5 font-bold">{(safeMemoryLimit / (1024 * 1024)).toFixed(0)} MB</p>
              </div>
            </div>
            
            <div className="border-t border-white/5 pt-3">
              <span className="text-xs font-semibold text-slate-400">Target Host Connection ID</span>
              <p className="font-mono text-indigo-300 mt-0.5 select-all text-xs truncate">{hostId}</p>
            </div>
          </div>

          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs flex items-start space-x-3 text-indigo-300 leading-relaxed shadow-inner">
            <Sparkles className="w-5 h-5 flex-shrink-0 text-indigo-400" />
            <div>
              <strong className="text-indigo-200">Listening for Cluster Shard Computations</strong>
              <p className="mt-1 text-slate-400 text-[11px]">
                The Host will automatically allocate a sequence of LLM layers to this browser. Activations will stream here over WebRTC, execute locally via {engine === 'WEBGPU' ? 'WebGPU Storage Shaders' : 'WASM SIMD loops'}, and auto-route P2P to the next node. Keep this tab active!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ControlPanel;
