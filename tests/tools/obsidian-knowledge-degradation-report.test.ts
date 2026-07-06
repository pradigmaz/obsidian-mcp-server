import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeDegradationReport } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-degradation-report.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_degradation_report', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('calls GET /api/degradation and formats recovery hints', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name === 'x-knowledge-plugin' ? '1' : '0.1.0' },
      json: async () => ({
        status: 'degraded',
        degradation_reasons: ['omnisearch_unavailable'],
        recovery_actions: [{
          code: 'refresh_omnisearch_index',
          action: 'Enable Omnisearch refreshIndex.',
          safe: false,
        }],
        omnisearch: { available: false, refreshIndexAvailable: false },
        knowledgePlugin: { schemaVersion: '0.1.0', pluginVersion: '1.0.0', endpointReachable: true },
        vault: { name: 'vault', noteCount: 12, highFindings: 1 },
      }),
    });

    const mockCtx = { fail: vi.fn(), recoveryFor: vi.fn(() => ({})) };
    const res = await obsidianKnowledgeDegradationReport.handler({}, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/degradation',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(res.result.status).toBe('degraded');

    const formatted = obsidianKnowledgeDegradationReport.format(res);
    expect(formatted[0].text).toContain('**Knowledge Degradation Report**');
    expect(formatted[0].text).toContain('omnisearch_unavailable');
    expect(formatted[0].text).toContain('refresh_omnisearch_index: not safe');
  });
});
