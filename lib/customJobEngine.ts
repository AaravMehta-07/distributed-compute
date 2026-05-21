// ═══════════════════════════════════════════════════════════════
//  NEXUSCOMPUTE — CUSTOM JOB MULTI-LANGUAGE EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════

import { CustomJobMeta } from '../types/network';

/**
 * Main dispatcher to run a custom job chunk.
 * Safely executes JavaScript, Python (via Pyodide), or WASM in an isolated Worker thread.
 */
export async function executeCustomJob(
  meta: CustomJobMeta
): Promise<{ output: string; error?: string; executionMs: number }> {
  const startTime = performance.now();
  let result: { output: string; error?: string };

  try {
    switch (meta.language) {
      case 'javascript':
        result = await executeJavaScript(meta);
        break;
      case 'python':
        result = await executePython(meta);
        break;
      case 'wasm':
        result = await executeWasm(meta);
        break;
      default:
        throw new Error(`Unsupported custom job language: ${meta.language}`);
    }
  } catch (err: any) {
    result = { output: '', error: err.message || String(err) };
  }

  const executionMs = Math.round(performance.now() - startTime);
  return {
    output: result.output,
    error: result.error,
    executionMs,
  };
}

/**
 * Runs user JavaScript code inside a dynamic Web Worker.
 */
function executeJavaScript(meta: CustomJobMeta): Promise<{ output: string; error?: string }> {
  const workerCode = `
    self.onmessage = async function(e) {
      const { code, inputPayload, chunkIndex, totalChunks } = e.data;
      try {
        const input = JSON.parse(inputPayload);
        let emitted = false;
        let outputVal = null;
        
        function emit(result) {
          emitted = true;
          outputVal = result;
          self.postMessage({ 
            type: 'result', 
            output: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result) 
          });
        }
        
        // Dynamic evaluation context
        const run = new Function('input', 'chunkIndex', 'totalChunks', 'emit', \`
          try {
            \${code}
          } catch(e) {
            throw e;
          }
        \`);
        
        const returnedValue = run(input, chunkIndex, totalChunks, emit);
        
        // If code did not call emit() explicitly but returned a value, use that
        if (!emitted) {
          if (returnedValue !== undefined) {
            emit(returnedValue);
          } else {
            throw new Error("Job completed but did not call emit() or return a value.");
          }
        }
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message || String(err) });
      }
    };
  `;

  return runInWorker(workerCode, meta, meta.timeoutMs);
}

/**
 * Runs user Python code using Pyodide in a CDN-powered Web Worker.
 */
function executePython(meta: CustomJobMeta): Promise<{ output: string; error?: string }> {
  const workerCode = `
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
    
    self.onmessage = async function(e) {
      const { code, inputPayload, chunkIndex, totalChunks } = e.data;
      try {
        self.postMessage({ type: 'status', message: 'Loading Python Pyodide runtime...' });
        const pyodide = await loadPyodide({
          stdout: (text) => {
            self.postMessage({ type: 'stdout', text });
          }
        });
        
        self.postMessage({ type: 'status', message: 'Setting up input variables...' });
        pyodide.globals.set('input_data_json', inputPayload);
        pyodide.globals.set('chunk_index', chunkIndex);
        pyodide.globals.set('total_chunks', totalChunks);
        
        await pyodide.runPythonAsync(\`
import json
input_data = json.loads(input_data_json)
        \`);
        
        self.postMessage({ type: 'status', message: 'Executing Python job...' });
        
        // Set up buffer to collect prints
        let prints = [];
        pyodide.setStdout({
          batched: (str) => { prints.push(str); }
        });

        const pyResult = await pyodide.runPythonAsync(code);
        
        let outputStr = "";
        if (pyResult !== undefined && pyResult !== null) {
          if (typeof pyResult.toJs === 'function') {
            outputStr = JSON.stringify(pyResult.toJs(), null, 2);
          } else {
            outputStr = String(pyResult);
          }
        } else if (prints.length > 0) {
          outputStr = prints.join('\\n');
        } else {
          outputStr = "Python script executed successfully with no output.";
        }
        
        self.postMessage({ type: 'result', output: outputStr });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message || String(err) });
      }
    };
  `;

  return runInWorker(workerCode, meta, meta.timeoutMs);
}

/**
 * Decodes base64 WASM binary, instantiates and executes it inside a Web Worker.
 */
