/**
 * topologyCorridorService.js
 * ArchitectAI Studio v5.0 — Enterprise Architecture Dependency Corridors & Microservice Netlist Store
 */

class TopologyCorridorService {
  constructor() {
    this.nodes = [
      { id: 'api_gw', name: 'API Gateway', tier: 'GATEWAY', replicas: 3, hasCircuitBreaker: true, status: 'healthy', latencyMs: 4.2 },
      { id: 'auth_svc', name: 'OAuth2 Auth Token Service', tier: 'AUTH', replicas: 2, hasCircuitBreaker: true, status: 'healthy', latencyMs: 12.0 },
      { id: 'cart_svc', name: 'Redis Cart Store', tier: 'CACHE', replicas: 3, hasCircuitBreaker: true, status: 'healthy', latencyMs: 2.1 },
      { id: 'payment_svc', name: 'Stripe Payment Relay', tier: 'COMPUTE', replicas: 2, hasCircuitBreaker: true, status: 'healthy', latencyMs: 85.4 },
      { id: 'inventory_db', name: 'PostgreSQL Inventory Master-Replica', tier: 'DATABASE', replicas: 2, hasCircuitBreaker: false, status: 'healthy', latencyMs: 18.2 },
      { id: 'order_event_bus', name: 'Kafka Order Events Topic', tier: 'QUEUE', replicas: 3, hasCircuitBreaker: true, status: 'healthy', latencyMs: 6.5 }
    ];

    this.corridors = [
      {
        id: 'corridor-gw-auth',
        from: 'api_gw',
        to: 'auth_svc',
        protocol: 'gRPC',
        bandwidthMbps: 120.0,
        latencyMs: 3.5,
        packetLossPct: 0.01,
        slaPct: 99.99,
        encryption: 'TLS_1_3',
        status: 'active',
        environment: 'production'
      },
      {
        id: 'corridor-gw-cart',
        from: 'api_gw',
        to: 'cart_svc',
        protocol: 'HTTP2',
        bandwidthMbps: 85.0,
        latencyMs: 2.8,
        packetLossPct: 0.02,
        slaPct: 99.95,
        encryption: 'mTLS',
        status: 'active',
        environment: 'production'
      },
      {
        id: 'corridor-cart-pay',
        from: 'cart_svc',
        to: 'payment_svc',
        protocol: 'gRPC',
        bandwidthMbps: 45.0,
        latencyMs: 14.2,
        packetLossPct: 0.05,
        slaPct: 99.99,
        encryption: 'mTLS',
        status: 'active',
        environment: 'production'
      },
      {
        id: 'corridor-pay-db',
        from: 'payment_svc',
        to: 'inventory_db',
        protocol: 'TCP_SQL',
        bandwidthMbps: 60.0,
        latencyMs: 18.0,
        packetLossPct: 0.01,
        slaPct: 99.90,
        encryption: 'TLS_1_3',
        status: 'active',
        environment: 'production'
      },
      {
        id: 'corridor-pay-kafka',
        from: 'payment_svc',
        to: 'order_event_bus',
        protocol: 'Kafka_Binary',
        bandwidthMbps: 150.0,
        latencyMs: 5.2,
        packetLossPct: 0.0,
        slaPct: 99.99,
        encryption: 'SASL_SSL',
        status: 'active',
        environment: 'production'
      }
    ];
  }

  // ── NODES CRUD ─────────────────────────────────────────────
  getAllNodes() {
    return [...this.nodes];
  }

  getNodeById(id) {
    return this.nodes.find(n => n.id === id);
  }

  createNode(nodeData) {
    const id = nodeData.id || `node_${Date.now().toString(36)}`;
    const newNode = {
      id,
      name: nodeData.name || 'Microservice Node',
      tier: nodeData.tier || 'COMPUTE',
      replicas: Number(nodeData.replicas) || 1,
      hasCircuitBreaker: Boolean(nodeData.hasCircuitBreaker),
      status: nodeData.status || 'healthy',
      latencyMs: Number(nodeData.latencyMs) || 10.0
    };
    this.nodes.push(newNode);
    return newNode;
  }

  deleteNode(id) {
    const idx = this.nodes.findIndex(n => n.id === id);
    if (idx === -1) return false;
    this.nodes.splice(idx, 1);
    // Cascading integrity: sever all corridors connected to this node
    this.corridors = this.corridors.filter(c => c.from !== id && c.to !== id);
    return true;
  }

  deleteAllNodes() {
    const count = this.nodes.length;
    this.nodes = [];
    this.corridors = [];
    return count;
  }

  bulkCreateNodes(nodesList) {
    const created = [];
    for (const n of nodesList) {
      if (n && (n.id || n.name)) {
        created.push(this.createNode(n));
      }
    }
    return created;
  }

