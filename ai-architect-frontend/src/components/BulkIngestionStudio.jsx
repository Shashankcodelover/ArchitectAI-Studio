import React, { useState } from 'react';
import { Upload, Database, Network, Server, Trash2, CheckCircle2, AlertTriangle, RefreshCw, FileText, Code2, X } from 'lucide-react';

const TEMPLATES = {
  nodes: {
    endpoint: '/api/architect/nodes/upload',
    csv: `id,name,tier,replicas,hasCircuitBreaker
search_indexer,Elasticsearch Vector Store,DATABASE,3,true
recommendation_svc,Gemini Recommendation Agent,COMPUTE,2,true
notification_hub,Firebase Multi-Channel Dispatch,GATEWAY,2,false
audit_ledger,ClickHouse Telemetry Warehouse,DATABASE,1,false`,
    json: JSON.stringify([
      {
        id: "search_indexer",
        name: "Elasticsearch Vector Store",
        tier: "DATABASE",
        replicas: 3,
        hasCircuitBreaker: true
      },
      {
        id: "recommendation_svc",
        name: "Gemini Recommendation Agent",
        tier: "COMPUTE",
        replicas: 2,
        hasCircuitBreaker: true
      }
    ], null, 2)
  },
  corridors: {
    endpoint: '/api/architect/corridors/upload',
    csv: `from,to,protocol,bandwidth,latency,sla,encryption
api_gw,search_indexer,gRPC,150,3.2,99.99,mTLS
search_indexer,inventory_db,TCP_SQL,60,14.0,99.95,TLS_1_3
payment_svc,notification_hub,WebSocket,80,5.8,99.98,TLS_1_3`,
    json: JSON.stringify([
      {
        from: "api_gw",
        to: "search_indexer",
        protocol: "gRPC",
        bandwidthMbps: 150,
        latencyMs: 3.2,
        slaPct: 99.99,
        encryption: "mTLS"
      }
    ], null, 2)
  },
  topology: {
    endpoint: '/api/architect/topology/upload',
    csv: `from,to,protocol,bandwidth,latency,sla,encryption
api_gw,auth_svc,gRPC,120,2.5,99.99,mTLS
api_gw,cart_svc,HTTP2,85,2.1,99.95,TLS_1_3
cart_svc,payment_svc,gRPC,50,12.0,99.99,mTLS
payment_svc,inventory_db,TCP_SQL,60,18.0,99.90,TLS_1_3`,
    json: JSON.stringify({
      nodes: [
        { id: "edge_gw", name: "Cloudflare Edge Gateway", tier: "GATEWAY", replicas: 4, hasCircuitBreaker: true },
        { id: "ai_inference", name: "LangGraph Multi-Agent Cluster", tier: "COMPUTE", replicas: 3, hasCircuitBreaker: true }
      ],
      corridors: [
        { from: "edge_gw", to: "ai_inference", protocol: "gRPC", latencyMs: 4.8, slaPct: 99.99 }
      ]
    }, null, 2)
  }
};