function executeWasm(meta: CustomJobMeta): Promise<{ output: string; error?: string }> {
  const workerCode = `
    self.onmessage = async function(e) {
      const { wasmBinaryB64, entryFn, inputPayload, chunkIndex, totalChunks } = e.data;
      try {
        if (!wasmBinaryB64) {
          throw new Error("No WebAssembly binary provided.");
        }
        
        self.postMessage({ type: 'status', message: 'Decoding base64 WebAssembly...' });
        const binaryString = atob(wasmBinaryB64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        let prints = [];
        let instance = null;
        
        const importObject = {
          env: {
            print: (ptr, length) => {
              try {
                const mem = new Uint8Array(instance.exports.memory.buffer);
                const slice = mem.slice(ptr, ptr + length);
                const text = new TextDecoder().decode(slice);
                prints.push(text);
              } catch (e) {
                prints.push("[print error]");
              }
            },
            console_log: (val) => {
              prints.push(String(val));
            }
          }
        };
        
        self.postMessage({ type: 'status', message: 'Instantiating WASM...' });
        const wasmModule = await WebAssembly.instantiate(bytes.buffer, importObject);
        instance = wasmModule.instance;
        
        const fn = instance.exports[entryFn];
        if (typeof fn !== 'function') {
          throw new Error("Export function '" + entryFn + "' not found in WASM module. Available exports: " + Object.keys(instance.exports).join(', '));
        }
        
        // Pass JSON input if WASM memory & malloc exists
        let ptr = 0;
        let inputLen = 0;
        const inputBytes = new TextEncoder().encode(inputPayload);
        inputLen = inputBytes.length;
        
        if (instance.exports.memory && typeof instance.exports.malloc === 'function') {
          ptr = instance.exports.malloc(inputLen);
          const mem = new Uint8Array(instance.exports.memory.buffer);
          mem.set(inputBytes, ptr);
        } else if (instance.exports.memory && typeof instance.exports.alloc === 'function') {
          ptr = instance.exports.alloc(inputLen);
          const mem = new Uint8Array(instance.exports.memory.buffer);
          mem.set(inputBytes, ptr);
        } else if (instance.exports.memory) {
          // Fallback to offset 0
          const mem = new Uint8Array(instance.exports.memory.buffer);
          if (mem.length >= inputLen) {
            mem.set(inputBytes, 0);
            ptr = 0;
          }
        }
        
        self.postMessage({ type: 'status', message: 'Executing WASM entrypoint...' });
        let result;
        if (instance.exports.memory) {
          result = fn(chunkIndex, totalChunks, ptr, inputLen);
        } else {
          result = fn(chunkIndex, totalChunks);
        }
        
        let outputStr = "";
        if (result !== undefined && result !== null) {
          outputStr = String(result);
        } else if (prints.length > 0) {
          outputStr = prints.join('\\n');
        } else {
          outputStr = "WASM completed with return code: 0";
        }
        
        self.postMessage({ type: 'result', output: outputStr });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message || String(err) });
      }
    };
  `;

  return runInWorker(workerCode, meta, meta.timeoutMs);
}

/**
 * Orchestrates worker execution, timeout handling, and cleanup.
 */
function runInWorker(
  workerCode: string,
  messageData: any,
  timeoutMs: number
): Promise<{ output: string; error?: string }> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let timer: any = null;
    let resolved = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (worker) {
        worker.terminate();
        worker = null;
      }
    };

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ output: '', error: `Execution timed out after ${timeoutMs}ms.` });
        }
      }, timeoutMs);

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'result') {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ output: msg.output });
          }
        } else if (msg.type === 'error') {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ output: '', error: msg.error });
          }
        } else if (msg.type === 'status') {
          // Optional: we can redirect statuses to console or handle them if needed
        }
      };

      worker.onerror = (err) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ output: '', error: err.message || 'Unknown Web Worker execution error' });
        }
      };

      worker.postMessage(messageData);
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ output: '', error: err.message || String(err) });
      }
    }
  });
}

/**
 * Splits a numeric range or index count evenly across N workers.
 */
export function splitWorkload(totalItems: number, workerCount: number): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  if (workerCount <= 0 || totalItems <= 0) return [];
  
  const chunkSize = Math.floor(totalItems / workerCount);
  const remainder = totalItems % workerCount;

  let current = 0;
  for (let i = 0; i < workerCount; i++) {
    const size = chunkSize + (i < remainder ? 1 : 0);
    if (size === 0) break;
    chunks.push({
      start: current,
      end: current + size - 1,
    });
    current += size;
  }
  return chunks;
}
