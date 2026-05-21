'use client';

import React, { useRef, useEffect } from 'react';
import { Box, Play } from 'lucide-react';
import { RayTraceTileMeta } from '../types/network';

interface RayTracePanelProps {
  canvasWidth: number;
  canvasHeight: number;
  renderedTiles: Array<{ pixels: Uint8Array; meta: RayTraceTileMeta }>;
  totalTiles: number;
  completedTiles: number;
  isRendering: boolean;
  samplesPerPixel: number;
  maxBounces: number;
  onSPPChange: (spp: number) => void;
  onBouncesChange: (bounces: number) => void;
  onStartRender: () => void;
}

export const RayTracePanel: React.FC<RayTracePanelProps> = ({
  canvasWidth,
  canvasHeight,
  renderedTiles,
  totalTiles,
  completedTiles,
  isRendering,
  samplesPerPixel,
  maxBounces,
  onSPPChange,
  onBouncesChange,
  onStartRender,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Progressively paint tiles onto canvas
  useEffect(() => {
    if (!canvasRef.current || renderedTiles.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Draw only the latest tile (progressive rendering)
    const latest = renderedTiles[renderedTiles.length - 1];
    if (!latest) return;

    const { pixels, meta } = latest;
    const imgData = ctx.createImageData(meta.tileW, meta.tileH);
    imgData.data.set(pixels);
    ctx.putImageData(imgData, meta.tileX, meta.tileY);
  }, [renderedTiles]);

  // Initialize canvas with black
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }, [canvasWidth, canvasHeight]);

  const progress = totalTiles > 0 ? (completedTiles / totalTiles) * 100 : 0;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -z-10" />

      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <Box className="w-3.5 h-3.5 mr-1.5 text-rose-400" /> Path Tracing Render Farm
        </span>
        {isRendering && (
          <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded animate-pulse">
            TILE {completedTiles}/{totalTiles}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex space-x-2">
        <div className="flex-1">
          <label className="text-[9px] text-slate-500 block mb-0.5">Samples/Pixel</label>
          <input
            type="number"
            value={samplesPerPixel}
            onChange={(e) => onSPPChange(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={32}
            disabled={isRendering}
            className="w-full bg-slate-950/80 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-rose-500/40 transition disabled:opacity-50"
          />
        </div>
        <div className="flex-1">
          <label className="text-[9px] text-slate-500 block mb-0.5">Max Bounces</label>
          <input
            type="number"
            value={maxBounces}
            onChange={(e) => onBouncesChange(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={8}
            disabled={isRendering}
            className="w-full bg-slate-950/80 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-rose-500/40 transition disabled:opacity-50"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={onStartRender}
            disabled={isRendering}
            className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-40 flex items-center whitespace-nowrap"
          >
            <Play className="w-3 h-3 mr-1" />
            {isRendering ? 'Rendering...' : 'Render Scene'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isRendering && (
        <div className="w-full bg-slate-950/60 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Canvas */}
      <div className="flex items-center justify-center bg-slate-950/60 border border-white/5 rounded-xl p-2">
        <canvas
          ref={canvasRef}
          className="max-w-full rounded-lg"
          style={{ imageRendering: 'auto', maxHeight: '220px' }}
        />
      </div>

      <div className="text-[9px] text-slate-500 text-center">
        {canvasWidth}×{canvasHeight} • {samplesPerPixel} SPP • {maxBounces} bounces • 64×64 tiles • Distributed rendering
      </div>
    </div>
  );
};

export default RayTracePanel;
