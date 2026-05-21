'use client';

import React from 'react';
import { GraduationCap, Play, TrendingDown } from 'lucide-react';

interface FederatedLearningPanelProps {
  currentEpoch: number;
  totalEpochs: number;
  lossHistory: number[];
  learningRate: number;
  isTraining: boolean;
  workerGradientStatus: Array<{ peerId: string; status: 'waiting' | 'computing' | 'done'; loss?: number }>;
  onStartTraining: () => void;
  onLearningRateChange: (lr: number) => void;
}

export const FederatedLearningPanel: React.FC<FederatedLearningPanelProps> = ({
  currentEpoch,
  totalEpochs,
  lossHistory,
  learningRate,
  isTraining,
  workerGradientStatus,
  onStartTraining,
  onLearningRateChange,
}) => {
  // SVG loss curve
  const maxLoss = Math.max(...lossHistory, 0.01);
  const chartW = 280;
  const chartH = 80;
  const points = lossHistory.map((loss, i) => {
    const x = (i / Math.max(1, lossHistory.length - 1)) * chartW;
    const y = chartH - (loss / maxLoss) * chartH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -z-10" />

      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Federated LoRA Training
        </span>
        {isTraining && (
          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded animate-pulse">
            EPOCH {currentEpoch}/{totalEpochs}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex space-x-2">
        <div className="flex-1">
          <label className="text-[9px] text-slate-500 block mb-0.5">Learning Rate</label>
          <input
            type="number"
            value={learningRate}
            onChange={(e) => onLearningRateChange(parseFloat(e.target.value) || 0.001)}
            step={0.0001}
            disabled={isTraining}
            className="w-full bg-slate-950/80 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-amber-500/40 transition disabled:opacity-50"
          />
        </div>
        <div className="flex-1 flex items-end">
          <button
            onClick={onStartTraining}
            disabled={isTraining}
            className="w-full flex items-center justify-center py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-40"
          >
            <Play className="w-3 h-3 mr-1" />
            {isTraining ? 'Training...' : 'Start Training'}
          </button>
        </div>
      </div>

      {/* Loss Curve */}
      <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-slate-500 font-semibold uppercase flex items-center">
            <TrendingDown className="w-3 h-3 mr-1 text-amber-400" /> Training Loss Curve
          </span>
          {lossHistory.length > 0 && (
            <span className="text-[9px] text-amber-300 font-mono">
              Loss: {lossHistory[lossHistory.length - 1]?.toFixed(6)}
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-20">
          <defs>
            <linearGradient id="lossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(245,158,11)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(245,158,11)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {lossHistory.length > 1 && (
            <>
              <polygon
                points={`0,${chartH} ${points} ${chartW},${chartH}`}
                fill="url(#lossGrad)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="rgb(245,158,11)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {lossHistory.length === 0 && (
            <text x={chartW / 2} y={chartH / 2} textAnchor="middle" fill="#475569" fontSize="10">
              No training data yet
            </text>
          )}
        </svg>
      </div>

      {/* Worker Gradient Status */}
      {workerGradientStatus.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] text-slate-500 font-semibold uppercase">Worker Gradient Status</span>
          {workerGradientStatus.map((w, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-lg px-2 py-1 text-[9px]">
              <span className="font-mono text-slate-400">{w.peerId.slice(0, 8)}...</span>
              <div className="flex items-center space-x-2">
                {w.loss !== undefined && (
                  <span className="text-amber-300 font-mono">loss: {w.loss.toFixed(4)}</span>
                )}
                <span className={`px-1.5 py-0.5 rounded ${
                  w.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                  w.status === 'computing' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {w.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FederatedLearningPanel;