export default function BulkIngestionStudio({ onClose, onRefreshData }) {
  const [entity, setEntity] = useState('nodes');
  const [format, setFormat] = useState('csv');
  const [payload, setPayload] = useState(TEMPLATES.nodes.csv);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const API_HOST = 'http://localhost:3035';

  const handleEntityChange = (newEntity) => {
    setEntity(newEntity);
    setPayload(format === 'csv' ? TEMPLATES[newEntity].csv : TEMPLATES[newEntity].json);
    setStatusMsg(null);
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    setPayload(newFormat === 'csv' ? TEMPLATES[entity].csv : TEMPLATES[entity].json);
    setStatusMsg(null);
  };

  const handleUpload = async () => {
    if (!payload.trim()) {
      setStatusMsg({ type: 'error', text: 'Payload buffer cannot be empty.' });
      return;
    }

    setIsUploading(true);
    setStatusMsg(null);

    try {
      const endpoint = `${API_HOST}${TEMPLATES[entity].endpoint}`;
      const isCsv = format === 'csv';

      let bodyData = payload;
      const headers = {};

      if (isCsv) {
        headers['Content-Type'] = 'text/csv';
      } else {
        headers['Content-Type'] = 'application/json';
        try {
          bodyData = JSON.stringify(JSON.parse(payload));
        } catch (e) {
          throw new Error(`Invalid JSON format: ${e.message}`);
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: bodyData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Upload failed with HTTP ${res.status}`);
      }

      setStatusMsg({
        type: 'success',
        text: data.message || `Successfully ingested records into architecture mesh!`
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUniversalPurge = async () => {
    const labels = {
      nodes: 'All Microservice Nodes & Linked Corridors',
      corridors: 'All Dependency Communication Corridors',
      topology: 'Entire Architecture Topology Netlist'
    };

    if (!window.confirm(`⚠️ UNIVERSAL PURGE WARNING\nAre you sure you want to purge ${labels[entity]}?\nThis action will sever live architecture links.`)) {
      return;
    }

    try {
      const purgeEndpoints = {
        nodes: '/api/architect/nodes',
        corridors: '/api/architect/corridors',
        topology: '/api/architect/nodes'
      };

      const res = await fetch(`${API_HOST}${purgeEndpoints[entity]}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      setStatusMsg({
        type: 'success',
        text: data.message || 'Universal deletion executed successfully.'
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const lineCount = payload.split('\n').length;
  const charCount = payload.length;

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
        maxWidth: '820px',
        maxHeight: '90vh',
        background: '#0d111a',
        border: '1px solid #2a334a',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(99, 102, 241, 0.15)',
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
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8'
            }}>
              <Upload size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.01em', margin: 0 }}>
                Enterprise Bulk Ingestion & Purge Studio
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                Batch ingestion for system nodes, dependency corridors, and full topology schemas
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleUniversalPurge}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={13} /> Universal Purge
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
          {/* Entity Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { id: 'nodes', label: 'System Nodes', icon: <Server size={14} />, desc: 'Microservices, DBs, Queues' },
              { id: 'corridors', label: 'Dependency Corridors', icon: <Network size={14} />, desc: 'Inter-service links & SLAs' },
              { id: 'topology', label: 'Full Topology', icon: <Database size={14} />, desc: 'Complete architecture netlist' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleEntityChange(tab.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: entity === tab.id ? '1px solid #6366f1' : '1px solid #1f273b',
                  background: entity === tab.id ? 'rgba(99, 102, 241, 0.12)' : '#121724',
                  color: entity === tab.id ? '#c7d2fe' : '#94a3b8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '12px' }}>
                  {tab.icon} {tab.label}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{tab.desc}</div>
              </button>
            ))}
          </div>

          {/* Format Selection & Template Injector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleFormatChange('csv')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  border: format === 'csv' ? '1px solid #10b981' : '1px solid #1f273b',
                  background: format === 'csv' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: format === 'csv' ? '#34d399' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <FileText size={12} /> CSV Stream
              </button>
              <button
                onClick={() => handleFormatChange('json')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  border: format === 'json' ? '1px solid #10b981' : '1px solid #1f273b',
                  background: format === 'json' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: format === 'json' ? '#34d399' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Code2 size={12} /> JSON Schema
              </button>
            </div>

            <button
              onClick={() => setPayload(format === 'csv' ? TEMPLATES[entity].csv : TEMPLATES[entity].json)}
              style={{
                background: 'transparent',
                border: '1px dashed #334155',
                color: '#94a3b8',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={11} /> Reset Template
            </button>
          </div>

          {/* Monospace Code Buffer */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '220px' }}>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '200px',
                background: '#070a12',
                border: '1px solid #1f273b',
                borderRadius: '8px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#38bdf8',
                lineHeight: '1.5',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
              <span>{lineCount} lines | {charCount} characters</span>
              <span>Target: {TEMPLATES[entity].endpoint}</span>
            </div>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: statusMsg.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: statusMsg.type === 'success' ? '#34d399' : '#f87171'
            }}>
              {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #1f273b',
          background: '#121724',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#94a3b8',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          )}
          <button
            onClick={handleUpload}
            disabled={isUploading}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: 'none',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.02em',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Upload size={14} />
            {isUploading ? 'Executing Batch...' : `Execute Bulk Ingestion (${format.toUpperCase()})`}
          </button>
        </div>
      </div>
    </div>
  );
}
