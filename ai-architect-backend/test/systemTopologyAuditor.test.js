const { describe, it } = require('node:test');
const assert = require('node:assert');

const auditor = require('../systemTopologyAuditor');

describe('ArchitectAI Studio v5.0: Autonomous System Topology & Resiliency Auditor', () => {

  it('retrieves architecture topology presets', () => {
    const presets = auditor.getPresets();
    assert.strictEqual(Array.isArray(presets), true);
    assert.ok(presets.length >= 2);

    const checkout = presets.find(p => p.id === 'e_commerce_checkout');
    assert.ok(checkout);
    assert.strictEqual(checkout.nodeCount, 5);
    assert.strictEqual(checkout.edgeCount, 4);
  });

  it('validates High-Availability E-Commerce checkout topology with zero deadlocks', () => {
    const preset = auditor.getPresetById('e_commerce_checkout');
    const result = auditor.auditTopology(preset);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.hasDeadlock, false);
    assert.strictEqual(result.cyclicDeadlockPath, null);
    assert.ok(result.resiliencyScore >= 80);
    assert.strictEqual(result.statusTier, 'HIGH_AVAILABILITY');
    assert.ok(result.cryptographicPassport.startsWith('0xARCHITECT-CERT-'));
  });

  it('accurately flags synchronous cyclic deadlocks and reports loop path', () => {
    const deadlockPreset = auditor.getPresetById('cyclic_deadlock_demo');
    const result = auditor.auditTopology(deadlockPreset);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.hasDeadlock, true);
    assert.ok(result.cyclicDeadlockPath.includes('User Management Service'));
    assert.ok(result.cyclicDeadlockPath.includes('Order Processing Service'));
    assert.ok(result.cyclicDeadlockPath.includes('Notification Dispatcher'));
    assert.ok(result.resiliencyScore < 60);
    assert.ok(result.mathematicalGuarantee.includes('VIOLATION'));
  });

  it('detects un-replicated Single Points of Failure (SPOFs) under high centrality', () => {
    const customTopology = {
      nodes: [
        { id: 'node_a', name: 'Gateway', tier: 'GATEWAY', replicas: 2 },
        { id: 'spof_hub', name: 'Legacy Central Monolith', tier: 'COMPUTE', replicas: 1 }, // SPOF!
        { id: 'node_c', name: 'Billing', tier: 'COMPUTE', replicas: 2 },
        { id: 'node_d', name: 'Analytics', tier: 'COMPUTE', replicas: 2 }
      ],
      edges: [
        { from: 'node_a', to: 'spof_hub' },
        { from: 'spof_hub', to: 'node_c' },
        { from: 'spof_hub', to: 'node_d' }
      ]
    };

    const result = auditor.auditTopology(customTopology);
    assert.strictEqual(result.success, true);
    assert.ok(result.singlePointsOfFailure.length >= 1);
    const spof = result.singlePointsOfFailure.find(s => s.nodeId === 'spof_hub');
    assert.ok(spof);
    assert.ok(spof.reason.includes('zero standby replica redundancy'));
  });

  it('computes percolation failure blast radius when primary hub drops', () => {
    const topology = {
      nodes: [
        { id: 'gw', name: 'Edge Gateway', tier: 'GATEWAY', replicas: 2 },
        { id: 'core', name: 'Core Mesh Hub', tier: 'COMPUTE', replicas: 2 },
        { id: 'leaf_1', name: 'Worker 1', tier: 'COMPUTE', replicas: 2 },
        { id: 'leaf_2', name: 'Worker 2', tier: 'COMPUTE', replicas: 2 }
      ],
      edges: [
        { from: 'gw', to: 'core' },
        { from: 'core', to: 'leaf_1' },
        { from: 'core', to: 'leaf_2' }
      ]
    };

    const result = auditor.auditTopology(topology);
    assert.strictEqual(result.success, true);
    assert.ok(result.percolationAnalysis.mostCriticalNode.includes('Core Mesh Hub'));
    assert.ok(result.percolationAnalysis.maxBlastRadiusPercent > 0);
  });
});
