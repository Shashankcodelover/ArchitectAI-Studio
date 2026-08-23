import React from 'react';
import { Activity, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function PerformanceDashboard({ performanceData, onOptimize }) {
  if (!performanceData || performanceData.length === 0) return null;

  const getComplexityColor = (complexity) => {
    const c = complexity.toUpperCase();
    if (c.includes('O(1)') || c.includes('O(LOG')) return 'badge-green';
    if (c.includes('O(N)')) return 'badge-yellow';
    return 'badge-red'; // O(N^2), O(N log N) if unoptimized, etc
  };

  const getComplexityIcon = (complexity) => {
    const color = getComplexityColor(complexity);
    if (color === 'badge-green') return <CheckCircle2 size={14} />;
    if (color === 'badge-yellow') return <Activity size={14} />;
    return <AlertTriangle size={14} className="pulse-icon" />;
  };

  return (
    <div className="performance-dashboard glass-effect">
      <div className="perf-header">
        <Activity size={16} className="icon" />
        <h3>Algorithmic Complexity Auditor</h3>
      </div>
      
      <div className="perf-grid">
        {performanceData.map((item, idx) => {
          const badgeClass = getComplexityColor(item.complexity);
          const isRed = badgeClass === 'badge-red';
          
          return (
            <div key={idx} className={`perf-card ${isRed ? 'perf-card-warning' : ''}`}>
              <div className="perf-card-header">
                <span className="perf-op">{item.operation}</span>
                <span className={`perf-badge ${badgeClass}`}>
                  {getComplexityIcon(item.complexity)}
                  <span dangerouslySetInnerHTML={{ __html: item.complexity.replace(/\^2/g, '²') }} />
                </span>
              </div>
              <p className="perf-suggestion">{item.suggestion}</p>
              
              {isRed && (
                <button 
                  className="optimize-btn"
                  onClick={() => onOptimize(`Please optimize the ${item.operation} operation. You previously suggested: ${item.suggestion}. Apply this fix to the architecture.`)}
                >
                  <Zap size={12} />
                  Click to Optimize
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
