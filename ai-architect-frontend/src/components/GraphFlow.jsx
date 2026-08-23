/**
 * GraphFlow.jsx — Animated LangGraph Workflow Visualizer
 *
 * Renders an SVG graph of the agent's execution path:
 *   START → ARCHITECT → TOOLS → WRITER → END
 *
 * Props:
 *   activeNode    — string: currently executing node id (or null)
 *   visitedNodes  — string[]: all nodes executed so far
 *   status        — 'idle' | 'running' | 'done' | 'error'
 */

import React, { useEffect, useRef } from 'react';

// ── Node & Edge definitions ────────────────────────────────────────────────────
const NODES = [
  { id: '__start__',    label: 'START',     x: 48,  y: 40, type: 'terminal', icon: '◉' },
  { id: 'architectNode', label: 'Architect', x: 175, y: 40, type: 'agent',    icon: '🏗' },
  { id: 'tools',        label: 'Tools',     x: 360, y: 40, type: 'tool',     icon: '⚙' },
  { id: 'writerNode',   label: 'Writer',    x: 520, y: 40, type: 'agent',    icon: '✍' },
  { id: '__end__',      label: 'END',       x: 670, y: 40, type: 'terminal', icon: '◉' },
];

// Forward edges (linear flow)
const EDGES = [
  { from: '__start__',     to: 'architectNode', id: 'e1' },
  { from: 'architectNode', to: 'tools',         id: 'e2' },
  { from: 'tools',         to: 'architectNode', id: 'e3', loop: true  }, // loop back
  { from: 'architectNode', to: 'writerNode',    id: 'e4' },
  { from: 'architectNode', to: '__end__',       id: 'e5' },
  { from: 'writerNode',    to: '__end__',       id: 'e6' },
];

// Node box dimensions
const BOX_W = 110;
const BOX_H = 44;

// Compute box left-x from center-x
const bx = (cx) => cx - BOX_W / 2;
const by = (cy) => cy - BOX_H / 2;

function nodeColor(nodeId, activeNode, visitedNodes, status) {
  if (status === 'error' && activeNode === nodeId) return { stroke: '#ef4444', glow: '#ef444440', text: '#ef4444', bg: '#1a0a0a' };
  if (activeNode === nodeId) return { stroke: '#6366f1', glow: '#6366f160', text: '#a5b4fc', bg: '#0f1030' };
  if (visitedNodes.includes(nodeId)) return { stroke: '#10b981', glow: '#10b98130', text: '#6ee7b7', bg: '#061a12' };
  return { stroke: '#2d3561', glow: 'transparent', text: '#64748b', bg: '#0f1117' };
}

function edgeActive(edge, activeNode, visitedNodes) {
  // An edge is "active/flowing" if:
  // – its destination is the activeNode, OR
  // – both endpoints have been visited (it was traversed)
  if (activeNode === edge.to) return true;
  return visitedNodes.includes(edge.from) && visitedNodes.includes(edge.to);
}

// Arrow path between two node centers (skips terminal circles which have smaller radii)
function edgePath(from, to, loop) {
  const fNode = NODES.find(n => n.id === from);
  const tNode = NODES.find(n => n.id === to);
  if (!fNode || !tNode) return '';

  if (loop) {
    // Curved arc above the nodes for the Tools → Architect feedback loop
    const x1 = fNode.x - BOX_W / 2;
    const x2 = tNode.x + BOX_W / 2;
    const y  = fNode.y - BOX_H / 2 - 14;
    return `M ${x1} ${fNode.y - 12} C ${x1} ${y}, ${x2} ${y}, ${x2} ${tNode.y - 12}`;
  }

  // Horizontal line from right edge of from-node to left edge of to-node
  const isFromTerminal = fNode.type === 'terminal';
  const isToTerminal   = tNode.type === 'terminal';
  const x1 = isFromTerminal ? fNode.x + 14 : fNode.x + BOX_W / 2;
  const x2 = isToTerminal   ? tNode.x - 14 : tNode.x - BOX_W / 2;
  return `M ${x1} ${fNode.y} L ${x2} ${tNode.y}`;
}

