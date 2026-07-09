import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeRouteTrace } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-route-trace.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_route_trace', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('calls POST /api/route-trace and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'A.md',
        target: 'B.md',
        path: ['A.md', 'B.md'],
        distance: 1,
        seed: { seed: 'A.md', seed_kind: 'note' },
        best_route: {
          segments: [
            {
              kind: 'link',
              path: 'A.md',
              language: 'md',
              evidence: 'Route seed.',
              relation_kind: 'reference',
              source_kind: 'vault',
              score: 1,
            },
            {
              kind: 'link',
              path: 'B.md',
              language: 'md',
              evidence: 'Linked from A.md.',
              relation_kind: 'reference',
              source_kind: 'vault',
              score: 1,
              from: 'A.md',
              to: 'B.md',
              direction: 'forward',
              relationKind: 'reference',
              confidence: 0.92,
              reasonCodes: ['direct_link_route'],
            },
          ],
          total_hops: 1,
          total_weight: 1,
          collapsed_hops: 0,
          confidence: 1,
        },
        alternate_routes: [],
        unresolved_gaps: [],
        capability_status: 'ok',
        unsupported_sources: [],
        confidence: 1,
        evidencePack: {
          items: [
            {
              kind: 'link',
              path: 'A.md',
              value: 'route seed',
              reasonCode: 'route_seed',
              weight: 0.8,
            },
          ],
          confidence: 0.8,
          gaps: [],
          provenance: {
            basis: 'graph_derived',
            derivation: 'route_trace',
            freshness: 'index_snapshot',
            strength: 'strong',
            reasons: ['route_seed'],
          },
        },
      }),
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    };

    const res = await obsidianKnowledgeRouteTrace.handler(
      { source: 'A', target: 'B' },
      mockCtx as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/route-trace',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'A', target: 'B' }),
      }),
    );

    expect(res.result.path).toHaveLength(2);

    const formatted = obsidianKnowledgeRouteTrace.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('A.md ➔ B.md');
    expect(formatted[0].text).toContain('Distance: 1');
    expect(formatted[0].text).toContain('Edge: A.md -> B.md');
    expect(formatted[0].text).toContain('Reasons: direct_link_route');
    expect(formatted[0].text).toContain('### Evidence');
    expect(formatted[0].text).toContain('route_seed');
  });
});
