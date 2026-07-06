import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeConceptCluster } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-concept-cluster.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_concept_cluster', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('calls POST /api/concept-cluster and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        concept: 'AI',
        seed: { seed: 'AI', seed_kind: 'basename' },
        variants: [],
        cluster_summary: {
          variant_count: 2,
          languages: ['md'],
          route_kinds: ['direct_link'],
          top_relation_kinds: ['direct_link'],
          confidence: 0.8,
        },
        gaps: [],
        capability_status: 'ok',
        unsupported_sources: [],
        confidence: 0.8,
        member_evidence: [{
          path: 'AI.md',
          evidence: [{
            kind: 'direct_link',
            path: 'AI.md',
            value: 'cluster seed',
            confidence: 1,
            reasonCodes: ['cluster_seed'],
          }],
        }],
        cluster: ['AI.md', 'Agents.md'],
        relatedConcepts: ['LLM', 'Prompting'],
      }),
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    };

    const res = await obsidianKnowledgeConceptCluster.handler({ concept: 'AI' }, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/concept-cluster',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ concept: 'AI' }),
      }),
    );

    expect(res.result.cluster).toHaveLength(2);

    const formatted = obsidianKnowledgeConceptCluster.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('Concept Cluster: AI');
    expect(formatted[0].text).toContain('Cluster Notes (2)');
    expect(formatted[0].text).toContain('Related Concepts (2)');
    expect(formatted[0].text).toContain('Top relation kinds: direct_link');
    expect(formatted[0].text).toContain('### Member Evidence');
    expect(formatted[0].text).toContain('direct_link: cluster seed');
  });
});