export default function GraphFlow({ activeNode, visitedNodes = [], status = 'idle' }) {
  const svgRef = useRef(null);

  return (
    <div className="graph-flow-bar">
      <div className="graph-flow-label">
        <span className={`graph-status-dot ${status}`} />
        <span>Agent Workflow</span>
        {status === 'running' && <span className="graph-running-badge">● LIVE</span>}
        {status === 'done'    && <span className="graph-done-badge">✓ Complete</span>}
      </div>

      <div className="graph-svg-wrapper">
        <svg
          ref={svgRef}
          viewBox="0 0 720 80"
          preserveAspectRatio="xMidYMid meet"
          className="graph-svg"
          aria-label="Agent workflow graph"
        >
          <defs>
            {/* Arrowhead marker — default */}
            <marker id="arrow-idle" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#2d3561" />
            </marker>
            {/* Arrowhead marker — active */}
            <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#6366f1" />
            </marker>
            {/* Arrowhead marker — done */}
            <marker id="arrow-done" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#10b981" />
            </marker>

            {/* Glow filter for active nodes */}
            <filter id="glow-indigo" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Flowing gradient for active edges */}
            <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#6366f1" stopOpacity="0" />
              <stop offset="50%"  stopColor="#6366f1" stopOpacity="1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                from="-1 0" to="1 0"
                dur="1.5s" repeatCount="indefinite"
              />
            </linearGradient>
          </defs>

          {/* ── EDGES ──────────────────────────────────────────── */}
          {EDGES.map(edge => {
            const path = edgePath(edge.from, edge.to, edge.loop);
            const isActive = edgeActive(edge, activeNode, visitedNodes);
            const isDone = visitedNodes.includes(edge.from) && visitedNodes.includes(edge.to) && activeNode !== edge.from;

            // Only show the tools→architect loop when tools was visited
            if (edge.loop && !visitedNodes.includes('tools') && activeNode !== 'tools') return null;

            return (
              <g key={edge.id}>
                {/* Background track */}
                <path
                  d={path}
                  fill="none"
                  stroke="#1e2440"
                  strokeWidth="1.5"
                  strokeDasharray={edge.loop ? '4 3' : 'none'}
                />
                {/* Active flow overlay */}
                {(isActive || isDone) && (
                  <path
                    d={path}
                    fill="none"
                    stroke={isDone && !isActive ? '#10b981' : '#6366f1'}
                    strokeWidth="1.5"
                    strokeDasharray={edge.loop ? '4 3' : 'none'}
                    markerEnd={isDone && !isActive ? 'url(#arrow-done)' : 'url(#arrow-active)'}
                    opacity={isActive ? 1 : 0.5}
                    className={isActive ? 'edge-pulse' : ''}
                  />
                )}
                {!isActive && !isDone && (
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="0"
                    markerEnd="url(#arrow-idle)"
                  />
                )}
              </g>
            );
          })}

          {/* ── NODES ──────────────────────────────────────────── */}
          {NODES.map(node => {
            const colors = nodeColor(node.id, activeNode, visitedNodes, status);
            const isActive = activeNode === node.id;
            const isDone   = visitedNodes.includes(node.id) && !isActive;

            return (
              <g key={node.id} className={`graph-node ${isActive ? 'node-active' : ''}`}>
                {/* Glow ring for active node */}
                {isActive && node.type !== 'terminal' && (
                  <rect
                    x={bx(node.x) - 4} y={by(node.y) - 4}
                    width={BOX_W + 8} height={BOX_H + 8}
                    rx="12" ry="12"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="1"
                    opacity="0.4"
                    className="glow-ring"
                  />
                )}

                {/* Node body */}
                {node.type === 'terminal' ? (
                  <circle
                    cx={node.x} cy={node.y} r={14}
                    fill={colors.bg}
                    stroke={colors.stroke}
                    strokeWidth={isActive ? 2 : 1}
                    filter={isActive ? 'url(#glow-indigo)' : isDone ? 'url(#glow-green)' : ''}
                  />
                ) : (
                  <rect
                    x={bx(node.x)} y={by(node.y)}
                    width={BOX_W} height={BOX_H}
                    rx="8" ry="8"
                    fill={colors.bg}
                    stroke={colors.stroke}
                    strokeWidth={isActive ? 2 : 1}
                    filter={isActive ? 'url(#glow-indigo)' : isDone ? 'url(#glow-green)' : ''}
                  />
                )}

                {/* Node label */}
                {node.type === 'terminal' ? (
                  <text
                    x={node.x} y={node.y + 4}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fill={colors.text} fontWeight="600"
                    fontFamily="Inter, sans-serif"
                  >
                    {node.label}
                  </text>
                ) : (
                  <>
                    <text
                      x={node.x - 20} y={node.y + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="14"
                    >
                      {isDone ? '✓' : node.icon}
                    </text>
                    <text
                      x={node.x + 12} y={node.y + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="11" fill={colors.text} fontWeight="500"
                      fontFamily="Inter, sans-serif"
                    >
                      {node.label}
                    </text>
                  </>
                )}

                {/* Pulse animation dot for active nodes */}
                {isActive && (
                  <circle
                    cx={node.type === 'terminal' ? node.x + 14 : node.x + BOX_W / 2 - 8}
                    cy={node.type === 'terminal' ? node.y - 14 : node.y - BOX_H / 2 + 6}
                    r="3" fill="#6366f1"
                    className="node-pulse-dot"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
