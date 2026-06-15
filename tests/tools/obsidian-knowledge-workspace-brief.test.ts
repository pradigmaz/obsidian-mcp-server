import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { obsidianKnowledgeWorkspaceBrief } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-workspace-brief.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_workspace_brief', () => {
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

  it('calls GET /api/brief and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        vaultName: 'TestVault',
        filesCount: 100,
        attachmentCount: 50,
        linksCount: 200,
        unresolvedLinksCount: 10,
        isolatedNotes: 5,
        topFolders: [{ folder: '/', count: 50 }],
        topTags: [{ tag: '#test', count: 5 }],
        commonProperties: [{ property: 'status', count: 80 }],
        missingKeyProperties: 20,
        recentNotes: ['recent.md'],
        staleHighCentralityNotes: ['old_hub.md'],
        entryPoints: [{ path: 'hub.md', score: 10 }],
        projectNotes: ['project.md']
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeWorkspaceBrief.handler({}, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/brief', expect.objectContaining({
      method: 'GET',
    }));

    expect(res.result.filesCount).toBe(100);

    const formatted = obsidianKnowledgeWorkspaceBrief.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('- Vault: TestVault');
    expect(formatted[0].text).toContain('- Markdown notes: 100');
    expect(formatted[0].text).toContain('- /: 50');
    expect(formatted[0].text).toContain('- #test: 5');
    expect(formatted[0].text).toContain('- status: 80');
    expect(formatted[0].text).toContain('- recent.md');
    expect(formatted[0].text).toContain('- old_hub.md');
    expect(formatted[0].text).toContain('- hub.md (10)');
    expect(formatted[0].text).toContain('- project.md');
  });
});
