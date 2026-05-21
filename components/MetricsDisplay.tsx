'use client';

import React from 'react';
import { Activity, Shield, HardDrive, Clock, Terminal } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { MSELog } from '../lib/driftValidator';

interface MetricsDisplayProps {
  totalFlops: number;
  avgLatencyMs: number;
  tokensPerSecond: number;
  mseLogs: MSELog[];
  memoryAllocatedBytes: number;
  maxMemoryBytes: number;
  connectedPeersCount: number;
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  totalFlops,
  avgLatencyMs,
  tokensPerSecond,
  mseLogs,
  memoryAllocatedBytes,
  maxMemoryBytes,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const memPercent = Math.min(100, (memoryAllocatedBytes / Math.max(1, maxMemoryBytes)) * 100);

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-indigo-500/5 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/20"
    >
      {/* Glow effect */}
      <div className="absolute top-0 left-1/4 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      {/* Grid of Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total GFLOPS */}
        <motion.div variants={item} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/10 transition-all duration-200">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cluster Capacity</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-100 font-mono">
              {(totalFlops / 1e6).toFixed(2)}
            </p>
            <span className="text-[10px] text-indigo-300 font-semibold font-mono">GFLOPS Combined</span>
          </div>
        </motion.div>

        {/* Tokens Per Second */}
        <motion.div variants={item} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/10 transition-all duration-200">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Inference Speed</span>
            <Shield className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-100 font-mono">
              {tokensPerSecond.toFixed(1)}
            </p>
            <span className="text-[10px] text-emerald-300 font-semibold font-mono">Tokens / Sec</span>
          </div>
        </motion.div>

        {/* Avg Latency */}
        <motion.div variants={item} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-violet-500/10 transition-all duration-200">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Pipeline Latency</span>
            <Clock className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-100 font-mono">
              {avgLatencyMs.toFixed(0)}<span className="text-sm font-normal text-slate-400">ms</span>
            </p>
            <span className="text-[10px] text-violet-300 font-semibold font-mono">Average Roundtrip</span>
          </div>
        </motion.div>

        {/* Memory Buffer Load */}
        <motion.div variants={item} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/10 transition-all duration-200">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Memory Allocation</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-md font-bold text-slate-100 font-mono mt-1">
              {formatBytes(memoryAllocatedBytes)}
            </p>
            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1.5 overflow-hidden border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${memPercent > 80 ? 'bg-rose-500' : memPercent > 50 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                style={{ width: `${memPercent}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-500 font-semibold mt-1 block">
              Max: {formatBytes(maxMemoryBytes)}
            </span>
          </div>
        </motion.div>
      </div>

      {/* MSE Logging Terminal Console */}
      <div className="bg-slate-950/80 border border-white/10 rounded-xl p-4 relative">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center tracking-wider uppercase">
            <Terminal className="w-4 h-4 mr-2 text-indigo-400" /> MSE Drift Verification Logger
          </span>
          <span className="text-[9px] text-slate-500 font-mono">Tolerance Limit: ε = 10⁻⁵</span>
        </div>

        {/* Terminal Logs */}
        <div className="h-40 overflow-y-auto font-mono text-xs space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800 pr-2">
          {mseLogs.length === 0 ? (
            <div className="text-slate-600 flex items-center justify-center h-full text-[11px] leading-relaxed">
              * Console Idle. Submit a prompt to trigger consensus checks. *
            </div>
          ) : (
            [...mseLogs].reverse().map((log, index) => {
              const formattedMse = log.mse === Infinity ? 'Infinity' : log.mse.toExponential(4);
              const isVerified = log.status === 'VERIFIED';
              const isConflict = log.status === 'CONFLICT';
              const isResolving = log.status === 'RESOLVING';

              return (
                <div
                  key={log.taskId + index}
                  className={`p-2.5 rounded-lg border text-[11px] transition-all duration-300 ${
                    isVerified
                      ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                      : isConflict
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse'
                      : isResolving
                      ? 'bg-amber-500/5 border-amber-500/10 text-amber-300'
                      : 'bg-rose-500/5 border-rose-500/10 text-slate-400'
                  }`}
                >
                  <div className="flex justify-between font-bold border-b border-white/5 pb-1 mb-1">
                    <span>TASK: {log.taskId}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <p className="leading-relaxed">
                    Verify redundant nodes: <span className="underline">{log.peerA.slice(0, 7)}</span> vs{' '}
                    <span className="underline">{log.peerB.slice(0, 7)}</span>
                  </p>

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <span>
                      MSE Result: <strong>{formattedMse}</strong>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-black ${
                        isVerified
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isConflict
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      STATUS: {log.status}
                    </span>
                  </div>

                  {/* Show conflict resolution tiebreaker logs */}
                  {log.tieBreakerPeer && (
                    <div className="mt-2 p-1.5 bg-slate-950/80 border border-white/5 rounded text-amber-400 text-[10px]">
                      ⚡ Scheduled Tie-Breaker Node:{' '}
                      <span className="underline font-bold">{log.tieBreakerPeer.slice(0, 7)}</span>
                    </div>
                  )}

                  {/* Show blacklist announcement */}
                  {log.blacklistedPeer && (
                    <div className="mt-1 p-1.5 bg-rose-500/20 border border-rose-500/30 rounded text-rose-300 font-bold text-[10px]">
                      🚨 ANOMALY SUSPECTED! Blacklisted Peer:{' '}
                      <span className="underline font-mono">{log.blacklistedPeer.slice(0, 7)}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
};
export default MetricsDisplay;
