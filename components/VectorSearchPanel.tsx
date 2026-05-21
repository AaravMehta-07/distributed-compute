'use client';

import React from 'react';
import { Search, Zap } from 'lucide-react';
import { VectorSearchMatch } from '../types/network';

interface VectorSearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  isSearching: boolean;
  results: VectorSearchMatch[];
  searchLatencyMs: number;
  totalDocs: number;
  onSearch: () => void;
}

export const VectorSearchPanel: React.FC<VectorSearchPanelProps> = ({
  query,
  onQueryChange,
  isSearching,
  results,
  searchLatencyMs,
  totalDocs,
  onSearch,
}) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -z-10" />

      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center">
          <Search className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> P2P Vector Database Search
        </span>
        {searchLatencyMs > 0 && (
          <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono">
            {searchLatencyMs.toFixed(1)}ms
          </span>
        )}
      </div>

      {/* Search Input */}
      <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="flex space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search semantically across distributed embeddings..."
          disabled={isSearching}
          className="flex-1 bg-slate-950/80 border border-white/8 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition disabled:opacity-50 font-mono"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-[10px] font-bold transition disabled:opacity-40 flex items-center"
        >
          <Zap className="w-3 h-3 mr-1" />
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {results.length > 0 ? (
          results.map((r, i) => (
            <div
              key={i}
              className="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 text-[10px] hover:border-cyan-500/20 transition"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-cyan-400 font-bold">
                  #{i + 1} • {(r.similarity * 100).toFixed(1)}% match
                </span>
                <span className="text-slate-600 font-mono text-[8px]">
                  {r.shardOrigin} • {r.documentId}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">{r.documentText}</p>
            </div>
          ))
        ) : (
          <div className="text-slate-600 text-[10px] text-center py-4">
            {isSearching ? (
              <span className="animate-pulse">Querying {totalDocs} embeddings across P2P shards...</span>
            ) : (
              'Enter a query to search across the distributed vector database'
            )}
          </div>
        )}
      </div>

      <div className="text-[9px] text-slate-500 text-center">
        {totalDocs} documents • 128-dim embeddings • Cosine similarity • Sharded across WebRTC peers
      </div>
    </div>
  );
};

export default VectorSearchPanel;