  parseNodeCSV(csvContent) {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idIdx = headers.findIndex(h => h === 'id' || h.includes('node_id'));
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const tierIdx = headers.findIndex(h => h.includes('tier') || h.includes('type'));
    const repIdx = headers.findIndex(h => h.includes('replica'));
    const cbIdx = headers.findIndex(h => h.includes('breaker') || h.includes('circuit'));

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      const id = idIdx !== -1 ? cols[idIdx] : cols[0];
      const name = nameIdx !== -1 ? cols[nameIdx] : cols[1];
      const tier = (tierIdx !== -1 ? cols[tierIdx] : 'COMPUTE').toUpperCase();
      const replicas = repIdx !== -1 ? parseInt(cols[repIdx], 10) || 1 : 1;
      const hasCircuitBreaker = cbIdx !== -1 ? (cols[cbIdx].toLowerCase() === 'true' || cols[cbIdx] === '1') : false;

      parsed.push({ id, name, tier, replicas, hasCircuitBreaker });
    }
    return parsed;
  }

  // ── CORRIDORS CRUD ─────────────────────────────────────────
  getAllCorridors() {
    return [...this.corridors];
  }

  getCorridorById(id) {
    return this.corridors.find(c => c.id === id);
  }

  getMetrics() {
    const total = this.corridors.length;
    if (total === 0) {
      return {
        totalCorridors: 0,
        activeCorridors: 0,
        avgHopLatencyMs: 0,
        avgSlaCompliancePct: 100,
        totalThroughputMbps: 0,
        nodeCount: this.nodes.length
      };
    }
    const active = this.corridors.filter(c => c.status === 'active').length;
    const totalLat = this.corridors.reduce((sum, c) => sum + (c.latencyMs || 0), 0);
    const totalSla = this.corridors.reduce((sum, c) => sum + (c.slaPct || 99.9), 0);
    const totalBw = this.corridors.reduce((sum, c) => sum + (c.bandwidthMbps || 0), 0);

    return {
      totalCorridors: total,
      activeCorridors: active,
      avgHopLatencyMs: Math.round((totalLat / total) * 10) / 10,
      avgSlaCompliancePct: Math.round((totalSla / total) * 100) / 100,
      totalThroughputMbps: Math.round(totalBw * 10) / 10,
      nodeCount: this.nodes.length
    };
  }

  provisionCorridor(corridorData) {
    const id = corridorData.id || `corridor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newCorridor = {
      id,
      from: corridorData.from || 'api_gw',
      to: corridorData.to || 'auth_svc',
      protocol: corridorData.protocol || 'gRPC',
      bandwidthMbps: Number(corridorData.bandwidthMbps) || 50.0,
      latencyMs: Number(corridorData.latencyMs) || 12.0,
      packetLossPct: Number(corridorData.packetLossPct) || 0.01,
      slaPct: Number(corridorData.slaPct) || 99.95,
      encryption: corridorData.encryption || 'TLS_1_3',
      status: corridorData.status || 'active',
      environment: corridorData.environment || 'production'
    };
    this.corridors.push(newCorridor);
    return newCorridor;
  }

  severCorridor(id) {
    const idx = this.corridors.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.corridors.splice(idx, 1);
    return true;
  }

  severByEndpoints(from, to) {
    const initial = this.corridors.length;
    this.corridors = this.corridors.filter(c => !(c.from === from && c.to === to));
    return this.corridors.length < initial;
  }

  deleteAllCorridors() {
    const count = this.corridors.length;
    this.corridors = [];
    return count;
  }

  bulkCreateCorridors(corridorsList) {
    const created = [];
    for (const c of corridorsList) {
      if (c && c.from && c.to) {
        created.push(this.provisionCorridor(c));
      }
    }
    return created;
  }

  parseCorridorCSV(csvContent) {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const fromIdx = headers.findIndex(h => h === 'from' || h.includes('source'));
    const toIdx = headers.findIndex(h => h === 'to' || h.includes('target'));
    const protoIdx = headers.findIndex(h => h.includes('protocol'));
    const bwIdx = headers.findIndex(h => h.includes('bandwidth') || h.includes('mbps'));
    const latIdx = headers.findIndex(h => h.includes('latency'));
    const slaIdx = headers.findIndex(h => h.includes('sla'));
    const encIdx = headers.findIndex(h => h.includes('encryption'));

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      const from = fromIdx !== -1 ? cols[fromIdx] : cols[0];
      const to = toIdx !== -1 ? cols[toIdx] : cols[1];
      if (!from || !to) continue;

      parsed.push({
        from,
        to,
        protocol: protoIdx !== -1 ? cols[protoIdx] : 'gRPC',
        bandwidthMbps: bwIdx !== -1 ? parseFloat(cols[bwIdx]) || 50.0 : 50.0,
        latencyMs: latIdx !== -1 ? parseFloat(cols[latIdx]) || 10.0 : 10.0,
        slaPct: slaIdx !== -1 ? parseFloat(cols[slaIdx]) || 99.95 : 99.95,
        encryption: encIdx !== -1 ? cols[encIdx] : 'TLS_1_3',
        status: 'active',
        environment: 'production'
      });
    }
    return parsed;
  }
}

const topologyCorridorService = new TopologyCorridorService();
module.exports = { topologyCorridorService, TopologyCorridorService };
