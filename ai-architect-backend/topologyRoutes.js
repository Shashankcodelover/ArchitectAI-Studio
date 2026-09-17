/**
 * topologyRoutes.js
 * ArchitectAI Studio v5.0 — REST Endpoints for Architecture Corridors, Nodes, and Bulk Ingestion
 */

const express = require('express');
const { topologyCorridorService } = require('./topologyCorridorService.js');
const systemTopologyAuditor = require('./systemTopologyAuditor.js');

const topologyRouter = express.Router();

// ── CORRIDORS ────────────────────────────────────────────────────────
// GET /api/architect/corridors — List corridors & telemetry metrics
topologyRouter.get('/corridors', (req, res) => {
  res.json({
    success: true,
    data: {
      corridors: topologyCorridorService.getAllCorridors(),
      metrics: topologyCorridorService.getMetrics()
    }
  });
});

// POST /api/architect/corridors — Provision new corridor
topologyRouter.post('/corridors', (req, res) => {
  try {
    const { from, to, protocol, bandwidthMbps, latencyMs, slaPct, encryption, environment } = req.body;
    if (!from || !to) {
      return res.status(400).json({ success: false, error: "'from' and 'to' node IDs are required." });
    }

    const corridor = topologyCorridorService.provisionCorridor({
      from,
      to,
      protocol,
      bandwidthMbps,
      latencyMs,
      slaPct,
      encryption,
      environment
    });

    res.status(201).json({ success: true, data: corridor });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/architect/corridors/:id — Sever corridor
topologyRouter.delete('/corridors/:id', (req, res) => {
  const ok = topologyCorridorService.severCorridor(req.params.id);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Corridor not found' });
  }
  res.json({ success: true, message: `Corridor ${req.params.id} severed successfully.` });
});

// DELETE /api/architect/corridors — Universal Corridor Purge
topologyRouter.delete('/corridors', (req, res) => {
  const count = topologyCorridorService.deleteAllCorridors();
  res.json({ success: true, message: `Universal purge: severed all ${count} corridors.`, count });
});

// POST /api/architect/corridors/upload — Batch Corridor Ingestion (CSV / JSON)
topologyRouter.post('/corridors/upload', (req, res) => {
  try {
    let items = [];
    if (typeof req.body === 'string') {
      items = topologyCorridorService.parseCorridorCSV(req.body);
    } else if (Array.isArray(req.body)) {
      items = req.body;
    } else if (req.body && typeof req.body === 'object') {
      if (req.body.csv && typeof req.body.csv === 'string') {
        items = topologyCorridorService.parseCorridorCSV(req.body.csv);
      } else if (Array.isArray(req.body.corridors)) {
        items = req.body.corridors;
      } else {
        items = [req.body];
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid corridor records found in payload.' });
    }

    const created = topologyCorridorService.bulkCreateCorridors(items);
    res.status(201).json({
      success: true,
      message: `Successfully provisioned ${created.length} architecture corridors.`,
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── NODES ─────────────────────────────────────────────────────────────
// GET /api/architect/nodes — List nodes
topologyRouter.get('/nodes', (req, res) => {
  res.json({
    success: true,
    data: topologyCorridorService.getAllNodes()
  });
});

// POST /api/architect/nodes — Create node
topologyRouter.post('/nodes', (req, res) => {
  try {
    const node = topologyCorridorService.createNode(req.body);
    res.status(201).json({ success: true, data: node });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/architect/nodes/:id — Cascade delete node and connected corridors
topologyRouter.delete('/nodes/:id', (req, res) => {
  const ok = topologyCorridorService.deleteNode(req.params.id);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Node not found' });
  }
  res.json({ success: true, message: `Node ${req.params.id} deleted with cascading corridor integrity.` });
});

// DELETE /api/architect/nodes — Universal Node Purge
topologyRouter.delete('/nodes', (req, res) => {
  const count = topologyCorridorService.deleteAllNodes();
  res.json({ success: true, message: `Universal purge: deleted all ${count} nodes and severed all links.`, count });
});

// POST /api/architect/nodes/upload — Batch Node Ingestion (CSV / JSON)
topologyRouter.post('/nodes/upload', (req, res) => {
  try {
    let items = [];
    if (typeof req.body === 'string') {
      items = topologyCorridorService.parseNodeCSV(req.body);
    } else if (Array.isArray(req.body)) {
      items = req.body;
    } else if (req.body && typeof req.body === 'object') {
      if (req.body.csv && typeof req.body.csv === 'string') {
        items = topologyCorridorService.parseNodeCSV(req.body.csv);
      } else if (Array.isArray(req.body.nodes)) {
        items = req.body.nodes;
      } else {
        items = [req.body];
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid node records found in payload.' });
    }

    const created = topologyCorridorService.bulkCreateNodes(items);
    res.status(201).json({
      success: true,
      message: `Successfully ingested ${created.length} system architecture nodes.`,
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/architect/topology/upload — Batch Ingest full topology netlist and audit
topologyRouter.post('/topology/upload', (req, res) => {
  try {
    const payload = req.body;
    let nodes = [];
    let edges = [];

    if (payload.nodes && Array.isArray(payload.nodes)) {
      nodes = topologyCorridorService.bulkCreateNodes(payload.nodes);
    }
    if (payload.edges && Array.isArray(payload.edges)) {
      edges = topologyCorridorService.bulkCreateCorridors(payload.edges);
    } else if (payload.corridors && Array.isArray(payload.corridors)) {
      edges = topologyCorridorService.bulkCreateCorridors(payload.corridors);
    }

    // Run audit on new topology
    const auditResult = systemTopologyAuditor.auditTopology({
      nodes: topologyCorridorService.getAllNodes(),
      edges: topologyCorridorService.getAllCorridors()
    });

    res.status(201).json({
      success: true,
      message: `Ingested topology: ${nodes.length} nodes, ${edges.length} corridors.`,
      audit: auditResult,
      data: {
        nodes: topologyCorridorService.getAllNodes(),
        corridors: topologyCorridorService.getAllCorridors()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { topologyRouter };
