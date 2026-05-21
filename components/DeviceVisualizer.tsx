'use client';

import React from 'react';
import { Cpu, Server, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { NetworkNode } from '../types/network';

interface DeviceVisualizerProps {
  isHost: boolean;
  peerId: string;
  hostId: string;
  connectedNodes: NetworkNode[];
  assignedLayers: [number, number];
  manualLayerAllocation: Record<string, [number, number]>;
  isComputing: boolean;
  activeNodeId: string | null;
}

export const DeviceVisualizer: React.FC<DeviceVisualizerProps> = ({
  isHost,
  peerId,
  hostId,
  connectedNodes,
  assignedLayers,
  manualLayerAllocation,
  isComputing,
  activeNodeId,
}) => {
  // 1. Build the logical pipeline sequence
  // Initiator -> Worker 1 -> Worker 2 -> Worker 3 -> ... -> Initiator
  const pipelineNodes: Array<{
    id: string;
    label: string;
    isHostNode: boolean;
    engine: 'WEBGPU' | 'WASM_SIMD';
    layers: [number, number];
    flops: number;
    x: number;
    y: number;
  }> = [];

  // Constants for SVG calculations
  pipelineNodes.push({
    id: isHost ? peerId : hostId,
    label: isHost ? 'Host Node (You)' : 'Host Orchestrator',
    isHostNode: true,
    engine: 'WEBGPU',
    layers: assignedLayers,
    flops: 15 * 1000 * 1000, // 15 MFLOPS simulated baseline
    x: 80,
    y: 130,
  });

  // Sort workers by their layer start ranges to show accurate forward flow
  const sortedWorkers = [...connectedNodes].sort((a, b) => {
    const rangeA = manualLayerAllocation[a.peerId] || [0, 0];
    const rangeB = manualLayerAllocation[b.peerId] || [0, 0];
    return rangeA[0] - rangeB[0];
  });

  // Calculate dynamic spacing for workers
  const width = 800;
  const paddingX = 100;
  const spacingX = sortedWorkers.length > 0 ? (width - paddingX * 2) / sortedWorkers.length : 300;

  sortedWorkers.forEach((worker, index) => {
    const range = manualLayerAllocation[worker.peerId] || [0, 0];
    pipelineNodes.push({
      id: worker.peerId,
      label: `Worker ${index + 1} (${worker.peerId.slice(0, 5)})`,
      isHostNode: false,
      engine: worker.profile.engine,
      layers: range,
      flops: worker.profile.flops,
      x: paddingX + (index + 1) * spacingX - (sortedWorkers.length === 1 ? 50 : 0),
      y: index % 2 === 0 ? 70 : 190, // Alternate heights to create a wavy premium visual path
    });
  });

  // Connect paths
  const paths: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    isActive: boolean;
    isLoopBack: boolean;
  }> = [];

  for (let i = 0; i < pipelineNodes.length - 1; i++) {
    const from = pipelineNodes[i];
    const to = pipelineNodes[i + 1];
    paths.push({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      isActive: isComputing && (activeNodeId === null || activeNodeId === from.id),
      isLoopBack: false,
    });
  }

  // Draw loopback path from the last worker back to the Host
  if (pipelineNodes.length > 1) {
    const from = pipelineNodes[pipelineNodes.length - 1];
    const to = pipelineNodes[0];
    paths.push({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      isActive: isComputing && (activeNodeId === null || activeNodeId === from.id),
      isLoopBack: true,
    });
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-indigo-500/5 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/20"
    >
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 text-lg">Cluster Topology Map</h3>
            <p className="text-xs text-slate-400">P2P Ordered Data Flow & Shard Ranges</p>
          </div>
        </div>

        {isComputing && (
          <div className="flex items-center text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 animate-pulse">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            <span>Activations streaming P2P...</span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-x-auto select-none py-4">
        <svg
          viewBox="0 0 800 250"
          className="w-full min-w-[650px] h-[220px]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Definitions for gradients and shadows */}
          <defs>
            <filter id="glow-host" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-active" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="grad-active" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="grad-inactive" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>

          {/* SVG Connection Lines */}
          {paths.map((path, idx) => {
            const isVerticalGlow = path.isActive;
            const midX = (path.fromX + path.toX) / 2;
            const midY = (path.fromY + path.toY) / 2;
            
            // Loopback curve calculation (quadratic bezier)
            const dPath = path.isLoopBack
              ? `M ${path.fromX} ${path.fromY} Q ${midX} ${midY + 70} ${path.toX} ${path.toY}`
              : `M ${path.fromX} ${path.fromY} Q ${midX} ${midY - 15} ${path.toX} ${path.toY}`;

            return (
              <g key={idx}>
                {/* Background Shadow Link */}
                <path
                  d={dPath}
                  fill="none"
                  stroke={isVerticalGlow ? '#6366f1' : '#334155'}
                  strokeWidth={isVerticalGlow ? 3 : 1.5}
                  strokeOpacity={isVerticalGlow ? 0.8 : 0.3}
                  className="transition-all duration-300"
                />

                {/* Animated Pulsing Neon Link */}
                {isVerticalGlow && (
                  <path
                    d={dPath}
                    fill="none"
                    stroke="url(#grad-active)"
                    strokeWidth={4}
                    strokeDasharray="12,15"
                    className="animate-flow"
                    style={{
                      strokeLinecap: 'round',
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* SVG Node Points */}
          {pipelineNodes.map((node, i) => {
            const isActive = activeNodeId === node.id || (isComputing && activeNodeId === null);

            return (
              <motion.g 
                key={node.id} 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.1, type: "spring" }}
                className="cursor-pointer group"
              >
                {/* Glowing Aura Ring around Active Node */}
                {isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={32}
                    fill="none"
                    stroke={node.isHostNode ? '#6366f1' : '#10b981'}
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    className="animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                )}

                {/* Node Outer Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={25}
                  fill={isActive ? 'url(#grad-active)' : 'url(#grad-inactive)'}
                  stroke={
                    isActive
                      ? node.isHostNode ? '#818cf8' : '#34d399'
                      : '#475569'
                  }
                  strokeWidth={2}
                  filter={isActive ? 'url(#glow-active)' : undefined}
                  className="transition-all duration-300 group-hover:scale-105"
                />

                {/* Microchip / Server Icon Embed */}
                <g transform={`translate(${node.x - 10}, ${node.y - 10})`} className="pointer-events-none text-white">
                  {node.isHostNode ? (
                    <Server className="w-5 h-5 text-white" />
                  ) : (
                    <Cpu className={`w-5 h-5 ${isActive ? 'text-slate-100' : 'text-slate-400'}`} />
                  )}
                </g>

                {/* Node Label Text */}
                <text
                  x={node.x}
                  y={node.y - 35}
                  textAnchor="middle"
                  fill="#f8fafc"
                  className="text-[11px] font-bold fill-slate-200 font-sans tracking-wide"
                >
                  {node.label}
                </text>

                {/* Assigned Layer Ranges Badge */}
                <rect
                  x={node.x - 45}
                  y={node.y + 32}
                  width={90}
                  height={18}
                  rx={4}
                  fill={isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.6)'}
                  stroke={isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(71, 85, 105, 0.4)'}
                  strokeWidth={1}
                />
                <text
                  x={node.x}
                  y={node.y + 44}
                  textAnchor="middle"
                  fill={isActive ? '#a5b4fc' : '#94a3b8'}
                  className="text-[9px] font-semibold font-mono tracking-tight"
                >
                  Layers {node.layers[0]}-{node.layers[1]}
                </text>

                {/* Subtext: GFLOPS or Engine info on Hover */}
                <text
                  x={node.x}
                  y={node.y + 62}
                  textAnchor="middle"
                  fill="#64748b"
                  className="text-[8px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-sans uppercase"
                >
                  {node.engine} | {(node.flops / 1e6).toFixed(1)} GFLOPS
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* CSS Animation injection for moving neon pulses along paths */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes strokeFlow {
          to {
            stroke-dashoffset: -100;
          }
        }
        .animate-flow {
          animation: strokeFlow 3s linear infinite;
        }
      ` }} />
    </motion.div>
  );
};
export default DeviceVisualizer;
