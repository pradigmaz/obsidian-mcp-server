import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { obsidianKnowledgeHealthReport } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-health-report.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_health_report', () => {
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

  it('calls GET /api/health and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        hotspots: [
          {
            path: 'lonely.md',
            score: 5,
            roles: [],
            violations: [{
              ruleId: 'isolated_note',
              severity: 'warn',
              evidence: 'No links',
              suggestedStep: 'Link it',
              expectedEffortMin: 2
            }]
          }
        ],
        groupedByFolder: {},
        groupedByTag: {}
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeHealthReport.handler({}, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/health', expect.objectContaining({
      method: 'GET',
    }));

    expect(res.result.hotspots[0].path).toBe('lonely.md');

    const formatted = obsidianKnowledgeHealthReport.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('Total Hotspots: 1');
    expect(formatted[0].text).toContain('lonely.md');
  });
});
