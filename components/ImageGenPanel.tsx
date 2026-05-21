'use client';

import React, { useRef, useEffect } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';

interface ImageGenPanelProps {
  imageData: ImageData | null;
  currentStep: number;
  totalSteps: number;
  isGenerating: boolean;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  onPromptChange: (prompt: string) => void;
  onSeedChange: (seed: number) => void;
  onGenerate: () => void;
}

export const ImageGenPanel: React.FC<ImageGenPanelProps> = ({
  imageData,
  currentStep,
  totalSteps,
  isGenerating,
  prompt,
  seed,
  width,
  height,
  onPromptChange,
  onSeedChange,
  onGenerate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = imageData.width;
        canvasRef.current.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
      }
    }
  }, [imageData]);

  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 rounded-full blur-3xl -z-10" />

      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-fuchsia-400" /> Stable Diffusion Pipeline
        </span>
        {isGenerating && (
          <span className="text-[9px] bg-fuchsia-500/10 text-fuchsia-400 px-2 py-0.5 rounded animate-pulse">
            DENOISING STEP {currentStep}/{totalSteps}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="A futuristic city skyline at sunset..."
          disabled={isGenerating}
          className="w-full bg-slate-950/80 border border-white/8 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500/40 transition disabled:opacity-50 font-mono"
        />
        <div className="flex space-x-2">
          <div className="flex-1">
            <label className="text-[9px] text-slate-500 block mb-0.5">Seed</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => onSeedChange(parseInt(e.target.value) || 0)}
              disabled={isGenerating}
              className="w-full bg-slate-950/80 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-fuchsia-500/40 transition disabled:opacity-50"
            />
          </div>
          <div className="flex-1 flex items-end">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full flex items-center justify-center py-1.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-40"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isGenerating && (
        <div className="w-full bg-slate-950/60 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Canvas */}
      <div className="flex items-center justify-center bg-slate-950/60 border border-white/5 rounded-xl p-2 min-h-[160px]">
        {imageData ? (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[200px] rounded-lg image-rendering-pixelated"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="text-slate-600 text-[10px] text-center px-4">
            Enter a prompt and click Generate to create an image using the distributed diffusion pipeline
          </div>
        )}
      </div>

      <div className="text-[9px] text-slate-500 text-center">
        {width}×{height} • {totalSteps} denoising steps • Distributed across WebRTC cluster
      </div>
    </div>
  );
};

export default ImageGenPanel;
