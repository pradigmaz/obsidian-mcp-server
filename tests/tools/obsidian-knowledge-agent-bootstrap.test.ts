import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { obsidianKnowledgeAgentBootstrap } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-agent-bootstrap.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_agent_bootstrap', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_API_KEY = 'test-key';
    process.env.OBSIDIAN_BASE_URL = 'http://127.0.0.1:27123';
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_API_KEY;
    delete process.env.OBSIDIAN_BASE_URL;
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
  });

  it('calls POST /api/bootstrap and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        brief: { filesCount: 42, topTags: [{ tag: '#test', count: 1 }] },
        notes: [{ path: 'test.md', title: 'Test', score: 1.5, excerpt: 'Hello world' }],
        relevantLinks: ['other.md'],
        relevantBacklinks: ['source.md'],
        openQuestions: ['Is this a test?'],
        profile: 'fast',
        degradation_reasons: [],
        deepen_available: true,
        query_bundle: {
          query: 'test query',
          limit: 5,
          semantic: false,
          resolved_mode: 'lexical_graph',
          mode_source: 'knowledge_plugin',
          max_chars: 100,
          max_tokens: 25,
          hits: [{ path: 'test.md', title: 'Test', score: 1.5, excerpt: 'Hello world' }],
          context: { notes: [{ path: 'test.md', title: 'Test', score: 1.5, excerpt: 'Hello world' }] },
          provenance: { source: 'knowledge-obsidian-plugin', generated_at: '2026-06-16T00:00:00.000Z' },
          followups: ['Is this a test?']
        },
        timings: {
          index_ready_ms: 0,
          brief_ms: 1,
          search_ms: 2,
          context_ms: 0,
          investigation_ms: 0,
          report_ms: 0,
          total_ms: 3
        },
        trimmed_sections: [],
        suggestedTools: ['tool_a']
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeAgentBootstrap.handler(
      { query: 'test query', limit: 5, budget: 100 },
      mockCtx as any
    );

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/bootstrap', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: 'test query', limit: 5, budget: 100 }),
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Schema-Version': '0.1.0'
      })
    }));

    expect(res.result.brief.filesCount).toStrictEqual(42);

    const formatted = obsidianKnowledgeAgentBootstrap.format(res);
    expect(formatted[0].text).toContain('**Agent Bootstrap Context**');
    expect(formatted[0].text).toContain('Profile: fast');
    expect(formatted[0].text).toContain('- Markdown notes: 42');
    expect(formatted[0].text).toContain('- Top tags: #test (1)');
    expect(formatted[0].text).toContain('- **test.md** (score: 1.50)');
    expect(formatted[0].text).toContain('*Excerpt*: Hello world');
    expect(formatted[0].text).toContain('### Nearby Links');
    expect(formatted[0].text).toContain('- other.md');
    expect(formatted[0].text).toContain('### Nearby Backlinks');
    expect(formatted[0].text).toContain('- source.md');
    expect(formatted[0].text).toContain('**Open Questions:**');
    expect(formatted[0].text).toContain('- Is this a test?');
  });
});
