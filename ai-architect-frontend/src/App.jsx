/**
 * App.jsx — AI Architect Studio Master Layout
 *
 * 3-panel interactive agent workspace:
 *   [Graph Bar] — animated LangGraph workflow tracker
 *   [Left]      — live file tree + tool execution timeline
 *   [Center]    — typewriter code generator
 *   [Right]     — streaming agent chat
 *
 * SSE Event Protocol (from backend):
 *   { type: "start" }
 *   { type: "node_enter", node: "architectNode" | "tools" | "writerNode" }
 *   { type: "node_exit",  node: string }
 *   { type: "token",      content: string }
 *   { type: "tool_call",  tool: string, args: {} }
 *   { type: "done",       fullContent: string }
 *   { type: "error",      message: string }
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, PlusCircle, Zap, Copy, Download,
         Layers, FileText, Shield, Package, ChevronRight, Sparkles, AlertTriangle } from 'lucide-react';
import GraphFlow from './components/GraphFlow.jsx';
import FileTree  from './components/FileTree.jsx';
import CodePanel from './components/CodePanel.jsx';
import WasmSimResults from './components/WasmSimResults.jsx';
import LiveEndpointManager from './components/LiveEndpointManager.jsx';
import SecurityConsole from './components/SecurityConsole.jsx';
import PerformanceDashboard from './components/PerformanceDashboard.jsx';
import CapSlider from './components/CapSlider.jsx';
import { useWasmSimulator } from './hooks/useWasmSimulator';
import { DEMO_EVENTS, DEMO_PROMPT } from './demoData.js';

const API_BASE = 'http://localhost:3035/api/architect';

// ── UUID generator (browser-native or fallback) ──────────────────────────────
const genUUID = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// ── Parse code blocks from AI markdown ───────────────────────────────────────
// Matches: ```lang filename\n...code...\n```
// Matches: ```lang\n...code...\n```
function parseCodeBlocks(content) {
  const blocks = [];
  const re = /```(\w+)(?:\s+([^\n`]+))?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const [, lang, filename, code] = m;
    const trimmedCode = code.trim();
    if (trimmedCode.length < 10) continue; // skip tiny snippets
    blocks.push({
      lang:     lang || 'text',
      filename: filename?.trim() || null,
      code:     trimmedCode,
    });
  }
  return blocks;
}

// Extract API endpoints for the mock server manager
function parseEndpoints(markdown) {
  const endpoints = [];
  const re = /(?:-\s*)?(GET|POST|PUT|DELETE|PATCH)\s+([\/a-zA-Z0-9_\-\{\}]+)/gi;
  let match;
  while ((match = re.exec(markdown)) !== null) {
      endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2]
      });
  }
  return endpoints.filter((v, i, a) => a.findIndex(t => t.path === v.path && t.method === v.method) === i);
}

// Extract named files (code blocks with a plausible filename)
function parseFiles(codeBlocks) {
  return codeBlocks.filter(b =>
    b.filename && (b.filename.includes('.') || b.filename.length > 2)
  );
}

// ── Modes ─────────────────────────────────────────────────────────────────────
const MODES = [
  { id: 'blueprint', label: 'Blueprint', icon: <Layers size={15}/>,   desc: 'Design system architecture', placeholder: 'Describe the system you want to design... e.g. "Build a real-time chat app with PostgreSQL"' },
  { id: 'analysis',  label: 'Analyzer',  icon: <Shield size={15}/>,   desc: 'Critique & review design',  placeholder: 'Paste your blueprint for an architecture review...' },
  { id: 'writer',    label: 'Writer',    icon: <FileText size={15}/>, desc: 'Generate documentation',    placeholder: 'Describe the documentation you need...' },
  { id: 'scaffold',  label: 'Scaffold',  icon: <Package size={15}/>,  desc: 'Generate starter project',  placeholder: 'Paste your blueprint to generate a project scaffold...' },
];

const QUICK_PROMPTS = [
  'Design a real-time chat app with PostgreSQL',
  'Build a SaaS billing microservice',
  'Netflix for Books — full architecture',
  'E-commerce platform with Redis caching',
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="thinking-row">
      <div className="thinking-dots"><span/><span/><span/></div>
      <span className="thinking-label">Agent is reasoning...</span>
    </div>
  );
}

function ToolCallBubble({ toolName }) {
  const labels = {
    fetch_api_structure:           '🔍 Researching documentation...',
    generate_database_schema:      '🗃 Generating database schema...',
    write_technical_documentation: '📝 Writing documentation...',
  };
  return (
    <div className="tool-call-bubble">
      <span className="tool-call-icon">⚙</span>
      {labels[toolName] || `🔧 Calling ${toolName}...`}
    </div>
  );
}

function Message({ msg, mode }) {
  const isUser = msg.role === 'user';
  const copy = () => navigator.clipboard.writeText(msg.content).catch(() => {});
  const download = () => {
    const blob = new Blob([msg.content], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'architecture.md' }).click();
    URL.revokeObjectURL(url);
  };

  if (msg.role === 'tool_call') return <ToolCallBubble toolName={msg.tool} />;

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-ai'}`}>
      <div className={`msg-avatar ${isUser ? 'avatar-user' : 'avatar-ai'}`}>
        {isUser ? <User size={14}/> : <Bot size={14}/>}
      </div>
      <div className="msg-body">
        <div className="msg-role">{isUser ? 'You' : 'ArchitectAI Studio'}</div>
        <div className="msg-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
        {!isUser && msg.content?.length > 80 && (
          <div className="msg-actions">
            <button className="msg-btn" onClick={copy}><Copy size={11}/> Copy</button>
            {mode === 'writer' && (
              <button className="msg-btn" onClick={download}><Download size={11}/> Download .md</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeHero({ currentMode, onChipClick }) {
  return (
    <div className="welcome-hero">
      <div className="hero-icon"><Sparkles size={26} color="#6366f1"/></div>
      <h1 className="hero-title">ArchitectAI Studio</h1>
      <p className="hero-sub">Autonomous system design powered by LangGraph + Gemini</p>
      <div className="hero-chips">
        {QUICK_PROMPTS.map(p => (
          <button key={p} className="hero-chip" onClick={() => onChipClick(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  // Chat state (right panel)
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(''); // partial streaming text

  // Agent execution state
  const [agentState, setAgentState] = useState({
    activeNode:   null,         // 'architectNode' | 'tools' | 'writerNode' | null
    visitedNodes: [],           // ordered list of completed nodes
    status:       'idle',       // 'idle' | 'running' | 'done' | 'error'
  });

  // Panel state
  const [files,       setFiles]      = useState([]);       // { name, lang, code }[]
  const [codeBlocks,  setCodeBlocks] = useState([]);       // all code blocks
  const [toolCalls,   setToolCalls]  = useState([]);       // executed tool calls
  const [activeFile,  setActiveFile] = useState(null);     // selected filename
  const [activeTab,   setActiveTab]  = useState(0);        // code panel tab index
  const [isTyping,    setIsTyping]   = useState(false);
  const [isChaos,     setIsChaos]    = useState(false);    // Red Alert state
  const [mockServer,  setMockServer] = useState(null);     // { url, endpoints }
  const [securityLogs, setSecurityLogs] = useState([]);    // Red Team reports
  const [performanceData, setPerformanceData] = useState([]); // Auditor results

  // WASM Simulator
  const { status: simStatus, stats: simStats, error: simError, runSimulation, reset: resetSim } = useWasmSimulator();

  // Session
  const [modeId,    setModeId]   = useState('blueprint');
  const [threadId]               = useState(() => genUUID());
  const [capValue,  setCapValue] = useState('balanced');

  const textareaRef  = useRef(null);
  const chatEndRef   = useRef(null);
  const abortRef     = useRef(null); // AbortController for SSE

  const currentMode = MODES.find(m => m.id === modeId);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const resetPanels = () => {
    setFiles([]);
    setCodeBlocks([]);
    setToolCalls([]);
    setActiveFile(null);
    setActiveTab(0);
    setStreaming('');
    setIsTyping(false);
    setAgentState({ activeNode: null, visitedNodes: [], status: 'idle' });
    resetSim();
    setMockServer(null);
    setSecurityLogs([]);
    setPerformanceData([]);
  };

  // ── SSE event dispatcher ────────────────────────────────────────────────────
  const handleSSEEvent = useCallback((event, accContentRef) => {
    switch (event.type) {
      case 'start':
        setAgentState({ activeNode: null, visitedNodes: [], status: 'running' });
        break;

      case 'node_enter':
        if (event.node === 'chaosNode') setIsChaos(true);
        setAgentState(prev => ({
          ...prev,
          activeNode:   event.node,
          visitedNodes: [...prev.visitedNodes, event.node],
        }));
        break;

      case 'node_exit':
        setAgentState(prev => ({ ...prev, activeNode: null }));
        break;

      case 'token':
        accContentRef.current += event.content;
        setStreaming(accContentRef.current);
        break;

      case 'tool_call':
        setToolCalls(prev => [...prev, { tool: event.tool, args: event.args }]);
        setMessages(prev => [...prev, { role: 'tool_call', tool: event.tool }]);
        break;

      case 'done': {
        const full = event.fullContent || accContentRef.current;
        const blocks = parseCodeBlocks(full);
        const namedFiles = parseFiles(blocks);
        setCodeBlocks(blocks);
        setFiles(namedFiles);
        setActiveTab(0);
        if (namedFiles.length > 0) setActiveFile(namedFiles[0].name);
        setStreaming('');
        setIsTyping(true);
        // Bug #2 Fix: Timer was based on blocks[0]?.code?.length which could be 0 or
        // undefined if the first block is short. Now: match useTypewriter speed (6ms/char)
        // and clamp between 2s and 20s so it never fires too early or hangs forever.
        const firstCodeLen = blocks[0]?.code?.length || 0;
        const typingMs = Math.min(Math.max(firstCodeLen * 6 + 500, 2000), 20000);
        setTimeout(() => setIsTyping(false), typingMs);
        setMessages(prev => [...prev, { role: 'assistant', content: full }]);
        setAgentState(prev => ({ ...prev, status: 'done', activeNode: null }));

        // Handle Mock Server endpoints extraction
        const endpoints = parseEndpoints(full); // Re-use the parser if possible or implement here
        if (endpoints.length > 0) {
            setMockServer(prev => ({
                ...prev,
                endpoints
            }));
        }

        // Trigger WASM Simulation if a SQL schema is found
        const sqlBlock = blocks.find(b => 
          (b.lang === 'sql' || b.lang === 'postgresql') && 
          b.code.toUpperCase().includes('CREATE TABLE')
        );
        if (sqlBlock) {
          console.log('[App] SQL Schema detected, triggering WASM simulation...');
          runSimulation(sqlBlock.code);
        }
        break;
      }

      case 'error':
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ **Agent Error:** ${event.message}`,
        }]);
        setAgentState(prev => ({ ...prev, status: 'error', activeNode: null }));
        break;

      case 'mock_server_ready':
        // The backend emits this when mockServerNode completes
        // It provides the URL; we need to parse the endpoints from the full content
        // (Handled in 'done' event to ensure we have the latest blueprint)
        setMockServer(prev => ({
          ...prev,
          url: event.url
        }));
        break;

      case 'security_alert':
        setSecurityLogs(prev => [...prev, { status: event.status, report: event.report }]);
        break;

      case 'performance_audit':
        setPerformanceData(event.data || []);
        break;
    }
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || agentState.status === 'running') return;

    // Abort any previous stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    resetPanels();
    setAgentState({ activeNode: null, visitedNodes: [], status: 'running' });

    // Accumulate full content across token events (ref = no re-render per token)
    const accContent = { current: '' };

    try {
      const res = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt:    text,
          mode:      modeId,
          thread_id: threadId,
          stream:    true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      // Read SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete chunk

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            const evt = JSON.parse(raw);
            handleSSEEvent(evt, accContent);
          } catch (_) { /* malformed chunk, skip */ }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      const isQuota = err.message?.includes('quota') || err.message?.includes('429');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isQuota
          ? '⚠️ **API Quota Reached.** The Gemini free-tier limit has been hit. Please wait a few minutes and retry.'
          : `❌ **Connection Error.** ${err.message || 'Could not reach backend on port 3035.'}`,
      }]);
      setAgentState(prev => ({ ...prev, status: 'error', activeNode: null }));
    }
  };

  // ── Unleash Chaos Monkey ───────────────────────────────────────────────────
  const handleChaos = async () => {
    if (agentState.status === 'running' || messages.length === 0) return;

    setAgentState({ activeNode: null, visitedNodes: [], status: 'running' });
    resetPanels();
    setIsChaos(true);

    const accContent = { current: '' };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/chaos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ thread_id: threadId }),
      });

      if (!res.ok) throw new Error(`Chaos failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            handleSSEEvent(JSON.parse(raw), accContent);
          } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setIsChaos(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Chaos Failed: ${err.message}` }]);
      setAgentState(prev => ({ ...prev, status: 'error' }));
    }
  };

  // ── CAP Theorem Update ─────────────────────────────────────────────────────
  const handleCapChange = async (newVal) => {
    if (newVal === capValue) return;
    setCapValue(newVal);

    if (messages.length === 0) return; // Don't trigger if no conversation exists

    setAgentState({ activeNode: null, visitedNodes: [], status: 'running' });
    resetPanels();
    setIsChaos(false);

    const accContent = { current: '' };
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/cap-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ thread_id: threadId, capPreference: newVal }),
      });

      if (!res.ok) throw new Error(`CAP update failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            handleSSEEvent(JSON.parse(raw), accContent);
          } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Rewrite Failed: ${err.message}` }]);
      setAgentState(prev => ({ ...prev, status: 'error' }));
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Demo Mode ────────────────────────────────────────────────────────────────
  // Plays back DEMO_EVENTS on a timer — no API call required.
  // Use this when Gemini quota is exceeded or for offline demonstrations.
  const runDemo = () => {
    abortRef.current?.abort();
    setMessages([{ role: 'user', content: DEMO_PROMPT }]);
    resetPanels();
    setAgentState({ activeNode: null, visitedNodes: [], status: 'running' });

    const accContent = { current: '' };
    const timers = [];

    DEMO_EVENTS.forEach(event => {
      const t = setTimeout(() => {
        handleSSEEvent(event, accContent);
      }, event.delay);
      timers.push(t);
    });

    // Safety cleanup if component unmounts
    return () => timers.forEach(clearTimeout);
  };

  const handleChipClick = (prompt) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleModeSwitch = (id) => {
    setModeId(id);
    setMessages([]);
    resetPanels();
    abortRef.current?.abort();
  };

  const isRunning = agentState.status === 'running';

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className={`studio ${isChaos ? 'chaos-mode' : ''}`}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="studio-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-mark"><Zap size={16} color="white"/></div>
            <span className="logo-name">ArchitectAI Studio</span>
            <span className="logo-beta">PRO</span>
          </div>
          <ChevronRight size={12} color="#334155"/>
          <div className="mode-tabs">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`mode-tab ${modeId === m.id ? 'mode-tab-active' : ''}`}
                onClick={() => handleModeSwitch(m.id)}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="header-right">
          <div className={`status-badge ${agentState.status}`}>
            <span className={`status-dot ${agentState.status}`}/>
            {agentState.status === 'running' ? 'Agent Running' :
             agentState.status === 'done'    ? 'Complete' :
             agentState.status === 'error'   ? 'Error' : 'Ready'}
          </div>
          <span className="thread-id">#{threadId.slice(-6)}</span>
          {/* Demo Mode button — plays offline without API quota */}
          <button
            className="header-btn demo-btn"
            onClick={runDemo}
            disabled={isRunning}
            title="Play demo (no API quota needed)"
          >
            ▶ Demo
          </button>
          <button
            className="header-btn chaos-btn"
            onClick={handleChaos}
            disabled={isRunning || messages.length === 0}
            title="Unleash Chaos Monkey"
          >
            <AlertTriangle size={14}/> Chaos
          </button>
          <button
            className="header-btn"
            onClick={() => { setMessages([]); resetPanels(); setIsChaos(false); }}
            title="New session"
          >
            <PlusCircle size={14}/> New
          </button>
        </div>
      </header>

      {/* ── GRAPH FLOW BAR ─────────────────────────────────────────────── */}
      <GraphFlow
        activeNode={agentState.activeNode}
        visitedNodes={agentState.visitedNodes}
        status={agentState.status}
      />

      <div className="cap-slider-wrapper">
        <CapSlider value={capValue} onChange={handleCapChange} disabled={isRunning} />
      </div>

      {/* ── 3-PANEL WORKSPACE ──────────────────────────────────────────── */}
      <div className="studio-panels">

        {/* LEFT — File Tree + Tool Timeline */}
        <FileTree
          files={files}
          activeFile={activeFile}
          onFileClick={(f) => {
            setActiveFile(f.name);
            const i = codeBlocks.findIndex(b => b.filename === f.name);
            if (i >= 0) setActiveTab(i);
          }}
          toolCalls={toolCalls}
          agentStatus={agentState.status}
        />

        {/* CENTER — Code Panel */}
        <CodePanel
          codeBlocks={codeBlocks}
          activeIndex={activeTab}
          onTabChange={setActiveTab}
          isTyping={isTyping}
        />

        {/* SECURITY & PERFORMANCE OVERLAYS */}
        <SecurityConsole logs={securityLogs} />
        <PerformanceDashboard 
          performanceData={performanceData} 
          onOptimize={(msg) => { setInput(msg); handleSend(); }} 
        />

        {/* WASM SIMULATOR OVERLAY/PANEL (Visible when active) */}
        {simStatus !== 'idle' && (
          <div className="sim-overlay-container">
            <WasmSimResults 
              status={simStatus} 
              stats={simStats} 
              error={simError} 
              onReset={resetSim} 
            />
          </div>
        )}

        {/* LIVE MOCK SERVER PANEL */}
        {mockServer && mockServer.url && (
            <div className="mock-server-overlay">
                <LiveEndpointManager 
                    mockUrl={mockServer.url} 
                    endpoints={mockServer.endpoints || []} 
                />
            </div>
        )}

        {/* RIGHT — Agent Chat */}
        <section className="panel panel-right">
          <div className="panel-header">
            <span className="panel-header-icon"><Bot size={14}/></span>
            <span className="panel-header-title">Agent Response</span>
            {messages.filter(m => m.role === 'assistant').length > 0 && (
              <span className="panel-header-badge">
                {messages.filter(m => m.role === 'assistant').length}
              </span>
            )}
          </div>

          {/* Messages list */}
          <div className="chat-messages">
            {messages.length === 0 && !isRunning && (
              <WelcomeHero currentMode={currentMode} onChipClick={handleChipClick}/>
            )}

            {messages.map((msg, i) => (
              <Message key={i} msg={msg} mode={modeId}/>
            ))}

            {/* Live streaming preview */}
            {streaming && (
              <div className="message message-ai">
                <div className="msg-avatar avatar-ai"><Bot size={14}/></div>
                <div className="msg-body">
                  <div className="msg-role">ArchitectAI Studio</div>
                  <div className="msg-content streaming-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {isRunning && !streaming && <ThinkingDots/>}
            <div ref={chatEndRef}/>
          </div>
        </section>
      </div>

      {/* ── INPUT BAR ──────────────────────────────────────────────────── */}
      <div className="input-bar">
        <div className="input-inner">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={currentMode?.placeholder || 'Describe your system...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={isRunning}
          />
          <div className="input-toolbar">
            <div className="input-hints">
              <span className="hint-chip">⮐ Enter to send</span>
              <span className="hint-chip">⇧ Shift+Enter for new line</span>
              {input.length > 0 && <span className="hint-chip char-count">{input.length} chars</span>}
            </div>
            <button
              className={`send-btn ${isRunning ? 'send-btn-running' : ''}`}
              onClick={handleSend}
              disabled={isRunning || !input.trim()}
            >
              {isRunning
                ? <><span className="send-spinner"/>{' '}Running...</>
                : <><Send size={14}/>{' '}Send</>
              }
            </button>
          </div>
        </div>
        <div className="input-footer">
          <span><Zap size={9}/> Gemini 1.5 Flash-8B</span>
          <span>·</span>
          <span>LangGraph Orchestration</span>
          <span>·</span>
          <span>SSE Streaming</span>
          <span>·</span>
          <span>MemorySaver Active</span>
        </div>
      </div>

    </div>
  );
}
