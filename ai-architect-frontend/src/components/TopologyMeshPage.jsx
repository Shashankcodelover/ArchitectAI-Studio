import React, { useState, useEffect } from 'react';
import { Network, Activity, Plus, ShieldCheck, Trash2, RefreshCw, X, ArrowRight, Server, Layers, Cpu } from 'lucide-react';

export default function TopologyMeshPage({ onClose, onOpenIngestion }) {
  const [corridors, setCorridors] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  // Form states
  const [fromNode, setFromNode] = useState('api_gw');
  const [toNode, setToNode] = useState('');
  const [protocol, setProtocol] = useState('gRPC');
  const [bandwidthMbps, setBandwidthMbps] = useState('100.0');
  const [latencyMs, setLatencyMs] = useState('6.5');
  const [slaPct, setSlaPct] = useState('99.99');
  const [encryption, setEncryption] = useState('TLS_1_3');

  const API_HOST = 'http://localhost:3035';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [corridorRes, nodeRes] = await Promise.all([
        fetch(`${API_HOST}/api/architect/corridors`),
        fetch(`${API_HOST}/api/architect/nodes`)
      ]);

      const corridorData = await corridorRes.json();
      const nodeData = await nodeRes.json();

      if (corridorData.success && corridorData.data) {
        setCorridors(corridorData.data.corridors || []);
        setMetrics(corridorData.data.metrics || null);
      }
      if (nodeData.success && nodeData.data) {
        setNodes(nodeData.data || []);
      }
    } catch (err) {
      console.error('Failed to load topology mesh:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSeverCorridor = async (id) => {
    if (!window.confirm(`⚠️ SEVER CORRIDOR CONFIRMATION\nSever dependency corridor ${id}? This may disrupt synchronous RPC transactions.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_HOST}/api/architect/corridors/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCorridors(prev => prev.filter(c => c.id !== id));
        fetchData();
      }
    } catch (err) {
      console.error('Sever failed:', err);
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm(`⚠️ CASCADE DELETION WARNING\nDeleting node ${nodeId} will sever ALL connected incoming and outgoing communication corridors.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_HOST}/api/architect/nodes/${nodeId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Node deletion failed:', err);
    }
  };

  const handleProvision = async (e) => {
    e.preventDefault();
    if (!toNode.trim()) return;

    try {
      const res = await fetch(`${API_HOST}/api/architect/corridors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromNode,
          to: toNode,
          protocol,
          bandwidthMbps: parseFloat(bandwidthMbps) || 50,
          latencyMs: parseFloat(latencyMs) || 10,
          slaPct: parseFloat(slaPct) || 99.95,
          encryption,
          environment: 'production'
        })
      });

      if (res.ok) {
        setShowProvisionModal(false);
        setToNode('');
        fetchData();
      }
    } catch (err) {
      console.error('Provision failed:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(5, 8, 16, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '920px',
        maxHeight: '92vh',
        background: '#0d111a',
        border: '1px solid #2a334a',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.15)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1f273b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#121724'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399'
            }}>
              <Network size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.01em', margin: 0 }}>
                Architecture Topology Mesh & Telemetry Radar
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                Microservices dependency mesh, real-time RTT latency, and dynamic corridor provisioning
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenIngestion && (
              <button
                onClick={onOpenIngestion}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#818cf8',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Bulk Ingestion
              </button>
            )}
            <button
              onClick={() => setShowProvisionModal(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Provision Corridor
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Strip */}
        <div style={{
          padding: '12px 20px',
          background: '#090d16',
          borderBottom: '1px solid #1f273b',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '10px'
        }}>
          {[
            { label: 'ACTIVE CORRIDORS', value: metrics ? metrics.activeCorridors : corridors.length, color: '#34d399' },
            { label: 'AVG HOP LATENCY', value: metrics ? `${metrics.avgHopLatencyMs}ms` : '8.2ms', color: '#38bdf8' },
            { label: 'SLA COMPLIANCE', value: metrics ? `${metrics.avgSlaCompliancePct}%` : '99.98%', color: '#818cf8' },
            { label: 'TOTAL THROUGHPUT', value: metrics ? `${metrics.totalThroughputMbps} Mbps` : '460 Mbps', color: '#f59e0b' },
            { label: 'SYSTEM NODES', value: nodes.length, color: '#e2e8f0' }
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#121724',
              border: '1px solid #1f273b',
              borderRadius: '8px',
              padding: '8px 12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>{stat.label}</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: stat.color, marginTop: '2px' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
          {/* Active Corridors Matrix */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Active Architecture Dependency Corridors ({corridors.length})
              </span>
              <button
                onClick={fetchData}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {corridors.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: '#121724',
                    border: '1px solid #1f273b',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8'
                      }}>
                        {c.from}
                      </span>
                      <ArrowRight size={13} color="#64748b" />
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: 'rgba(129, 140, 248, 0.1)',
                        border: '1px solid rgba(129, 140, 248, 0.3)',
                        color: '#818cf8'
                      }}>
                        {c.to}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      <span style={{ color: '#10b981', fontWeight: '700' }}>{c.protocol}</span>
                      <span>{c.bandwidthMbps} Mbps</span>
                      <span>{c.latencyMs}ms RTT</span>
                      <span style={{ color: '#f59e0b' }}>{c.slaPct}% SLA</span>
                      <span style={{ color: '#64748b' }}>{c.encryption}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSeverCorridor(c.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={11} /> Sever
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* System Nodes Inventory */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Microservices & Data Stores ({nodes.length})
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
              {nodes.map((node) => (
                <div
                  key={node.id}
                  style={{
                    background: '#121724',
                    border: '1px solid #1f273b',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#f8fafc' }}>{node.name}</span>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      title="Cascade delete node"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                    <span>Tier: {node.tier}</span>
                    <span>Replicas: {node.replicas}</span>
                    <span style={{ color: node.hasCircuitBreaker ? '#10b981' : '#f59e0b' }}>
                      {node.hasCircuitBreaker ? 'Circuit Breaker' : 'No Breaker'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Provision Modal */}
      {showProvisionModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: '#0d111a',
            border: '1px solid #2a334a',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc', marginBottom: '12px', textTransform: 'uppercase' }}>
              + Provision Dependency Corridor
            </h4>
            <form onSubmit={handleProvision} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Source Node</label>
                <select
                  value={fromNode}
                  onChange={(e) => setFromNode(e.target.value)}
                  style={{ width: '100%', background: '#070a12', border: '1px solid #1f273b', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '11px' }}
                >
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.id})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Target Node ID</label>
                <input
                  value={toNode}
                  onChange={(e) => setToNode(e.target.value)}
                  placeholder="e.g. inventory_db or new_microservice"
                  required
                  style={{ width: '100%', background: '#070a12', border: '1px solid #1f273b', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '11px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Protocol</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    style={{ width: '100%', background: '#070a12', border: '1px solid #1f273b', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '11px' }}
                  >
                    <option value="gRPC">gRPC (HTTP/2)</option>
                    <option value="HTTP2">REST (HTTP/2)</option>
                    <option value="TCP_SQL">TCP / SQL Wire</option>
                    <option value="Kafka_Binary">Kafka Binary</option>
                    <option value="WebSocket">WebSocket</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Latency Target (ms)</label>
                  <input
                    value={latencyMs}
                    onChange={(e) => setLatencyMs(e.target.value)}
                    style={{ width: '100%', background: '#070a12', border: '1px solid #1f273b', color: '#fff', padding: '6px', borderRadius: '6px', fontSize: '11px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, background: '#10b981', border: 'none', color: '#ffffff', padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Provision Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
