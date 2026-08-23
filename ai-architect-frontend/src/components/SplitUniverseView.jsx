import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Database, Network, ChevronRight } from 'lucide-react';
import remarkGfm from 'remark-gfm';

export default function SplitUniverseView({ sqlContent, nosqlContent, onSelect }) {
  const sqlEndRef = useRef(null);
  const nosqlEndRef = useRef(null);

  // Auto-scroll when new content arrives
  useEffect(() => {
    sqlEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sqlContent]);

  useEffect(() => {
    nosqlEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [nosqlContent]);

  return (
    <div className="multiverse-container">
      <div className="multiverse-header">
        <h2 className="glitch-text">🌌 Multiverse Branching Active</h2>
        <p>The AI is currently designing two distinct architectural universes in parallel. Select a timeline to proceed.</p>
      </div>

      <div className="multiverse-split">
        {/* LEFT PANEL: SQL */}
        <div className="universe-panel sql-universe">
          <div className="universe-header">
            <Database size={18} color="#3b82f6" />
            <h3>Universe A: Strict Relational (SQL)</h3>
          </div>
          <div className="universe-content markdown-body">
            {sqlContent ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sqlContent}</ReactMarkdown>
            ) : (
              <div className="universe-loading">Simulating Relational Topology...</div>
            )}
            <div ref={sqlEndRef} />
          </div>
          <button className="select-universe-btn sql-btn" onClick={() => onSelect('SQL')} disabled={!sqlContent}>
            Select Universe A <ChevronRight size={16} />
          </button>
        </div>

        {/* RIGHT PANEL: NoSQL */}
        <div className="universe-panel nosql-universe">
          <div className="universe-header">
            <Network size={18} color="#f97316" />
            <h3>Universe B: Document Distributed (NoSQL)</h3>
          </div>
          <div className="universe-content markdown-body">
            {nosqlContent ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{nosqlContent}</ReactMarkdown>
            ) : (
              <div className="universe-loading">Simulating Document Topology...</div>
            )}
            <div ref={nosqlEndRef} />
          </div>
          <button className="select-universe-btn nosql-btn" onClick={() => onSelect('NoSQL')} disabled={!nosqlContent}>
            Select Universe B <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
