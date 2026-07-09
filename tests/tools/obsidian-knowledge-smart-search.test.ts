import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
          {
            path: 'test.md',
            score: 2.5,
            bestSection: {
              path: 'test.md',
              heading: 'Result Section',
              headingLevel: 2,
              blockId: null,
              startLine: 10,
              endLine: 18,
              excerpt: 'some excerpt',
              reasonCodes: ['body_match'],
            },
            scoreParts: {
              omnisearch: 1,
              backlinks: 0.5,
              outgoingLinks: 0.2,
              tagFolder: 0.1,
              recency: 0.1,
              apiSurface: 0.6,
              generatedPenalty: 1,
            },
            evidencePack: {
              items: [
                {
                  kind: 'section',
                  path: 'test.md',
                  line: 10,
                  value: 'Result Section',
                  reasonCode: 'heading_match',
                  weight: 0.95,
                },
              ],
              confidence: 0.9,
              gaps: [],
              provenance: {
                basis: 'mixed',
                derivation: 'evidence_pack',
                freshness: 'index_snapshot',
                strength: 'strong',
                reasons: ['heading_match'],
              },
            },
            why: ['link boost'],
            excerpt: 'some excerpt',
          },
        ],
        queryReport: {
          source: 'vault-text',
          fallbackUsed: true,
          resultCount: 1,
          warnings: ['omnisearch disabled'],
          filters: { tags: ['#project'] },
          fallbackTelemetry: {
            scanLimit: 500,
            scannedFiles: 10,
            totalMarkdownFiles: 100,
            matchingFiles: 10,
            capped: false,
          },
          topRankingFactors: ['omnisearch', 'apiSurface'],
          degradation: ['vault-text'],
        },
      }),
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    };

    const res = await obsidianKnowledgeSmartSearch.handler(
      {
        query: 'test query',
        limit: 5,
        intent: 'research',
        filters: { tags: ['#project'] },
      },
      mockCtx as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'test query',
          limit: 5,
          intent: 'research',
          filters: { tags: ['#project'] },
        }),
        headers: expect.objectContaining({
          'X-Gatekeeper-Strict': 'true',
        }),
      }),
    );

    expect(res.result.queryReport?.fallbackUsed).toBe(true);
    expect(res.result.queryReport?.fallbackTelemetry?.scannedFiles).toBe(10);

    const formatted = obsidianKnowledgeSmartSearch.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('test query');
    expect(formatted[0].text).toContain('used text fallback');
    expect(formatted[0].text).toContain('Why: link boost');
    expect(formatted[0].text).toContain('Evidence: heading_match=Result Section');
    expect(formatted[0].text).toContain('test.md (score: 2.50)');
    expect(formatted[0].text).toContain('Section: L10-L18 Result Section');
  });

  it('can explicitly allow degraded search without strict Gatekeeper', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'degraded',
        query: 'test query',
        results: [],
      }),
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn(),
    };

    await obsidianKnowledgeSmartSearch.handler(
      {
        query: 'test query',
        limit: 2,
        allow_degraded: true,
      },
      mockCtx as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'test query',
          limit: 2,
          allow_degraded: true,
        }),
        headers: expect.not.objectContaining({
          'X-Gatekeeper-Strict': 'true',
        }),
      }),
    );
  });
});
