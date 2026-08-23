import React from 'react';
import { Database, Activity, Zap, CheckCircle2, AlertCircle, Clock, Table as TableIcon } from 'lucide-react';

/**
 * WasmSimResults.jsx
 * 
 * A premium results panel for the WASM Dry-Run Simulator.
 * Integrates with the existing Architect.ai design system.
 */
export default function WasmSimResults({ status, stats, error, onReset }) {
  if (status === 'idle') return null;

  const isLoading = ['loading', 'creating', 'seeding', 'benchmarking'].includes(status);

  return (
    <div className="sim-panel">
      <div className="sim-header">
        <div className="sim-header-title">
          <Database size={14} className="sim-icon-accent" />
          <span>Live WASM Simulation</span>
        </div>
        <div className={`sim-badge ${status}`}>
          <div className={`sim-dot ${status === 'done' ? 'active' : 'loading'}`} />
          {status === 'loading' && 'Initializing Engine...'}
          {status === 'creating' && 'Applying Schema...'}
          {status === 'seeding' && 'Injecting 1,000 Rows...'}
          {status === 'benchmarking' && 'Running Benchmark...'}
          {status === 'done' && 'WASM DB Initialized'}
          {status === 'error' && 'Simulation Failed'}
        </div>
      </div>

      <div className="sim-content">
        {isLoading && (
          <div className="sim-loading-view">
            <div className="sim-spinner-container">
              <div className="sim-spinner" />
              <Activity size={24} className="sim-spinner-icon" />
            </div>
            <p>Spinning up in-memory SQLite instance...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="sim-error-view">
            <AlertCircle size={32} color="var(--red)" />
            <h4>Execution Error</h4>
            <p>{error || 'An unexpected error occurred during simulation.'}</p>
            <button className="sim-reset-btn" onClick={onReset}>Retry Simulation</button>
          </div>
        )}

        {status === 'done' && stats && (
          <div className="sim-stats-grid">
            {/* Performance Metric */}
            <div className="sim-stat-card highlight">
              <div className="stat-label">
                <Zap size={12} />
                <span>SELECT Latency</span>
              </div>
              <div className="stat-value">{stats.queryTimeMs}ms</div>
              <div className="stat-sub">Deterministic Benchmark</div>
            </div>

            {/* Row Count */}
            <div className="sim-stat-card">
              <div className="stat-label">
                <CheckCircle2 size={12} color="var(--green)" />
                <span>Rows Injected</span>
              </div>
              <div className="stat-value">{stats.rowsInserted.toLocaleString()}</div>
              <div className="stat-sub">Across {stats.tablesCreated} tables</div>
            </div>

            {/* Schema Info */}
            <div className="sim-stat-card">
              <div className="stat-label">
                <TableIcon size={12} />
                <span>Schema Density</span>
              </div>
              <div className="stat-value">{stats.totalColumns}</div>
              <div className="stat-sub">Data points per row</div>
            </div>

            {/* Query Details */}
            <div className="sim-query-details">
              <div className="query-header">
                <Clock size={12} />
                <span>Generated Benchmark Query</span>
              </div>
              <pre className="query-code">
                <code>{stats.benchmarkQuery}</code>
              </pre>
            </div>
            
            <button className="sim-reset-btn mini" onClick={onReset}>Clear Simulation</button>
          </div>
        )}
      </div>
    </div>
  );
}
