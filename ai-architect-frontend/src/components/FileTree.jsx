/**
 * FileTree.jsx — Live Animated File Tree (Left Panel)
 *
 * Displays project files as they are detected in the AI's response.
 * Files animate in one-by-one as the agent generates code blocks.
 *
 * Props:
 *   files        — [{ name, lang, code }]  extracted from AI markdown
 *   activeFile   — string: currently focused filename
 *   onFileClick  — (file) => void
 *   toolCalls    — [{ tool, args }] — execution timeline entries
 *   agentStatus  — 'idle' | 'running' | 'done'
 */

import React from 'react';

const LANG_ICONS = {
  js:         { icon: 'JS',  color: '#f7df1e', bg: '#1a1700' },
  jsx:        { icon: 'JSX', color: '#61dafb', bg: '#001a20' },
  ts:         { icon: 'TS',  color: '#3178c6', bg: '#00102a' },
  tsx:        { icon: 'TSX', color: '#3178c6', bg: '#00102a' },
  sql:        { icon: 'SQL', color: '#336791', bg: '#000d1a' },
  json:       { icon: '{}',  color: '#ffa500', bg: '#1a0d00' },
  md:         { icon: 'MD',  color: '#ffffff', bg: '#1a1a1a' },
  markdown:   { icon: 'MD',  color: '#ffffff', bg: '#1a1a1a' },
  yml:        { icon: 'YML', color: '#cc0000', bg: '#1a0000' },
  yaml:       { icon: 'YML', color: '#cc0000', bg: '#1a0000' },
  sh:         { icon: 'SH',  color: '#4caf50', bg: '#001a00' },
  bash:       { icon: 'SH',  color: '#4caf50', bg: '#001a00' },
  dockerfile: { icon: 'DO',  color: '#2496ed', bg: '#001020' },
  default:    { icon: '  ',  color: '#64748b', bg: '#0f1117' },
};

function getLangMeta(lang) {
  return LANG_ICONS[lang?.toLowerCase()] || LANG_ICONS.default;
}

// Detect file extension from filename, fallback to lang
function getFileIcon(file) {
  const ext = file.name?.split('.').pop()?.toLowerCase();
  return getLangMeta(ext || file.lang);
}

// TOOL CALL display chips
const TOOL_META = {
  fetch_api_structure:         { label: 'Research',      color: '#8b5cf6', icon: '🔍' },
  generate_database_schema:    { label: 'Schema',        color: '#f59e0b', icon: '🗃' },
  write_technical_documentation:{ label: 'Docs',         color: '#10b981', icon: '📝' },
};

function ToolChip({ toolCall, index }) {
  const meta = TOOL_META[toolCall.tool] || { label: toolCall.tool, color: '#64748b', icon: '🔧' };
  return (
    <div
      className="tool-chip"
      style={{ '--chip-color': meta.color, animationDelay: `${index * 0.1}s` }}
    >
      <span className="tool-chip-icon">{meta.icon}</span>
      <div className="tool-chip-info">
        <span className="tool-chip-label">{meta.label}</span>
        <span className="tool-chip-tool">{toolCall.tool}</span>
      </div>
      <span className="tool-chip-done">✓</span>
    </div>
  );
}

export default function FileTree({ files = [], activeFile, onFileClick, toolCalls = [], agentStatus }) {
  const hasContent = files.length > 0 || toolCalls.length > 0;

  return (
    <aside className="panel panel-left">
      {/* Panel Header */}
      <div className="panel-header">
        <span className="panel-header-icon">📁</span>
        <span className="panel-header-title">Project Files</span>
        {files.length > 0 && (
          <span className="panel-header-badge">{files.length}</span>
        )}
      </div>

      {/* Empty state */}
      {!hasContent && (
        <div className="panel-empty">
          <div className="panel-empty-icon">📂</div>
          <p>Files will appear here as the agent generates code</p>
        </div>
      )}

      {/* File Tree */}
      {files.length > 0 && (
        <div className="file-tree">
          <div className="file-tree-root">
            <span className="file-tree-folder-icon">▼</span>
            <span className="file-tree-folder-name">project/</span>
          </div>
          <div className="file-tree-children">
            {files.map((file, i) => {
              const meta = getFileIcon(file);
              const isActive = activeFile === file.name;
              return (
                <button
                  key={`${file.name}-${i}`}
                  className={`file-tree-item ${isActive ? 'file-tree-item-active' : ''}`}
                  onClick={() => onFileClick(file)}
                  style={{ animationDelay: `${i * 80}ms` }}
                  title={file.name}
                >
                  <span
                    className="file-icon-badge"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.icon}
                  </span>
                  <span className="file-name">{file.name}</span>
                  {isActive && <span className="file-active-dot" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {files.length > 0 && toolCalls.length > 0 && (
        <div className="panel-divider" />
      )}

      {/* Execution Timeline */}
      {toolCalls.length > 0 && (
        <div className="execution-timeline">
          <div className="panel-section-label">Tool Calls</div>
          {toolCalls.map((tc, i) => (
            <ToolChip key={i} toolCall={tc} index={i} />
          ))}
        </div>
      )}

      {/* Running indicator */}
      {agentStatus === 'running' && (
        <div className="agent-running-indicator">
          <div className="running-dots">
            <span /><span /><span />
          </div>
          <span>Agent working...</span>
        </div>
      )}
    </aside>
  );
}
