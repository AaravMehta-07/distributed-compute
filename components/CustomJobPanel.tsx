'use client';

import React, { useState, useEffect } from 'react';
import { 
  Code2, Play, Loader2, Terminal, Upload, 
  AlertCircle, Share2, FolderOpen, FileCode, Plus, 
  Trash2, FileText, Info
} from 'lucide-react';
import { CustomJobLanguage } from '../types/network';

interface CustomJobPanelProps {
  language: CustomJobLanguage;
  onLanguageChange: (lang: CustomJobLanguage) => void;
  code: string;
  onCodeChange: (code: string) => void;
  inputData: string;
  onInputChange: (input: string) => void;
  timeoutMs: number;
  onTimeoutChange: (ms: number) => void;
  isRunning: boolean;
  onRun: () => void;
  results: Array<{ chunkIndex: number; peerId: string; output: string; error?: string; executionMs: number }>;
  wasmFile: File | null;
  onWasmFileChange: (file: File | null) => void;
  wasmEntryFn: string;
  onWasmEntryFnChange: (fn: string) => void;

  // New multi-file / folder properties
  projectFiles: Record<string, string>;
  onProjectFilesChange: (files: Record<string, string>) => void;
  mainEntrypoint: string;
  onMainEntrypointChange: (entry: string) => void;
  envParams: Record<string, string>;
  onEnvParamsChange: (params: Record<string, string>) => void;
  isFolderMode: boolean;
  onIsFolderModeChange: (isFolder: boolean) => void;
}

