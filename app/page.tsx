'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Cpu, Users, ShieldAlert, ArrowRight, Zap,
  RefreshCw, Network, Shield, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════
   FLOATING PARTICLES COMPONENT
   ═══════════════════════════════════════════════ */
const STATIC_PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: `${(i * 2.5 + 7) % 100}%`,
  top: `${(i * 3.7 + 13) % 100}%`,
  size: 1 + (i % 3),
  delay: (i * 0.4) % 8,
  duration: 4 + (i % 5) * 2,
}));

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {STATIC_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-indigo-400/30"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LIVE NETWORK STATS (ANIMATED COUNTERS)
   ═══════════════════════════════════════════════ */
function AnimatedCounter({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let frame = 0;
        const totalFrames = 60;
        const step = () => {
          frame++;
          const progress = frame / totalFrames;
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(target * eased));
          if (frame < totalFrames) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl md:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-400">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-widest">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN WELCOME PAGE
   ═══════════════════════════════════════════════ */
export default function WelcomePage() {
  const router = useRouter();
  const [role, setRole] = useState<'host' | 'worker'>('host');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const heroRef = useRef<HTMLDivElement>(null);

  /* ── Spotlight mouse follow effect ── */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    heroRef.current.style.setProperty('--mouse-x', `${x}%`);
    heroRef.current.style.setProperty('--mouse-y', `${y}%`);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (el) el.addEventListener('mousemove', handleMouseMove);
    return () => { if (el) el.removeEventListener('mousemove', handleMouseMove); };
  }, [handleMouseMove]);

  const generateRandomRoomId = () => {
    const nouns = ['nexus', 'core', 'plasma', 'tensor', 'shard', 'matrix', 'node', 'grid', 'flux', 'pulse'];
    const verbs = ['compute', 'pool', 'flow', 'mesh', 'chain', 'sync', 'warp', 'link', 'forge', 'beam'];
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
    router.push(`/room/${roomId.toLowerCase().trim()}?role=${role}`);
  };

  return (
    <div
      ref={heroRef}
      className="relative min-h-screen flex flex-col overflow-hidden bg-[#030014] spotlight"
    >
      {/* ═══ ANIMATED MESH GRADIENT ORBS ═══ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="mesh-orb-1 absolute -top-40 -left-40 w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="mesh-orb-2 absolute top-1/3 -right-20 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[100px]" />
        <div className="mesh-orb-3 absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-600/6 rounded-full blur-[130px]" />
        <div className="mesh-orb-2 absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[80px]" />
      </div>

      {/* ═══ GRID DOT PATTERN ═══ */}
      <div className="absolute inset-0 grid-dots pointer-events-none -z-10" />

      {/* ═══ FLOATING PARTICLES ═══ */}
      <FloatingParticles />

      {/* ═══════════════════════════════════════════════
           NAVIGATION HEADER
         ═══════════════════════════════════════════════ */}
      <header className="relative z-10 max-w-7xl w-full mx-auto flex items-center justify-between px-6 py-5 select-none">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center space-x-3"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-indigo-500/30">
              N
            </div>
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 opacity-30 blur-md -z-10" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-white">NEXUS</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">COMPUTE</span>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center space-x-3"
        >
          <div className="hidden sm:flex items-center space-x-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="font-bold uppercase tracking-widest">Network Live</span>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-900/60 border border-white/5 px-3 py-1.5 rounded-full backdrop-blur">
            v1.0.0-Beta
          </div>
        </motion.div>
      </header>

      {/* ═══════════════════════════════════════════════
           HERO SECTION
         ═══════════════════════════════════════════════ */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* ── Badge ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6"
        >
          <div className="inline-flex items-center space-x-2 bg-indigo-500/8 border border-indigo-500/15 px-4 py-1.5 rounded-full text-xs backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-indigo-300 font-semibold tracking-wide">Zero-Install Serverless P2P Inference</span>
            <ChevronRight className="w-3 h-3 text-indigo-500" />
          </div>
        </motion.div>

        {/* ── Title ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center max-w-3xl mb-5"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white">
            Pool Browser GPU{' '}
            <br className="hidden md:block" />
            <span className="text-shimmer text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-purple-400">
              Entirely Serverless
            </span>
          </h1>
        </motion.div>

        {/* ── Subtitle ── */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="text-sm md:text-base text-slate-400 leading-relaxed max-w-xl mx-auto text-center mb-10"
        >
          Connect heterogeneous devices — NVIDIA desktops, MacBooks, phones — over
          WebRTC. Shard LLM transformer layers with WebGPU & WASM SIMD. No downloads, no servers.
        </motion.p>

        {/* ═══════════════════════════════════════════════
             MAIN CONSOLE CARD (ANIMATED BORDER)
           ═══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.4, type: 'spring', stiffness: 200 }}
          className="w-full max-w-md relative"
        >
          {/* Glow behind card */}
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-purple-500/10 rounded-[2rem] blur-2xl glow-pulse -z-10" />

          <div className="animated-border rounded-3xl p-6 md:p-8 backdrop-blur-2xl bg-slate-950/80 relative overflow-hidden">
            {/* Top gradient line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
            {/* Corner glow accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />

            {/* ── Role Toggle ── */}
            <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-white/5 mb-6 relative">
              <motion.div
                className="absolute inset-y-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20"
                style={{ width: '50%' }}
                animate={{ x: role === 'host' ? 0 : '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
              <button
                onClick={() => { setRole('host'); setError(''); }}
                className={`relative z-10 flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center transition-colors ${
                  role === 'host' ? 'text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Cpu className="w-4 h-4 mr-2" />
                Cluster Host
              </button>
              <button
                onClick={() => { setRole('worker'); setError(''); }}
                className={`relative z-10 flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center transition-colors ${
                  role === 'worker' ? 'text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                Compute Worker
              </button>
            </div>

            {/* ── Role Description ── */}
            <AnimatePresence mode="wait">
              <motion.p
                key={role}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-xs text-slate-400 mb-6 text-center leading-relaxed px-2"
              >
                {role === 'host'
                  ? 'Boot a central coordinator. Allocate transformer layers, submit chat completions, and bridge standard OpenAI-compatible tools.'
                  : 'Join an active room. Feed activations locally via WebGPU/WASM and stream results directly P2P to other cluster nodes.'}
              </motion.p>
            </AnimatePresence>

            <form onSubmit={handleAction} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                  Cluster Room ID Key
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => { setRoomId(e.target.value); setError(''); }}
                      placeholder="e.g. plasma-mesh-380"
                      className="w-full bg-slate-900/90 border border-white/8 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                    />
                    {roomId && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={generateRandomRoomId}
                    className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-white/8 hover:border-indigo-500/30 rounded-xl text-indigo-400 hover:text-indigo-300 transition group"
                    title="Generate Room Cluster Key"
                  >
                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                  </button>
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-rose-400 mt-2 font-mono flex items-center"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                    {error}
                  </motion.p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full flex items-center justify-center py-3.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:via-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-50 relative overflow-hidden"
              >
                {/* Shine sweep animation */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                {loading ? (
                  <span className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Booting Cluster Node...
                  </span>
                ) : (
                  <span className="flex items-center relative z-10">
                    {role === 'host' ? 'Create Host Cluster' : 'Connect Worker Node'}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>

            {/* ── Subtle bottom hint ── */}
            <p className="text-[10px] text-slate-600 text-center mt-4 leading-relaxed">
              Free to use • No login required • Runs entirely in your browser
            </p>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════
             LIVE NETWORK STATS BAR
           ═══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="max-w-2xl w-full mt-16 grid grid-cols-3 gap-6 px-4"
        >
          <AnimatedCounter target={847} suffix="+" label="Devices Pooled" />
          <AnimatedCounter target={12} suffix=" TB" label="Compute Processed" />
          <AnimatedCounter target={99} suffix=".9%" label="Uptime SLA" />
        </motion.div>

        {/* ═══════════════════════════════════════════════
             FEATURE CARDS (PREMIUM GLASSMORPHISM)
           ═══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full mt-16 px-4"
        >
          {[
            {
              icon: Cpu,
              title: 'LLM Pipeline Inference',
              desc: 'Shard transformer layers across heterogeneous devices. WebGPU compute shaders run real forward passes. Token-by-token generation over WebRTC.',
              gradient: 'from-indigo-500/20 to-indigo-600/5',
              iconColor: 'text-indigo-400',
              borderHover: 'hover:border-indigo-500/20',
            },
            {
              icon: Sparkles,
              title: 'Image Generation',
              desc: 'Distributed Stable Diffusion denoising. U-Net steps split across the cluster with progressive latent grid rendering.',
              gradient: 'from-fuchsia-500/20 to-fuchsia-600/5',
              iconColor: 'text-fuchsia-400',
              borderHover: 'hover:border-fuchsia-500/20',
            },
            {
              icon: Shield,
              title: 'Federated Learning',
              desc: 'Privacy-preserving LoRA finetuning. Workers compute local gradients, Host aggregates via FedAvg. Data never leaves the device.',
              gradient: 'from-amber-500/20 to-amber-600/5',
              iconColor: 'text-amber-400',
              borderHover: 'hover:border-amber-500/20',
            },
            {
              icon: Zap,
              title: 'Video Transcode',
              desc: 'GPU-accelerated distributed video processing. Split frames into chunks, apply filters in parallel, reassemble at the Host.',
              gradient: 'from-emerald-500/20 to-emerald-600/5',
              iconColor: 'text-emerald-400',
              borderHover: 'hover:border-emerald-500/20',
            },
            {
              icon: Network,
              title: 'Vector Search',
              desc: 'P2P distributed semantic search. Shard embedding vectors across browser RAM. WebGPU-accelerated cosine similarity queries.',
              gradient: 'from-cyan-500/20 to-cyan-600/5',
              iconColor: 'text-cyan-400',
              borderHover: 'hover:border-cyan-500/20',
            },
            {
              icon: ChevronRight,
              title: 'Ray Tracing',
              desc: 'Cooperative path tracing render farm. Distribute viewport tiles across workers. Progressive rendering with Monte Carlo sampling.',
              gradient: 'from-rose-500/20 to-rose-600/5',
              iconColor: 'text-rose-400',
              borderHover: 'hover:border-rose-500/20',
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 + i * 0.1 }}
              className={`group relative bg-slate-950/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 ${card.borderHover} transition-all duration-300 hover:-translate-y-1 overflow-hidden cursor-default`}
            >
              {/* Hover gradient wash */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`} />

              <div className={`p-2.5 bg-white/5 ${card.iconColor} rounded-xl w-max mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-100 text-sm mb-2 group-hover:text-white transition-colors">{card.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ═══════════════════════════════════════════════
             ARCHITECTURE VISUAL (ANIMATED SVG)
           ═══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="max-w-3xl w-full mt-16 px-4"
        >
          <div className="relative bg-slate-950/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/3 to-violet-500/3" />
            <div className="flex items-center space-x-2 mb-4">
              <Network className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Network Topology Preview</span>
            </div>

            <svg viewBox="0 0 700 140" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="link-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.8" />
                </linearGradient>
                <filter id="node-glow">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Connection paths */}
              {[
                { x1: 120, y1: 70, x2: 270, y2: 45 },
                { x1: 120, y1: 70, x2: 270, y2: 95 },
                { x1: 270, y1: 45, x2: 430, y2: 45 },
                { x1: 270, y1: 95, x2: 430, y2: 95 },
                { x1: 430, y1: 45, x2: 580, y2: 70 },
                { x1: 430, y1: 95, x2: 580, y2: 70 },
              ].map((l, i) => (
                <g key={i}>
                  <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#334155" strokeWidth="1" strokeOpacity="0.4" />
                  <line
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke="url(#link-grad)" strokeWidth="2"
                    strokeDasharray="8,12" className="animate-flow"
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {/* Nodes */}
              {[
                { cx: 120, cy: 70, label: 'Host', color: '#6366f1', icon: '⬡' },
                { cx: 270, cy: 45, label: 'Worker A', color: '#10b981', icon: '◆' },
                { cx: 270, cy: 95, label: 'Worker B', color: '#10b981', icon: '◆' },
                { cx: 430, cy: 45, label: 'Worker C', color: '#10b981', icon: '◆' },
                { cx: 430, cy: 95, label: 'Worker D', color: '#10b981', icon: '◆' },
                { cx: 580, cy: 70, label: 'Aggregator', color: '#8b5cf6', icon: '⬡' },
              ].map((n, i) => (
                <g key={i}>
                  <circle cx={n.cx} cy={n.cy} r="18" fill={`${n.color}15`} stroke={n.color} strokeWidth="1.5" filter="url(#node-glow)" />
                  <circle cx={n.cx} cy={n.cy} r="5" fill={n.color} opacity="0.9">
                    <animate attributeName="r" values="4;6;4" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                  <text x={n.cx} y={n.cy + 32} textAnchor="middle" fill="#94a3b8" className="text-[9px] font-bold" fontFamily="monospace">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════
             TECHNOLOGY BADGES
           ═══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="flex flex-wrap items-center justify-center gap-3 mt-12 px-4"
        >
          {['WebGPU', 'WASM SIMD', 'WebRTC', 'PeerJS', 'ONNX Runtime', 'Next.js 16'].map((tech) => (
            <span
              key={tech}
              className="text-[10px] font-bold text-slate-500 bg-slate-900/60 border border-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm hover:text-indigo-400 hover:border-indigo-500/20 transition-all cursor-default"
            >
              {tech}
            </span>
          ))}
        </motion.div>
      </main>

      {/* ═══════════════════════════════════════════════
           FOOTER
         ═══════════════════════════════════════════════ */}
      <footer className="relative z-10 text-center py-6 border-t border-white/5">
        <p className="text-[10px] text-slate-600 max-w-lg mx-auto leading-relaxed">
          NexusCompute Distributed AI Network • Zero installations • Standard browser GPU compliant •
          All matrix math sandboxed • Open source
        </p>
      </footer>
    </div>
  );
}
