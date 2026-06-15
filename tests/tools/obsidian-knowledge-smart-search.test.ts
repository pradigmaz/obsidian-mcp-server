import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { obsidianKnowledgeSmartSearch } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-smart-search.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_smart_search', () => {
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

  it('calls POST /api/search and returns formatted results including why and queryReport', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        query: 'test query',
        results: [
          { path: 'test.md', score: 2.5, why: ['link boost'], excerpt: 'some excerpt' }
        ],
        queryReport: {
          source: 'vault-text',
          fallbackUsed: true,
          resultCount: 1,
          warnings: ['omnisearch disabled']
        }
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeSmartSearch.handler(
      { 
        query: 'test query', 
        limit: 5,
        intent: 'research',
        filters: { tags: ['#project'] }
      },
      mockCtx as any
    );

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ 
        query: 'test query', 
        limit: 5,
        intent: 'research',
        filters: { tags: ['#project'] }
      }),
    }));

    expect(res.result.queryReport?.fallbackUsed).toBe(true);

    const formatted = obsidianKnowledgeSmartSearch.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('test query');
    expect(formatted[0].text).toContain('used text fallback');
    expect(formatted[0].text).toContain('Why: link boost');
    expect(formatted[0].text).toContain('test.md (score: 2.50)');
  });
});
