'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Cpu, Users, ShieldAlert, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WelcomePage() {
  const router = useRouter();
  const [role, setRole] = useState<'host' | 'worker'>('host');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRandomRoomId = () => {
    const nouns = ['nexus', 'core', 'plasma', 'tensor', 'shard', 'matrix', 'node', 'grid'];
    const verbs = ['compute', 'pool', 'flow', 'mesh', 'chain', 'sync', 'warp', 'link'];
    const r1 = nouns[Math.floor(Math.random() * nouns.length)];
    const r2 = verbs[Math.floor(Math.random() * verbs.length)];
    const num = Math.floor(100 + Math.random() * 900);
    setRoomId(`${r1}-${r2}-${num}`);
    setError('');
  };

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) {
      setError('Please enter or generate a Room Cluster ID');
      return;
    }

    setLoading(true);
    // Redirect to the designated room with query role parameter
    router.push(`/room/${roomId.toLowerCase().trim()}?role=${role}`);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#020617] px-4 py-8">
      {/* Decorative Interactive Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] -z-10" />

      {/* Floating stars mockup background */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 -z-20" />

      {/* Top Banner Navigation */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between mb-8 select-none">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-sm text-white shadow-md shadow-indigo-500/30">
            N
          </div>
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-50 to-slate-200 tracking-wider">
            NEXUS<span className="text-indigo-400 font-medium">COMPUTE</span>
          </span>
        </div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-900/60 border border-white/5 px-3 py-1 rounded-full backdrop-blur">
          v1.0.0-Beta (WebGPU)
        </div>
      </header>

      {/* Main Interactive Workspace Content */}
      <main className="max-w-4xl w-full mx-auto flex flex-col items-center justify-center flex-1 my-4">
        {/* Sleek Introductory Title */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-2xl mb-8 space-y-4"
        >
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 rounded-full text-xs text-indigo-300 font-semibold mb-2 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span>Zero-Install Serverless P2P Inference Network</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight font-sans">
            Pool Browser GPU Compute{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-violet-400">
              Entirely Serverless
            </span>
          </h1>

          <p className="text-sm md:text-md text-slate-400 leading-relaxed max-w-lg mx-auto">
            Pool heterogeneous devices (NVIDIA Desktops, MacBooks, Mobile Phones) over WebRTC. Share LLM transformer shards using high-speed WebGPU & WASM SIMD.
          </p>
        </motion.div>

        {/* Console Input Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-indigo-500/5 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/20"
        >
          {/* Subtle glow border */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

          {/* Form Role Toggle */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-white/5 mb-6">
            <button
              onClick={() => {
                setRole('host');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center transition-all ${
                role === 'host'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4 mr-2" />
              Cluster Host
            </button>
            <button
              onClick={() => {
                setRole('worker');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center transition-all ${
                role === 'worker'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Compute Worker
            </button>
          </div>

          {/* Setup description */}
          <p className="text-xs text-slate-400 mb-6 text-center leading-relaxed px-4">
            {role === 'host'
              ? 'Boot up a central coordinator. Allocate transformer layers, submit chat completions, and bridge standard OpenAI tools.'
              : 'Join an active room using a cluster key. Feed activations locally via WebGPU/WASM, and stream back results.'}
          </p>

          <form onSubmit={handleAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Cluster Room ID Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. plasma-mesh-380"
                  className="flex-1 bg-slate-950/90 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={generateRandomRoomId}
                  className="p-3 bg-slate-950 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-xl text-indigo-400 hover:text-white transition flex items-center justify-center"
                  title="Generate Room Cluster Key"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {error && <p className="text-[11px] text-rose-400 mt-2 font-mono flex items-center"><ShieldAlert className="w-3.5 h-3.5 mr-1" /> {error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold text-sm rounded-xl shadow-xl shadow-indigo-500/10 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <span>Booting Cluster Node...</span>
              ) : (
                <span className="flex items-center">
                  {role === 'host' ? 'Create Host Cluster' : 'Connect Worker Node'}
                  <ArrowRight className="w-4 h-4 ml-2 animate-pulse" />
                </span>
              )}
            </button>
          </form>
        </motion.div>

        {/* Info Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mt-16"
        >
          <div className="bg-slate-900/35 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/10 transition">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg w-max mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-200 text-sm mb-1.5">Hybrid WASM & WebGPU</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auto-compiles high-performance WGSL matrix multiplication shaders, falling back dynamically to multi-threaded WASM SIMD.
            </p>
          </div>

          <div className="bg-slate-900/35 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/10 transition">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg w-max mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-200 text-sm mb-1.5">Direct P2P Pipeline</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Layer-shards sequences sequentially. Activations travel browser-to-browser over PeerJS data channels, bypassing the Host server.
            </p>
          </div>

          <div className="bg-slate-900/35 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/10 transition">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg w-max mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-200 text-sm mb-1.5">Redundancy Verification</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Maintains high precision with MSE ($\epsilon &lt; 10^{-5}$) checks. Duplicates workloads, schedules tie-breakers, and blacklists drift peers.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer copyright */}
      <footer className="text-center text-[10px] text-slate-600 mt-8 max-w-md mx-auto select-none border-t border-white/5 pt-4">
        NexusCompute Distributed AI Network • Zero installations required • Standard browser GPU compliant • All matrix math run sandboxed.
      </footer>
    </div>
  );
}
