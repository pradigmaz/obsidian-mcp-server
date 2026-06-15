import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { obsidianKnowledgeQueryBenchmark } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-query-benchmark.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_query_benchmark', () => {
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

  it('calls POST /api/benchmark and respects schema parity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        pass: true,
        dataset_path: '.obsidian/knowledge-benchmarks.json',
        k: 5,
        query_count: 1,
        runs_count: 1,
        median_rule: 'single_run',
        topKHitRate: 100,
        mrr_at_k: 1.0,
        ndcg_at_k: 1.0,
        recall_at_k: 1.0,
        avg_estimated_tokens: 50,
        latency_p50_ms: 15,
        latency_p95_ms: 15,
        candidate: {
          runs: [{
            dataset_path: '.obsidian/knowledge-benchmarks.json',
            k: 5,
            query_count: 1,
            recall_at_k: 1,
            mrr_at_k: 1,
            ndcg_at_k: 1,
            avg_estimated_tokens: 50,
            latency_p50_ms: 15,
            latency_p95_ms: 15
          }],
          median: {
            dataset_path: '.obsidian/knowledge-benchmarks.json',
            k: 5,
            query_count: 1,
            recall_at_k: 1,
            mrr_at_k: 1,
            ndcg_at_k: 1,
            avg_estimated_tokens: 50,
            latency_p50_ms: 15,
            latency_p95_ms: 15
          }
        },
        thresholds: {},
        enforce_gates: false,
        cases: [
          {
            query: 'test',
            pass: true,
            missingPaths: [],
            rankingDrift: { 'test.md': 1 },
            mrr_at_k: 1.0,
            ndcg_at_k: 1.0,
            recall_at_k: 1.0,
            latency_ms: 15,
            avg_estimated_tokens: 50,
            latency_p50_ms: 15,
            latency_p95_ms: 15
          }
        ]
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeQueryBenchmark.handler(
      { 
        cases: [
          { query: 'test', expectedPaths: ['test.md'], minTopK: 5 }
        ]
      },
      mockCtx as any
    );

    // Validate request body shape matches plugin expectation
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/benchmark', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ 
        cases: [
          { query: 'test', expectedPaths: ['test.md'], minTopK: 5 }
        ]
      }),
    }));

    // Validate structured output
    expect(res.result.pass).toBe(true);
    expect(res.result.dataset_path).toBe('.obsidian/knowledge-benchmarks.json');
    expect(res.result.cases[0].rankingDrift['test.md']).toBe(1);

    const formatted = obsidianKnowledgeQueryBenchmark.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('✅ PASS');
  });
});
