import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeSmartSearch } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-smart-search.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to generate a compliant RMU QueryReport mock
function createMockQueryReport(overrides = {}) {
  return {
    query_id: 'test-query-id-123',
    timestamp_utc: new Date().toISOString(),
    project_root: 'D:\\mcp',
    resolved_mode: 'review_prep',
    mode_source: 'inferred',
    budget: {
      max_tokens: 15000,
      used_estimate: 250,
      hard_truncated: false,
    },
    retrieval_pipeline: [
      { stage: 'omnisearch', candidates: 50, kept: 20 },
      { stage: 'graph-rerank', candidates: 20, kept: 5 },
    ],
    selected_context: [
      {
        path: 'concepts/okf.md',
        score: 4.8,
        chars: 1200,
        chunk_idx: 0,
        start_line: 1,
        end_line: 45,
        chunk_source: 'omnisearch',
        source_class: 'canonical_note',
        why: ['text match', 'backlink boost'],
        explain: {
          lexical: 1.5,
          graph: 3.3,
          semantic: 0.0,
          rrf: 0.8,
          graph_rrf: 0.9,
          rank_before: 2,
          rank_after: 1,
          semantic_source: 'none',
          semantic_outcome: 'skipped',
          graph_seed_path: 'concepts/okf.md',
          graph_edge_kinds: ['backlink'],
          graph_hops: 1,
        },
        provenance: {
          basis: 'indexed',
          derivation: 'omnisearch text search',
          freshness: 'index_snapshot',
          strength: 'strong',
          reasons: ['direct keyword match'],
        },
      },
    ],
    provenance: {
      basis: 'mixed',
      derivation: 'retrieval pipeline execution',
      freshness: 'index_snapshot',
      strength: 'strong',
    },
    confidence: {
      overall: 0.9,
      reasons: ['good text match and high graph centrality'],
      signals: {
        margin_top1_top2: 1.2,
        explain_coverage: 1.0,
        semantic_coverage: 0.0,
        semantic_outcome: 'skipped',
        stage_drop_ratio: 0.2,
        hard_truncated: false,
      },
    },
    gaps: [],
    index_telemetry: {
      last_index_lock_wait_ms: 5,
      last_embedding_cache_hits: 12,
      last_embedding_cache_misses: 2,
      chunk_coverage: 0.95,
      chunk_source: 'omnisearch',
    },
    degradation_reasons: [],
    deepen_available: false,
    ...overrides,
  };
}

