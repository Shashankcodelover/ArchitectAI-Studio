/**
 * CodePanel.jsx — Live Code Generator (Center Panel)
 *
 * Shows code blocks extracted from the AI's response with a typewriter effect.
 * Each file/code-block tab can be selected from the header.
 *
 * Props:
 *   codeBlocks   — [{ lang, filename, code }]
 *   activeIndex  — number: which code block tab is selected
 *   onTabChange  — (index) => void
 *   isTyping     — boolean: whether to apply typewriter animation
 */

import React, { useState, useEffect, useRef } from 'react';

// Minimal syntax highlighter — colorizes keywords inline via regex replacements
// We avoid a full lib to keep the bundle small
const KEYWORD_PATTERNS = [
  { re: /\b(const|let|var|function|class|return|import|export|from|async|await|if|else|for|while|try|catch|new|this|typeof|of|in|default|extends)\b/g,
    color: '#c792ea' },
  { re: /\b(true|false|null|undefined|NaN|Infinity)\b/g,
    color: '#ff9d00' },
  { re: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    color: '#c3e88d' },
  { re: /\/\/.*/g,
    color: '#546e7a' },
  { re: /\b(\d+\.?\d*)\b/g,
    color: '#f78c6c' },
  { re: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|PRIMARY|KEY|REFERENCES|INDEX|ON|JOIN|INNER|LEFT|RIGHT|GROUP|BY|ORDER|LIMIT|NOT|NULL|UNIQUE|DEFAULT|CASCADE)\b/gi,
    color: '#89ddff' },
];

function highlight(code) {
  // Escape HTML first
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply color patterns
  KEYWORD_PATTERNS.forEach(({ re, color }) => {
    escaped = escaped.replace(re, (m) => `<span style="color:${color}">${m}</span>`);
  });

  return escaped;
}

// Language display names
const LANG_LABELS = {
  js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
  sql: 'SQL', json: 'JSON', md: 'Markdown', yaml: 'YAML',
  bash: 'Bash', sh: 'Shell', dockerfile: 'Dockerfile', default: 'Code',
};

function getLangLabel(lang) {
  return LANG_LABELS[lang?.toLowerCase()] || lang || 'Code';
}

// Typewriter hook: reveals text char by char
function useTypewriter(text, speed = 8, enabled = true) {
  const [displayed, setDisplayed] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled || !text) { setDisplayed(text || ''); return; }
    setDisplayed('');
    let i = 0;
    ref.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(ref.current);
    }, speed);
    return () => clearInterval(ref.current);
  }, [text, enabled]);

  return displayed;
}

// Single code block viewer with typewriter
function CodeViewer({ block, isActive, isTyping }) {
  const displayed = useTypewriter(block.code, 6, isTyping && isActive);
  const codeRef = useRef(null);

  // Auto-scroll to bottom as code types out
  useEffect(() => {
    if (codeRef.current && isTyping) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [displayed, isTyping]);

  const lines = displayed.split('\n');

  return (
    <div className="code-viewer" ref={codeRef}>
      <div className="code-content">
        <div className="code-line-numbers">
          {lines.map((_, i) => (
            <div key={i} className="line-num">{i + 1}</div>
          ))}
        </div>
        <pre
          className="code-pre"
          dangerouslySetInnerHTML={{ __html: highlight(displayed) }}
        />
      </div>
      {/* Blinking cursor while typing */}
      {isTyping && isActive && displayed.length < block.code.length && (
        <span className="code-cursor">▋</span>
      )}
    </div>
  );
}

export default function CodePanel({ codeBlocks = [], activeIndex = 0, onTabChange, isTyping = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const block = codeBlocks[activeIndex];
    if (!block) return;
    navigator.clipboard.writeText(block.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activeBlock = codeBlocks[activeIndex];

  return (
    <section className="panel panel-center">
      {/* Panel Header with tabs */}
      <div className="panel-header code-panel-header">
        <div className="code-tabs">
          {codeBlocks.map((block, i) => (
            <button
              key={i}
              className={`code-tab ${i === activeIndex ? 'code-tab-active' : ''}`}
              onClick={() => onTabChange?.(i)}
              title={block.filename || getLangLabel(block.lang)}
            >
              <span className="code-tab-dot" style={{
                background: i === activeIndex ? '#6366f1' : '#2d3561'
              }} />
              {block.filename || getLangLabel(block.lang)}
            </button>
          ))}
        </div>
        {activeBlock && (
          <div className="code-panel-actions">
            <span className="lang-badge">{getLangLabel(activeBlock.lang)}</span>
            <button className="icon-action-btn" onClick={handleCopy} title="Copy code">
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {codeBlocks.length === 0 && (
        <div className="panel-empty">
          <div className="code-empty-terminal">
            <div className="terminal-bar">
              <span /><span /><span />
            </div>
            <div className="terminal-body">
              <p className="terminal-prompt">$ architect.ai --generate</p>
              <p className="terminal-desc">Code will appear here as the agent designs your system...</p>
              <span className="terminal-cursor">▋</span>
            </div>
          </div>
        </div>
      )}

      {/* Active code block */}
      {activeBlock && (
        <CodeViewer
          block={activeBlock}
          isActive={true}
          isTyping={isTyping}
        />
      )}
    </section>
  );
}