const PRESETS = [
  {
    id: 'mc_pi',
    name: 'Monte Carlo π (JavaScript)',
    language: 'javascript',
    input: '1000000',
    code: `// Monte Carlo estimation of Pi
// Each worker computes a segment of samples
const samples = input || 1000000;
let inside = 0;

for (let i = 0; i < samples; i++) {
  const x = Math.random();
  const y = Math.random();
  if (x * x + y * y <= 1) {
    inside++;
  }
}

const piEstimate = (4 * inside) / samples;
emit({ 
  piEstimate, 
  inside, 
  samples, 
  chunkIndex 
});`
  },
  {
    id: 'primes',
    name: 'Prime Sieve (JavaScript)',
    language: 'javascript',
    input: '{"totalRange": 200000}',
    code: `// Find prime numbers in a range assigned to this chunk
const totalRange = input.totalRange || 200000;
const chunkSize = Math.floor(totalRange / totalChunks);
const start = chunkIndex * chunkSize;
const end = start + chunkSize;

const primes = [];
for (let i = Math.max(2, start); i < end; i++) {
  let isPrime = true;
  const limit = Math.sqrt(i);
  for (let j = 2; j <= limit; j++) {
    if (i % j === 0) {
      isPrime = false;
      break;
    }
  }
  if (isPrime) primes.push(i);
}

emit({ 
  range: [start, end], 
  primeCount: primes.length, 
  samplePrimes: primes.slice(0, 10) 
});`
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci Series (Python)',
    language: 'python',
    input: '80',
    code: `# Compute Fibonacci numbers for index range in Python
n = input_data or 80

def fibonacci(num):
    if num <= 0: return 0
    if num == 1: return 1
    a, b = 0, 1
    for _ in range(2, num + 1):
        a, b = b, a + b
    return b

# Segment the computation range
step = n // total_chunks
start = chunk_index * step
end = start + step

results = {}
for i in range(start, end):
    results[i] = fibonacci(i)
    
print(f"Python worker computed fibonacci indices {start} to {end-1}")
results # Last expression is returned as output`
  },
  {
    id: 'matrix_mult',
    name: 'Matrix Multiply (JavaScript)',
    language: 'javascript',
    input: JSON.stringify({
      A: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]],
      B: [[1, 2, 3], [4, 5, 6]]
    }, null, 2),
    code: `// Distributed row-block matrix multiplication
const { A, B } = input;
const rowsA = A.length;
const colsA = A[0].length;
const colsB = B[0].length;

// Determine rows to compute for this chunk
const rowsPerChunk = Math.ceil(rowsA / totalChunks);
const startRow = chunkIndex * rowsPerChunk;
const endRow = Math.min(rowsA, startRow + rowsPerChunk);

const outRows = [];
for (let i = startRow; i < endRow; i++) {
  const row = [];
  for (let j = 0; j < colsB; j++) {
    let sum = 0;
    for (let k = 0; k < colsA; k++) {
      sum += A[i][k] * B[k][j];
    }
    row.push(sum);
  }
  outRows.push({ rowIndex: i, data: row });
}

emit({ 
  startRow, 
  endRow, 
  outRows 
});`
  },
  {
    id: 'word_freq',
    name: 'Word Frequency (Python)',
    language: 'python',
    input: JSON.stringify([
      "NexusCompute represents the next leap in zero-install distributed computing models.",
      "By using WebRTC, standard web browser clients can form high performance compute clusters.",
      "Parallel execution inside isolated Web Workers runs Python, JS, or WebAssembly natively.",
      "No guardrails, full peer network orchestration, high performance power preferences."
    ], null, 2),
    code: `# Word count inside string sharded payloads
shards = input_data
if not shards or len(shards) <= chunk_index:
    print(f"No text shard allocated for worker {chunk_index}")
    word_counts = {}
else:
    text = shards[chunk_index]
    words = text.lower().split()
    word_counts = {}
    for w in words:
        w = w.strip('.,!?;:"()[]{}')
        if w:
            word_counts[w] = word_counts.get(w, 0) + 1
    print(f"Processed {len(words)} words on chunk {chunk_index}")

word_counts`
  },
  {
    id: 'bruteforce',
    name: 'Hash Collision Bruteforce (JavaScript)',
    language: 'javascript',
    input: JSON.stringify({ targetHashEndsWith: '77', salt: 'nexus' }, null, 2),
    code: `// Parallel search for a rolling hash suffix collision
const target = input.targetHashEndsWith || "77";
const salt = input.salt || "nexus";

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

// Each worker searches a distinct space of integer offsets
const rangeSize = 500000;
const start = chunkIndex * rangeSize;
const end = start + rangeSize;

const collisions = [];
for (let i = start; i < end; i++) {
  const attempt = salt + i;
  const hash = simpleHash(attempt);
  if (hash.endsWith(target)) {
    collisions.push({ value: attempt, hash });
  }
}

emit({ 
  range: [start, end], 
  collisions 
});`
  },
  {
    id: 'blank_js',
    name: 'Blank JavaScript Template',
    language: 'javascript',
    input: '{"data": [1, 2, 3]}',
    code: `// Available globals:
// input - parsed JSON input data
// chunkIndex - this worker's chunk index (0 to totalChunks - 1)
// totalChunks - total chunks across all nodes
// emit(result) - function to yield result back

const out = input.data.map(x => x * (chunkIndex + 1));
emit(out);`
  },
  {
    id: 'blank_py',
    name: 'Blank Python Template',
    language: 'python',
    input: '{"data": [1, 2, 3]}',
    code: `# Available globals:
# input_data - parsed Python dict/list
# chunk_index - this worker's chunk index
# total_chunks - total chunks across all nodes
# Return value of last expression is the result

output = [x * (chunk_index + 1) for x in input_data.get('data', [])]
print(f"Processed {len(output)} elements in Python")
output`
  }
];

