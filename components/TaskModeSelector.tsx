'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Image, GraduationCap, Film, Search, Box, Code2 } from 'lucide-react';
import { TaskMode } from '../types/network';

interface TaskModeSelectorProps {
  currentMode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
  isComputing: boolean;
}

const MODES: Array<{
  id: TaskMode;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgGlow: string;
  description: string;
}> = [
  {
    id: 'llm',
    label: 'LLM Inference',
    shortLabel: 'LLM',
    icon: Brain,
    color: 'text-indigo-400',
    bgGlow: 'bg-indigo-500/20',
    description: 'Distributed transformer pipeline inference',
  },
  {
    id: 'image_gen',
    label: 'Image Generation',
    shortLabel: 'ImageGen',
    icon: Image,
    color: 'text-fuchsia-400',
    bgGlow: 'bg-fuchsia-500/20',
    description: 'Sharded Stable Diffusion denoising',
  },
  {
    id: 'federated_learning',
    label: 'Federated Learning',
    shortLabel: 'FedLearn',
    icon: GraduationCap,
    color: 'text-amber-400',
    bgGlow: 'bg-amber-500/20',
    description: 'Privacy-preserving distributed LoRA training',
  },
  {
    id: 'video_transcode',
    label: 'Video Transcode',
    shortLabel: 'Video',
    icon: Film,
    color: 'text-emerald-400',
    bgGlow: 'bg-emerald-500/20',
    description: 'GPU-accelerated distributed video processing',
  },
  {
    id: 'vector_search',
    label: 'Vector Search',
    shortLabel: 'VecSearch',
    icon: Search,
    color: 'text-cyan-400',
    bgGlow: 'bg-cyan-500/20',
    description: 'P2P semantic embedding similarity search',
  },
  {
    id: 'ray_tracing',
    label: 'Ray Tracing',
    shortLabel: 'RayTrace',
    icon: Box,
    color: 'text-rose-400',
    bgGlow: 'bg-rose-500/20',
    description: 'Cooperative path tracing 3D render farm',
  },
  {
    id: 'custom_job',
    label: 'Custom Job',
    shortLabel: 'Custom',
    icon: Code2,
    color: 'text-orange-400',
    bgGlow: 'bg-orange-500/20',
    description: 'Run any code in any language across the mesh',
  },
];

export const TaskModeSelector: React.FC<TaskModeSelectorProps> = ({
  currentMode,
  onModeChange,
  isComputing,
}) => {
  const activeIndex = MODES.findIndex(m => m.id === currentMode);

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
      {/* Background glow for active mode */}
      <div className={`absolute top-0 left-0 w-full h-full ${MODES[activeIndex]?.bgGlow || ''} opacity-10 blur-3xl -z-10 transition-all duration-500`} />

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Compute Task Mode
        </h3>
        <span className="text-[9px] text-slate-500 font-mono bg-slate-950/60 px-2 py-0.5 rounded">
          {MODES.find(m => m.id === currentMode)?.description}
        </span>
      </div>

      <div className="relative flex bg-slate-950/60 rounded-xl border border-white/5 p-1">
        {/* Sliding active indicator */}
        <motion.div
          className={`absolute top-1 bottom-1 rounded-lg ${MODES[activeIndex]?.bgGlow || 'bg-indigo-500/20'} border border-white/10`}
          initial={false}
          animate={{
            left: `calc(${(activeIndex / MODES.length) * 100}% + 4px)`,
            width: `calc(${100 / MODES.length}% - 8px)`,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />

        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => !isComputing && onModeChange(mode.id)}
              disabled={isComputing}
              className={`relative z-10 flex-1 flex flex-col items-center py-2 px-1 rounded-lg transition-all duration-200 ${
                isActive
                  ? `${mode.color} font-bold`
                  : 'text-slate-500 hover:text-slate-300'
              } ${isComputing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              title={mode.label}
            >
              <Icon className={`w-4 h-4 mb-1 ${isActive ? 'animate-pulse' : ''}`} />
              <span className="text-[9px] font-semibold tracking-wide whitespace-nowrap">
                {mode.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TaskModeSelector;
