'use client';

import React, { useState, useEffect } from 'react';
import { Code2, Play, Loader2, Terminal, Settings, Upload, AlertCircle } from 'lucide-react';
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
  onWasmEntryFnChange
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('mc_pi');

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
      // Find first preset matching language
      const match = PRESETS.find(p => p.language === lang);
      if (match) {
        setSelectedPreset(match.id);
        onCodeChange(match.code);
        onInputChange(match.input);
      }
    }
  };

  // Base64 helper for WASM upload representation
  const handleWasmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onWasmFileChange(file);
  };

  // Try parsing results to aggregate them
  const renderAggregatedResults = () => {
    if (results.length === 0) return null;

    try {
      // Determine if JS/Python object result style
      const parsedOutputs = results.map(r => {
        try {
          return {
            chunkIndex: r.chunkIndex,
            peerId: r.peerId,
            data: JSON.parse(r.output),
            executionMs: r.executionMs
          };
        } catch {
          return {
            chunkIndex: r.chunkIndex,
            peerId: r.peerId,
            data: r.output,
            executionMs: r.executionMs
          };
        }
      });

      // Special visual aggregate rendering for Pi, Primes, Word counts, and Hash bruteforce
      if (selectedPreset === 'mc_pi') {
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

      if (selectedPreset === 'primes') {
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

      if (selectedPreset === 'word_freq') {
        const globalFreqs: Record<string, number> = {};
        parsedOutputs.forEach(o => {
          if (o.data && typeof o.data === 'object') {
            Object.entries(o.data).forEach(([word, count]) => {
              globalFreqs[word] = (globalFreqs[word] || 0) + (count as number);
            });
          }
        });
        const sortedWords = Object.entries(globalFreqs).sort((a, b) => b[1] - a[1]);
        return (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-1 text-xs text-slate-300">
            <span className="font-semibold text-orange-400">Aggregated Word Frequency (Top Words)</span>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {sortedWords.slice(0, 9).map(([w, count]) => (
                <div key={w} className="bg-slate-950/60 p-1.5 rounded border border-white/5 font-mono text-[10px] text-center truncate">
                  <span className="text-orange-300">"{w}"</span>: {count}
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (selectedPreset === 'bruteforce') {
        let allCollisions: any[] = [];
        parsedOutputs.forEach(o => {
          if (o.data && Array.isArray(o.data.collisions)) {
            allCollisions = allCollisions.concat(o.data.collisions);
          }
        });
        return (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-1.5 text-xs text-slate-300">
            <span className="font-semibold text-orange-400">Hash Collision Results</span>
            <div>Collisions Discovered: <strong className="font-mono text-orange-300">{allCollisions.length}</strong></div>
            <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1">
              {allCollisions.map((c, i) => (
                <div key={i} className="font-mono text-[10px] bg-slate-950/50 p-1 rounded border border-white/5 flex justify-between">
                  <span>Input: <strong className="text-white">{c.value}</strong></span>
                  <span className="text-slate-500">Hash: {c.hash}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Default stringified payload display
      return (
        <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3 space-y-1.5 text-xs">
          <span className="font-semibold text-slate-400 block border-b border-white/5 pb-1">Aggregated Output</span>
          <pre className="text-[10px] text-slate-300 font-mono max-h-[140px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(parsedOutputs.map(o => ({ chunk: o.chunkIndex, output: o.data })), null, 2)}
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
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3.5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <Code2 className="w-3.5 h-3.5 mr-1.5 text-orange-400" /> Custom Mesh Jobs
        </span>
        {isRunning && (
          <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded animate-pulse flex items-center">
            <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> RUNNING CLUSTER JOB
          </span>
        )}
      </div>

      {/* Pre-selectors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Language Mode</label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as CustomJobLanguage)}
            disabled={isRunning}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-orange-500/40 transition disabled:opacity-50 font-medium"
          >
            <option value="javascript">JavaScript (Web Worker)</option>
            <option value="python">Python 3.11 (Pyodide CDN)</option>
            <option value="wasm">WebAssembly Binary (.wasm)</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Preset Template</label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            disabled={isRunning || language === 'wasm'}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-orange-500/40 transition disabled:opacity-50 font-medium"
          >
            {PRESETS.filter(p => p.language === language).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {language === 'wasm' && (
              <option value="wasm_uploaded">WebAssembly File Upload</option>
            )}
          </select>
        </div>
      </div>

      {/* Dynamic Main Code/Upload Editor */}
      {language !== 'wasm' ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold uppercase px-0.5">
            <span>Code Editor ({language})</span>
            <span className="font-mono lowercase text-slate-600">emits output via return or emit()</span>
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
        <div className="space-y-3.5 bg-slate-950/50 border border-white/5 rounded-xl p-3.5">
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
              onChange={handleWasmUpload}
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
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-orange-500/40 transition font-mono"
              />
            </div>
            <div className="flex items-center text-[9px] text-slate-500 space-x-1.5 leading-relaxed pt-3">
              <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>
                Function signature must support: <br />
                <code className="text-slate-300 font-mono">fn(chunk, total, [ptr, len])</code>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Input payload & runtime configs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-[9px] text-slate-500 block mb-0.5 font-semibold uppercase">Input Payload (JSON or single string value)</label>
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
          <div className="mt-2.5">
            <button
              onClick={onRun}
              disabled={isRunning || (language === 'wasm' && !wasmFile)}
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
                  Run on Cluster
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
