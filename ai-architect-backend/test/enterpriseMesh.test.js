const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { TopologyCorridorService } = require('../topologyCorridorService.js');

describe('ArchitectAI Studio v5.0: Enterprise Topology Corridors & Bulk Ingestion Engine', () => {
  let service;

  beforeEach(() => {
    service = new TopologyCorridorService();
  });

  describe('Node Lifecycle & Cascading Deletion', () => {
    it('initializes with baseline Tier-1 e-commerce microservices', () => {
      const nodes = service.getAllNodes();
      assert.ok(nodes.length >= 5);
      const apiGw = service.getNodeById('api_gw');
      assert.strictEqual(apiGw.name, 'API Gateway');
      assert.strictEqual(apiGw.tier, 'GATEWAY');
    });

    it('creates new system nodes', () => {
      const node = service.createNode({
        id: 'recommendation_ai',
        name: 'Vector Recommendation Engine',
        tier: 'AI_MODEL',
        replicas: 4,
        hasCircuitBreaker: true
      });
      assert.strictEqual(node.id, 'recommendation_ai');
      assert.strictEqual(service.getNodeById('recommendation_ai').name, 'Vector Recommendation Engine');
    });

    it('cascades deletion: deleting a node severs all connected dependency corridors', () => {
      // payment_svc is connected to cart_svc, inventory_db, order_event_bus
      const initialCorridors = service.getAllCorridors();
      const connectedCount = initialCorridors.filter(c => c.from === 'payment_svc' || c.to === 'payment_svc').length;
      assert.ok(connectedCount > 0);

      const deleted = service.deleteNode('payment_svc');
      assert.strictEqual(deleted, true);
      assert.strictEqual(service.getNodeById('payment_svc'), undefined);

      // Verify connected corridors were automatically severed
      const remainingCorridors = service.getAllCorridors();
      const remainingConnected = remainingCorridors.filter(c => c.from === 'payment_svc' || c.to === 'payment_svc').length;
      assert.strictEqual(remainingConnected, 0);
    });

    it('executes universal node purge and cascading link severance', () => {
      const deletedCount = service.deleteAllNodes();
      assert.ok(deletedCount > 0);
      assert.strictEqual(service.getAllNodes().length, 0);
      assert.strictEqual(service.getAllCorridors().length, 0);
    });
  });

  describe('Corridor Telemetry & Severing Controls', () => {
    it('computes live architecture telemetry metrics', () => {
      const metrics = service.getMetrics();
      assert.strictEqual(metrics.totalCorridors, service.getAllCorridors().length);
      assert.ok(metrics.activeCorridors > 0);
      assert.ok(metrics.avgHopLatencyMs > 0);
      assert.ok(metrics.totalThroughputMbps > 0);
      assert.ok(metrics.avgSlaCompliancePct >= 99);
    });

    it('provisions new dependency corridor with protocol and SLA', () => {
      const corridor = service.provisionCorridor({
        from: 'api_gw',
        to: 'order_event_bus',
        protocol: 'WebSocket',
        bandwidthMbps: 90.0,
        latencyMs: 8.5,
        slaPct: 99.98,
        encryption: 'TLS_1_3'
      });
      assert.ok(corridor.id);
      assert.strictEqual(corridor.protocol, 'WebSocket');
      assert.strictEqual(service.getCorridorById(corridor.id).from, 'api_gw');
    });

    it('severs dependency corridor with 1-click control', () => {
      const corridors = service.getAllCorridors();
      const target = corridors[0];
      const severed = service.severCorridor(target.id);
      assert.strictEqual(severed, true);
      assert.strictEqual(service.getCorridorById(target.id), undefined);
    });

    it('executes universal corridor purge', () => {
      const initialCount = service.getAllCorridors().length;
      assert.ok(initialCount > 0);
      const purged = service.deleteAllCorridors();
      assert.strictEqual(purged, initialCount);
      assert.strictEqual(service.getAllCorridors().length, 0);
    });
  });

  describe('Batch Ingestion (CSV & JSON)', () => {
    it('parses and bulk creates system nodes from CSV', () => {
      const csv = `id,name,tier,replicas,hasCircuitBreaker
search_indexer,Elasticsearch Cluster,DATABASE,3,true
notification_hub,Push Dispatcher,COMPUTE,2,false`;

      const parsed = service.parseNodeCSV(csv);
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].id, 'search_indexer');
      assert.strictEqual(parsed[0].tier, 'DATABASE');
      assert.strictEqual(parsed[0].replicas, 3);
      assert.strictEqual(parsed[0].hasCircuitBreaker, true);

      const created = service.bulkCreateNodes(parsed);
      assert.strictEqual(created.length, 2);
      assert.ok(service.getNodeById('search_indexer'));
    });

    it('parses and bulk creates dependency corridors from CSV', () => {
      const csv = `from,to,protocol,bandwidth,latency,sla,encryption
api_gw,search_indexer,gRPC,100,4.5,99.99,mTLS
search_indexer,inventory_db,TCP_SQL,50,15.0,99.90,TLS_1_3`;

      const parsed = service.parseCorridorCSV(csv);
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].from, 'api_gw');
      assert.strictEqual(parsed[0].to, 'search_indexer');
      assert.strictEqual(parsed[0].protocol, 'gRPC');

      const created = service.bulkCreateCorridors(parsed);
      assert.strictEqual(created.length, 2);
    });
  });
});