describe('obsidian_knowledge_smart_search E2E tests', () => {
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

  // Tier 1: Feature Coverage (Root queryReport fields & explain blocks)
  it('F1.1 - F1.5: returns full RMU QueryReport structure and complies with schema requirements', async () => {
    const mockReport = createMockQueryReport();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        query: 'test query',
        results: [
          {
            path: 'concepts/okf.md',
            title: 'OKF spec',
            score: 4.8,
            originalScore: 1.5,
            graphScore: 3.3,
            source: 'omnisearch',
            excerpt: 'Open Knowledge Format spec details',
            why: ['text match', 'backlink boost'],
          },
        ],
        queryReport: mockReport,
      }),
    });

    const res = await obsidianKnowledgeSmartSearch.handler({ query: 'test query', limit: 5 }, {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    } as any);

    const report = res.result.queryReport as any;
    expect(report).toBeDefined();
    expect(report.query_id).toBe('test-query-id-123');
    expect(report.timestamp_utc).toBeDefined();
    expect(report.project_root).toBe('D:\\mcp');
    expect(report.resolved_mode).toBe('review_prep');
    expect(report.mode_source).toBe('inferred');
    expect(report.budget.max_tokens).toBe(15000);
    expect(report.retrieval_pipeline).toHaveLength(2);
    expect(report.selected_context).toHaveLength(1);
    expect(report.provenance.basis).toBe('mixed');
    expect(report.confidence.overall).toBe(0.9);
    expect(report.confidence.signals.margin_top1_top2).toBe(1.2);
    expect(report.index_telemetry.last_index_lock_wait_ms).toBe(5);
    expect(report.degradation_reasons).toHaveLength(0);
    expect(report.deepen_available).toBe(false);
  });

  it('F2.1 - F2.5: returns detailed score parts and explain blocks matching spec', async () => {
    const mockReport = createMockQueryReport();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        query: 'explain query',
        results: [
          {
            path: 'concepts/okf.md',
            title: 'OKF spec',
            score: 4.8,
            originalScore: 1.5,
            graphScore: 3.3,
            scoreParts: {
              omnisearch: 1.5,
              backlinks: 2.0,
              outgoingLinks: 0.5,
              tagFolder: 0.3,
              recency: 0.5,
              apiSurface: 0.0,
              generatedPenalty: 1.0,
            },
            source: 'omnisearch',
            excerpt: 'Open Knowledge Format spec details',
            why: ['text match', 'backlink boost'],
          },
        ],
        queryReport: mockReport,
      }),
    });

    const res = await obsidianKnowledgeSmartSearch.handler({ query: 'explain query', limit: 10 }, {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    } as any);

    const hit = res.result.results[0];
    expect(hit.scoreParts).toBeDefined();
    expect(hit.scoreParts?.omnisearch).toBe(1.5);
    expect(hit.scoreParts?.backlinks).toBe(2.0);
    expect(hit.scoreParts?.outgoingLinks).toBe(0.5);

    const contextItem = res.result.queryReport?.selected_context?.[0] as any;
    expect(contextItem).toBeDefined();
    expect(contextItem.explain.lexical).toBe(1.5);
    expect(contextItem.explain.graph).toBe(3.3);
    expect(contextItem.explain.rank_before).toBe(2);
    expect(contextItem.explain.rank_after).toBe(1);
    expect(contextItem.provenance.basis).toBe('indexed');
  });

  // Tier 1: Search Intent Adaptation (F3.1 - F3.5)
  it('F3.1 - F3.5: sends intent parameter successfully and formats report correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        query: 'research query',
        results: [],
        queryReport: createMockQueryReport({
          resolved_mode: 'review_prep',
          mode_source: 'explicit',
        }),
      }),
    });

    const intents = ['lookup', 'research', 'decision', 'cleanup', 'bootstrap'] as const;
    for (const intent of intents) {
      await obsidianKnowledgeSmartSearch.handler({ query: 'intent query', limit: 5, intent }, {
        fail: vi.fn(),
        recoveryFor: vi.fn(),
      } as any);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://127.0.0.1:27125/api/search',
        expect.objectContaining({
          body: JSON.stringify({ query: 'intent query', limit: 5, intent }),
        }),
      );
    }
  });

  // Tier 1: Fallback execution and degradation telemetry (F4.1 - F4.5)
  it('F4.1 - F4.5: handles search degradation when omnisearch is unavailable', async () => {
    const mockReport = createMockQueryReport({
      source: 'vault-text',
      fallbackUsed: true,
      degradation_reasons: ['chunk_preview_fallback'],
      warnings: ['omnisearch disabled'],
      fallbackTelemetry: {
        scanLimit: 500,
        scannedFiles: 25,
        totalMarkdownFiles: 100,
        matchingFiles: 25,
        capped: false,
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        query: 'fallback query',
        results: [],
        queryReport: mockReport,
      }),
    });

    const res = await obsidianKnowledgeSmartSearch.handler({ query: 'fallback query', limit: 5 }, {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    } as any);

    expect(res.result.queryReport?.fallbackUsed).toBe(true);
    expect(res.result.queryReport?.degradation_reasons).toContain('chunk_preview_fallback');
    expect(res.result.queryReport?.warnings).toContain('omnisearch disabled');
    const parsed = obsidianKnowledgeSmartSearch.output.parse(res);
    expect(parsed.result.queryReport?.fallbackTelemetry?.scanLimit).toBe(500);
  });

  // Tier 1: Metadata Filters Integration (F5.1 - F5.5)
  it('F5.1 - F5.5: passes filters and receives matching filters in queryReport', async () => {
    const filters = {
      pathPrefix: 'concepts/',
      tags: ['#tag'],
      fileTypes: ['md'],
      modifiedAfter: 1000,
      modifiedBefore: 2000,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        query: 'filtered query',
        results: [],
        queryReport: createMockQueryReport({ filters }),
      }),
    });

    const res = await obsidianKnowledgeSmartSearch.handler(
      { query: 'filtered query', limit: 5, filters },
      { fail: vi.fn(), recoveryFor: vi.fn() } as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/search',
      expect.objectContaining({
        body: JSON.stringify({ query: 'filtered query', limit: 5, filters }),
      }),
    );

    expect(res.result.queryReport?.filters).toMatchObject(filters);
  });

  // Tier 2: Boundary & Corner Cases (B1.1 - B1.5)
  it('B1.2: validates limit > 50 is capped or throws validation error from schema definition', async () => {
    expect(() =>
      obsidianKnowledgeSmartSearch.input.parse({ query: 'too high', limit: 100 }),
    ).toThrow();
  });

  it('B1.3: rejects limit < 1 via input validation', async () => {
    expect(() =>
      obsidianKnowledgeSmartSearch.input.parse({ query: 'too low', limit: 0 }),
    ).toThrow();
  });
});
