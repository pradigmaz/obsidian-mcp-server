import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeConceptCluster } from '@/mcp-server/tools/definitions/obsidian-knowledge-concept-cluster.tool.js';
import { obsidianKnowledgeJanitorScan } from '@/mcp-server/tools/definitions/obsidian-knowledge-janitor-scan.tool.js';
import { obsidianKnowledgeQueryBenchmark } from '@/mcp-server/tools/definitions/obsidian-knowledge-query-benchmark.tool.js';
import { obsidianKnowledgeRouteTrace } from '@/mcp-server/tools/definitions/obsidian-knowledge-route-trace.tool.js';
import { obsidianKnowledgeSignalMemoryTool } from '@/mcp-server/tools/definitions/obsidian-knowledge-signal-memory.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockCtx = {
  fail: vi.fn(),
  recoveryFor: vi.fn(),
};

describe('Knowledge proxy tools', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_API_KEY = 'test-key';
    process.env.OBSIDIAN_BASE_URL = 'http://127.0.0.1:27123';
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_API_KEY;
    delete process.env.OBSIDIAN_BASE_URL;
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('routes route_trace through POST /api/route-trace', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ source: 'A.md', target: 'B.md', path: ['A.md', 'B.md'], distance: 1 }),
    });

    const res = await obsidianKnowledgeRouteTrace.handler(
      { source: 'A.md', target: 'B.md' },
      mockCtx as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/route-trace',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'A.md', target: 'B.md' }),
      }),
    );
    expect(res.result.distance).toBe(1);
  });

  it('routes concept_cluster through POST /api/concept-cluster', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ concept: 'OKF', cluster: ['Spec.md'], relatedConcepts: ['Markdown'] }),
    });

    const res = await obsidianKnowledgeConceptCluster.handler(
      { concept: 'OKF', depth: 2 },
      mockCtx as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/concept-cluster',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ concept: 'OKF', depth: 2 }),
      }),
    );
    expect(res.result.cluster).toEqual(['Spec.md']);
  });

  it('routes janitor_scan through POST /api/janitor-scan', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unstructuredNotes: ['MissingType.md'], scannedCount: 3 }),
    });

    const res = await obsidianKnowledgeJanitorScan.handler({ folder: 'Knowledge' }, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/janitor-scan',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ folder: 'Knowledge' }),
      }),
    );
    expect(res.result.unstructuredNotes).toEqual(['MissingType.md']);
  });

  it('routes query_benchmark through POST /api/benchmark', async () => {
    const input = {
      cases: [{ query: 'OKF', expectedPaths: ['Spec.md'], minTopK: 3 }],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        pass: true,
        dataset_path: '.obsidian/knowledge-benchmarks.json',
        k: 3,
        query_count: 1,
        runs_count: 1,
        median_rule: 'single_run',
        topKHitRate: 100,
        mrr_at_k: 1,
        ndcg_at_k: 1,
        recall_at_k: 1,
        avg_estimated_tokens: 1,
        latency_p50_ms: 1,
        latency_p95_ms: 1,
        thresholds: {},
        enforce_gates: false,
        cases: [],
      }),
    });

    const res = await obsidianKnowledgeQueryBenchmark.handler(input, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/benchmark',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
    expect(res.result.pass).toBe(true);
  });

  it('routes signal_memory list/status through GET without a body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await obsidianKnowledgeSignalMemoryTool.handler({ action: 'list' }, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/signals',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('routes signal_memory mark through POST /api/signals/mark', async () => {
    const entry = {
      signalKey: 'missing_props:Note.md',
      ruleId: 'missing_props',
      path: 'Note.md',
      decision: 'resolved' as const,
      reason: 'metadata added',
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    const input = {
      action: 'mark' as const,
      signalKey: entry.signalKey,
      ruleId: entry.ruleId,
      path: entry.path,
      decision: entry.decision,
      reason: entry.reason,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => entry,
    });

    const res = await obsidianKnowledgeSignalMemoryTool.handler(input, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/signals/mark',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
    expect(res.result).toEqual(entry);
  });
});