export const CustomJobPanel: React.FC<CustomJobPanelProps> = ({
  language,
  onLanguageChange,
  code,
  onCodeChange,
  inputData,
  onInputChange,
  timeoutMs,
  onTimeoutChange,
  isRunning,
  onRun,
  results,
  wasmFile,
  onWasmFileChange,
  wasmEntryFn,
  onWasmEntryFnChange,

  projectFiles,
  onProjectFilesChange,
  mainEntrypoint,
  onMainEntrypointChange,
  envParams,
  onEnvParamsChange,
  isFolderMode,
  onIsFolderModeChange
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('mc_pi');
  const [activeFile, setActiveFile] = useState<string>('');
  const [newEnvKey, setNewEnvKey] = useState<string>('');
  const [newEnvVal, setNewEnvVal] = useState<string>('');
  const [showShareToast, setShowShareToast] = useState<boolean>(false);

  // Set default active file when projectFiles updates or changes modes
  useEffect(() => {
    const files = Object.keys(projectFiles);
    if (files.length > 0 && (!activeFile || !projectFiles[activeFile])) {
      // Prefer the main entrypoint if it exists in the tree
      if (mainEntrypoint && projectFiles[mainEntrypoint]) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveFile(mainEntrypoint);
      } else {
        setActiveFile(files[0]);
      }
    }
  }, [projectFiles, mainEntrypoint, activeFile]);

  // Handle preset dropdown change
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PRESETS.find(p => p.id === presetId);
    if (preset) {
      onLanguageChange(preset.language as CustomJobLanguage);
      onCodeChange(preset.code);
      onInputChange(preset.input);
    }
  };

  // Switch custom mode languages manually
  const handleLanguageChange = (lang: CustomJobLanguage) => {
    onLanguageChange(lang);
    if (lang === 'wasm') {
      setSelectedPreset('wasm_uploaded');
    } else {
      const match = PRESETS.find(p => p.language === lang);
      if (match) {
        setSelectedPreset(match.id);
        onCodeChange(match.code);
        onInputChange(match.input);
      }
    }
  };

  // Directory / Folder upload helper
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    const newProjectFiles: Record<string, string> = {};
    let detectedEntrypoint = '';

    const ignoreDirs = ['node_modules', '.git', '.next', '__pycache__', 'venv', '.venv', '.vscode', 'dist', 'build'];
    const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.py', '.txt', '.md', '.html', '.css', '.mjs', '.cjs'];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const relativePath = file.webkitRelativePath || file.name;
      
      const pathParts = relativePath.split('/');
      const shouldIgnore = pathParts.some(part => ignoreDirs.includes(part));
      if (shouldIgnore) continue;

      // Remove the very first parent directory segment to get root-relative paths
      const cleanedPath = pathParts.slice(1).join('/');
      if (!cleanedPath) continue;

      const fileExt = '.' + cleanedPath.split('.').pop()?.toLowerCase();
      const isText = textExtensions.includes(fileExt);
      if (!isText) continue;

      try {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        newProjectFiles[cleanedPath] = text;

        if (!detectedEntrypoint) {
          const name = cleanedPath.toLowerCase();
          if (name === 'main.py' || name === 'index.js' || name === 'main.js' || name === 'app.js' || name === 'run.py') {
            detectedEntrypoint = cleanedPath;
          }
        }
      } catch (err) {
        console.error("Failed to read file:", cleanedPath, err);
      }
    }

    if (Object.keys(newProjectFiles).length === 0) {
      alert("No compatible source code files found in the uploaded directory.");
      return;
    }

    if (!detectedEntrypoint) {
      const rootFiles = Object.keys(newProjectFiles).filter(p => !p.includes('/'));
      if (rootFiles.length > 0) {
        const codeFile = rootFiles.find(p => p.endsWith('.js') || p.endsWith('.py'));
        detectedEntrypoint = codeFile || rootFiles[0];
      } else {
        detectedEntrypoint = Object.keys(newProjectFiles)[0];
      }
    }

    onProjectFilesChange(newProjectFiles);
    onMainEntrypointChange(detectedEntrypoint);
    setActiveFile(detectedEntrypoint);
    onIsFolderModeChange(true);

    // Auto-detect and switch language based on entrypoint extension
    if (detectedEntrypoint.endsWith('.py')) {
      onLanguageChange('python');
    } else if (detectedEntrypoint.endsWith('.js') || detectedEntrypoint.endsWith('.ts')) {
      onLanguageChange('javascript');
    }
  };

  // Add environment variable helper
  const handleAddEnv = () => {
    if (!newEnvKey.trim()) return;
    onEnvParamsChange({
      ...envParams,
      [newEnvKey.trim()]: newEnvVal.trim()
    });
    setNewEnvKey('');
    setNewEnvVal('');
  };

  const handleRemoveEnv = (key: string) => {
    const copy = { ...envParams };
    delete copy[key];
    onEnvParamsChange(copy);
  };

  // Trigger custom Web Share invitation link
  const handleShareSession = async () => {
    const inviteUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my NexusCompute Cluster',
          text: 'Connect your device to pool GPU/CPU power instantly!',
          url: inviteUrl
        });
        return;
      } catch {
        // Fallback
      }
    }
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Aggregate results renderer
  const renderAggregatedResults = () => {
    if (results.length === 0) return null;

    try {
      const parsedOutputs = results.map(r => {
        try {
          return {
            chunk: r.chunkIndex,
            peerId: r.peerId,
            data: JSON.parse(r.output),
            executionMs: r.executionMs
          };
        } catch {
          return {
            chunk: r.chunkIndex,
            peerId: r.peerId,
            data: r.output,
            executionMs: r.executionMs
          };
        }
      });

      if (!isFolderMode && selectedPreset === 'mc_pi') {
        let totalSamples = 0;
        let totalInside = 0;
        parsedOutputs.forEach(o => {
          if (o.data && typeof o.data === 'object') {
            totalSamples += o.data.samples || 0;
            totalInside += o.data.inside || 0;
          }
        });
        const finalPi = totalSamples > 0 ? (4 * totalInside) / totalSamples : 0;
        return (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-1.5 text-xs text-slate-300">
            <span className="font-semibold text-orange-400">Aggregated Monte Carlo Result</span>
            <div>Total Samples: <strong className="font-mono text-white">{totalSamples.toLocaleString()}</strong></div>
            <div>Inside Circle: <strong className="font-mono text-white">{totalInside.toLocaleString()}</strong></div>
            <div>Calculated Pi: <strong className="font-mono text-orange-300 text-sm">{finalPi.toFixed(7)}</strong></div>
            <div className="text-[10px] text-slate-500">Error: {(Math.abs(finalPi - Math.PI) / Math.PI * 100).toFixed(5)}%</div>
          </div>
        );
      }

      if (!isFolderMode && selectedPreset === 'primes') {
        let totalPrimesCount = 0;
        let allSamplePrimes: number[] = [];
        parsedOutputs.forEach(o => {
          if (o.data && typeof o.data === 'object') {
            totalPrimesCount += o.data.primeCount || 0;
            if (o.data.samplePrimes) {
              allSamplePrimes = allSamplePrimes.concat(o.data.samplePrimes);
            }
          }
        });
        return (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-1.5 text-xs text-slate-300">
            <span className="font-semibold text-orange-400">Aggregated Primes Sieve Result</span>
            <div>Total Primes Found: <strong className="font-mono text-white">{totalPrimesCount.toLocaleString()}</strong></div>
            <div className="line-clamp-2">
              Sample Primes: <strong className="font-mono text-slate-200">[{allSamplePrimes.slice(0, 30).join(', ')}...]</strong>
            </div>
          </div>
        );
      }

      return (
        <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3 space-y-1.5 text-xs">
          <span className="font-semibold text-slate-400 block border-b border-white/5 pb-1">Aggregated Output</span>
          <pre className="text-[10px] text-slate-300 font-mono max-h-[140px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(parsedOutputs.map(o => ({ chunk: o.chunk, output: o.data })), null, 2)}
          </pre>
        </div>
      );
    } catch {
      return (
        <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3 text-[10px] font-mono text-slate-300 max-h-[120px] overflow-y-auto">
          {results.map(r => `Chunk ${r.chunkIndex}: ${r.output}`).join('\n')}
        </div>
      );
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -z-10" />

      {/* Header and Quick Share Panel */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <Code2 className="w-3.5 h-3.5 mr-1.5 text-orange-400" /> Job Submission Portal
        </span>
        <div className="flex items-center space-x-2">
          {/* Share Invitation Button */}
          <button
            onClick={handleShareSession}
            className="px-2.5 py-1 bg-slate-950/60 hover:bg-slate-900 border border-white/10 rounded-lg text-[9px] text-orange-400 font-semibold hover:border-orange-500/30 transition flex items-center shadow-sm relative group"
            title="Send cluster session invite link to other devices"
          >
            <Share2 className="w-3 h-3 mr-1 text-orange-400 shrink-0" />
            Share Cluster Invite
            
            {showShareToast && (
              <span className="absolute -bottom-7 right-0 bg-emerald-500/90 text-white font-medium text-[8px] px-2 py-0.5 rounded shadow-lg animate-bounce z-50 flex items-center whitespace-nowrap">
                Invite Link Copied!
              </span>
            )}
          </button>
          
          {isRunning && (
            <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded animate-pulse flex items-center">
              <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> RUNNING CLUSTER JOB
            </span>
          )}
        </div>
      </div>

      {/* Mode Switches & Language Selectors */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Language Mode</label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as CustomJobLanguage)}
            disabled={isRunning}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-orange-500/40 transition disabled:opacity-50 font-medium"
          >
            <option value="javascript">JavaScript (CommonJS)</option>
            <option value="python">Python 3.11 (Pyodide)</option>
            <option value="wasm">WebAssembly (.wasm)</option>
          </select>
        </div>
        
        <div className="col-span-2">
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Submission Type</label>
          <div className="grid grid-cols-2 gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => onIsFolderModeChange(false)}
              disabled={isRunning || language === 'wasm'}
              className={`py-1 rounded-md text-[9px] font-bold transition flex items-center justify-center ${
                !isFolderMode && language !== 'wasm'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-2.5 h-2.5 mr-1 shrink-0" />
              Single Script
            </button>
            <button
              onClick={() => onIsFolderModeChange(true)}
              disabled={isRunning || language === 'wasm'}
              className={`py-1 rounded-md text-[9px] font-bold transition flex items-center justify-center ${
                isFolderMode && language !== 'wasm'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-2.5 h-2.5 mr-1 shrink-0" />
              Project Folder
            </button>
          </div>
        </div>
      </div>

      {/* Editor & Folder Upload Section */}
      {language === 'wasm' ? (
        /* WebAssembly file upload interface */
        <div className="space-y-3 bg-slate-950/50 border border-white/5 rounded-xl p-3">
          <div className="flex flex-col items-center justify-center border border-dashed border-white/15 rounded-lg p-5 hover:border-orange-500/30 transition bg-slate-950/30 relative">
            <Upload className="w-6 h-6 text-slate-500 mb-2" />
            <span className="text-[10px] text-slate-300 font-medium text-center">
              {wasmFile ? wasmFile.name : 'Upload WebAssembly (.wasm) file'}
            </span>
            <span className="text-[8px] text-slate-500 text-center mt-1">
              {wasmFile ? `${(wasmFile.size / 1024).toFixed(1)} KB` : 'C / C++ / Rust / Go / Zig compiled binaries'}
            </span>
            <input
              type="file"
              accept=".wasm"
              onChange={(e) => onWasmFileChange(e.target.files?.[0] || null)}
              disabled={isRunning}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Export Function</label>
              <input
                type="text"
                value={wasmEntryFn}
                onChange={(e) => onWasmEntryFnChange(e.target.value)}
                placeholder="run"
                disabled={isRunning}
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-orange-500/40 transition font-mono"
              />
            </div>
            <div className="flex items-center text-[8px] text-slate-500 space-x-1.5 leading-relaxed pt-3">
              <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>
                Function signature must support: <br />
                <code className="text-slate-300 font-mono">fn(chunk, total, [ptr, len])</code>
              </span>
            </div>
          </div>
        </div>
      ) : !isFolderMode ? (
        /* Legacy Single File Text Editor */
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold uppercase px-0.5">
            <span>Code Editor</span>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              disabled={isRunning}
              className="bg-transparent text-slate-400 border border-white/5 rounded px-1.5 py-0.5 focus:outline-none focus:border-orange-500/30 transition text-[9px]"
            >
              {PRESETS.filter(p => p.language === language).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder={`// Write your ${language} code here...`}
            disabled={isRunning}
            rows={8}
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl p-3 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-orange-500/40 transition disabled:opacity-50 leading-relaxed resize-y"
          />
        </div>
      ) : (
        /* Project Folder Portal View (VFS Browser + Editor) */
        <div className="space-y-2">
          {/* File Input Directory Zone */}
          <div className="flex items-center justify-between bg-slate-950/60 p-2 border border-white/10 rounded-xl">
            <div className="flex items-center space-x-2">
              <FolderOpen className="w-4 h-4 text-orange-400 shrink-0" />
              <div className="text-[10px] text-slate-300 font-bold truncate max-w-[180px]">
                {Object.keys(projectFiles).length} project files mounted
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <label
                className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 rounded-lg text-[9px] font-bold transition cursor-pointer flex items-center shadow-inner"
                title="Upload full project directory folder"
              >
                <Upload className="w-2.5 h-2.5 mr-1" />
                Upload Folder
                <input
                  id="portal-folder-input"
                  type="file"
                  multiple
                  onChange={handleFolderUpload}
                  disabled={isRunning}
                  className="hidden"
                  {...{
                    webkitdirectory: "",
                    directory: ""
                  } as unknown as React.InputHTMLAttributes<HTMLInputElement>}
                />
              </label>
            </div>
          </div>

          {/* VFS Sidebar & Editor Split Workspace */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[260px]">
            {/* VFS Explorer List */}
            <div className="md:col-span-1 bg-slate-950/80 border border-white/10 rounded-xl p-2 overflow-y-auto flex flex-col space-y-1 h-full min-h-[80px] scrollbar-thin">
              <span className="text-[8px] font-bold text-slate-500 tracking-wider uppercase block px-1 mb-1">Files Browser</span>
              {Object.keys(projectFiles).sort().map(filepath => {
                const pathParts = filepath.split('/');
                const filename = pathParts.pop();
                const dirPrefix = pathParts.join('/');
                const isSelected = activeFile === filepath;
                const isMain = mainEntrypoint === filepath;
                
                return (
                  <button
                    key={filepath}
                    onClick={() => setActiveFile(filepath)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[9px] font-mono flex items-center justify-between group transition truncate ${
                      isSelected 
                        ? 'bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <span className="truncate flex items-center">
                      <FileText className={`w-3 h-3 mr-1 shrink-0 ${isSelected ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                      <span className="truncate">
                        {dirPrefix && <span className="text-slate-600 text-[8px]">{dirPrefix}/</span>}
                        {filename}
                      </span>
                    </span>
                    {isMain && (
                      <span className="text-[7px] bg-orange-500/20 text-orange-300 px-1 py-0.2 rounded font-sans shrink-0 uppercase tracking-widest scale-90 border border-orange-500/20 font-bold">
                        Main
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* In-App Editable Textarea Panel */}
            <div className="md:col-span-3 flex flex-col h-full bg-slate-950/85 border border-white/10 rounded-xl relative overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-slate-950 text-[9px] text-slate-400 font-mono">
                <span className="truncate flex items-center">
                  <FileCode className="w-3.5 h-3.5 mr-1.5 text-slate-500 shrink-0" />
                  editing: <strong className="text-slate-200 ml-1">{activeFile || '(none)'}</strong>
                </span>
                <span className="text-slate-600 text-[8px]">
                  {(projectFiles[activeFile]?.length || 0).toLocaleString()} chars
                </span>
              </div>
              
              <textarea
                value={projectFiles[activeFile] || ''}
                onChange={(e) => {
                  if (activeFile) {
                    const copy = { ...projectFiles };
                    copy[activeFile] = e.target.value;
                    onProjectFilesChange(copy);
                  }
                }}
                disabled={isRunning || !activeFile}
                placeholder={activeFile ? `// Write file content for ${activeFile}...` : "// Choose a file on the left sidebar browser to edit or upload a folder..."}
                className="w-full flex-1 p-3 text-[10px] text-slate-300 font-mono focus:outline-none bg-transparent resize-none leading-relaxed overflow-y-auto"
              />
            </div>
          </div>

          {/* Settings and Entrypoint selectors */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-2 border border-white/5 rounded-xl">
            <div>
              <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Main Execution Entrypoint</label>
              <select
                value={mainEntrypoint}
                onChange={(e) => onMainEntrypointChange(e.target.value)}
                disabled={isRunning}
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-orange-500/40 transition"
              >
                {Object.keys(projectFiles).map(filepath => (
                  <option key={filepath} value={filepath}>{filepath}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-1.5 text-[8.5px] text-slate-500 leading-normal pt-2">
              <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>
                Select which script file executes as the primary entry point across worker device VMs.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Custom Environment Variable Parameters & Setup Details */}
      {isFolderMode && language !== 'wasm' && (
        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-3 space-y-2">
          <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block">
            Environment Variable Parameters (`process.env` / `os.environ`)
          </span>
          
          {/* Key-Value Pair Inputs */}
          <div className="grid grid-cols-3 gap-1">
            <input
              type="text"
              placeholder="Name (e.g. DATA_API)"
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              disabled={isRunning}
              className="bg-slate-950/80 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-orange-500/40"
            />
            <input
              type="text"
              placeholder="Value"
              value={newEnvVal}
              onChange={(e) => setNewEnvVal(e.target.value)}
              disabled={isRunning}
              className="bg-slate-950/80 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-orange-500/40"
            />
            <button
              onClick={handleAddEnv}
              disabled={isRunning || !newEnvKey.trim()}
              className="py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg text-[9px] font-bold transition flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Variable
            </button>
          </div>

          {/* Active Env parameters mapping */}
          {Object.keys(envParams).length > 0 ? (
            <div className="grid grid-cols-2 gap-1 max-h-[80px] overflow-y-auto pt-1">
              {Object.entries(envParams).map(([key, val]) => (
                <div key={key} className="bg-slate-950 border border-white/5 rounded-lg px-2 py-1 flex items-center justify-between text-[9px] font-mono leading-none">
                  <span className="truncate">
                    <strong className="text-orange-300">{key}</strong>: <span className="text-slate-300">{val}</span>
                  </span>
                  <button
                    onClick={() => handleRemoveEnv(key)}
                    disabled={isRunning}
                    className="text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[8px] text-slate-600 block italic">
              No custom environment variables mapped. Click Add to define.
            </span>
          )}
        </div>
      )}

      {/* Input payload & runtime configs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Input Payload (JSON or string value)</label>
          <textarea
            value={inputData}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="[1, 2, 3] or JSON payload..."
            disabled={isRunning}
            rows={2}
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-orange-500/40 transition disabled:opacity-50 leading-normal resize-none"
          />
        </div>
        <div>
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Timeout (Seconds)</label>
          <input
            type="number"
            value={timeoutMs / 1000}
            onChange={(e) => onTimeoutChange(Math.max(1, parseInt(e.target.value) || 1) * 1000)}
            min={1}
            max={180}
            disabled={isRunning}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-orange-500/40 transition disabled:opacity-50 font-mono"
          />
          <div className="mt-2">
            <button
              onClick={onRun}
              disabled={isRunning || (language === 'wasm' && !wasmFile) || (isFolderMode && Object.keys(projectFiles).length === 0)}
              className="w-full py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-40 flex items-center justify-center whitespace-nowrap shadow-lg shadow-orange-950/20"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Run Chunks
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cluster Output Terminal */}
      {results.length > 0 && (
        <div className="border-t border-white/5 pt-3.5 space-y-3.5">
          <span className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase flex items-center">
            <Terminal className="w-3 h-3 mr-1 text-orange-400" /> Cluster Diagnostics & Output
          </span>

          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {results.map((r, i) => (
              <div key={i} className="flex flex-col bg-slate-950/70 border border-white/5 rounded-lg p-2 text-[9px] font-mono leading-normal">
                <div className="flex items-center justify-between text-slate-500 mb-1 border-b border-white/5 pb-0.5">
                  <span className="font-semibold text-slate-400">
                    Chunk {r.chunkIndex} ({r.peerId === 'host' ? 'Host (Local)' : `Worker ${r.peerId.slice(0, 6)}`})
                  </span>
                  <span>{r.executionMs}ms</span>
                </div>
                {r.error ? (
                  <span className="text-red-400 whitespace-pre-wrap">{r.error}</span>
                ) : (
                  <span className="text-slate-300 whitespace-pre-wrap">{r.output}</span>
                )}
              </div>
            ))}
          </div>

          {/* Aggregate View */}
          {renderAggregatedResults()}
        </div>
      )}
    </div>
  );
};

export default CustomJobPanel;
