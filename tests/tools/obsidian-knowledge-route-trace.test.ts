import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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
        distance: 1
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeRouteTrace.handler({ source: 'A', target: 'B' }, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/route-trace', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ source: 'A', target: 'B' })
    }));

    expect(res.result.path).toHaveLength(2);

    const formatted = obsidianKnowledgeRouteTrace.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('A.md ➔ B.md');
    expect(formatted[0].text).toContain('Distance: 1');
  });
});
