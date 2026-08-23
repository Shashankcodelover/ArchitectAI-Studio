import React, { useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function SecurityConsole({ logs }) {
  const consoleEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!logs || logs.length === 0) return null;

  const isHacked = logs[logs.length - 1]?.status === 'REJECTED';

  return (
    <div className={`security-console ${isHacked ? 'glitch-effect' : ''}`}>
      <div className="console-header">
        <div className="console-title">
          <Terminal size={14} className="icon" />
          <span>Red Team Security Agent</span>
        </div>
        <div className={`status-badge ${isHacked ? 'danger' : 'safe'}`}>
          {isHacked ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
          <span>{isHacked ? 'VULNERABILITY DETECTED' : 'SYSTEM SECURE'}</span>
        </div>
      </div>
      
      <div className="console-body">
        {logs.map((log, i) => (
          <div key={i} className={`log-entry ${log.status === 'REJECTED' ? 'log-rejected' : 'log-clean'}`}>
            <span className="log-timestamp">[{new Date().toLocaleTimeString()}]</span>
            <span className="log-status">[{log.status}]</span>
            <div className="log-content markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{log.report}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}
