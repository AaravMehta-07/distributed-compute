'use client';

import React from 'react';
import { Film, Play } from 'lucide-react';
import { VideoFilterType } from '../lib/videoTranscoderEngine';

interface VideoTranscodePanelProps {
  filterType: VideoFilterType;
  onFilterChange: (filter: VideoFilterType) => void;
  isProcessing: boolean;
  chunkProgress: Array<{ chunkIndex: number; peerId: string; progress: number; status: 'pending' | 'processing' | 'done' }>;
  totalProgress: number;
  onStartTranscode: () => void;
}

const FILTERS: Array<{ id: VideoFilterType; label: string; color: string }> = [
  { id: 'blur', label: 'Gaussian Blur', color: 'text-blue-400' },
  { id: 'sharpen', label: 'Sharpen', color: 'text-orange-400' },
  { id: 'grayscale', label: 'Grayscale', color: 'text-slate-300' },
  { id: 'color_grade', label: 'Color Grade', color: 'text-purple-400' },
  { id: 'edge_detect', label: 'Edge Detect', color: 'text-cyan-400' },
];

export const VideoTranscodePanel: React.FC<VideoTranscodePanelProps> = ({
  filterType,
  onFilterChange,
  isProcessing,
  chunkProgress,
  totalProgress,
  onStartTranscode,
}) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <Film className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Video Transcode Pipeline
        </span>
        {isProcessing && (
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded animate-pulse">
            PROCESSING {Math.round(totalProgress)}%
          </span>
        )}
      </div>

      {/* Filter Selector */}
      <div>
        <label className="text-[9px] text-slate-500 block mb-1 font-semibold uppercase">GPU Filter Type</label>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => !isProcessing && onFilterChange(f.id)}
              disabled={isProcessing}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition ${
                filterType === f.id
                  ? `${f.color} bg-white/5 border-white/15`
                  : 'text-slate-500 border-white/5 hover:text-slate-300 hover:border-white/10'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStartTranscode}
        disabled={isProcessing}
        className="w-full flex items-center justify-center py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-[10px] font-bold transition disabled:opacity-40"
      >
        <Play className="w-3 h-3 mr-1" />
        {isProcessing ? 'Transcoding...' : 'Start Distributed Transcode'}
      </button>

      {/* Total Progress */}
      {isProcessing && (
        <div className="w-full bg-slate-950/60 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      )}

      {/* Chunk Progress */}
      {chunkProgress.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] text-slate-500 font-semibold uppercase">Chunk Distribution</span>
          {chunkProgress.map((c, i) => (
            <div key={i} className="flex items-center space-x-2 text-[9px]">
              <span className="font-mono text-slate-500 w-12">Chunk {c.chunkIndex}</span>
              <div className="flex-1 bg-slate-950/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    c.status === 'done' ? 'bg-emerald-500' :
                    c.status === 'processing' ? 'bg-emerald-400 animate-pulse' :
                    'bg-slate-700'
                  }`}
                  style={{ width: `${c.progress}%` }}
                />
              </div>
              <span className="font-mono text-slate-500 w-12 text-right">{c.peerId.slice(0, 6)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-slate-500 text-center">
        Simulated 320×240 • 150 frames • {filterType} filter • Distributed across WebRTC peers
      </div>
    </div>
  );
};

export default VideoTranscodePanel;
