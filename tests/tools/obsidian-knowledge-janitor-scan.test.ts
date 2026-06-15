import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { obsidianKnowledgeJanitorScan } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-janitor-scan.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_janitor_scan', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('calls POST /api/janitor-scan and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        unstructuredNotes: ['bad1.md', 'bad2.md'],
        scannedCount: 10
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeJanitorScan.handler({ folder: 'test' }, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/janitor-scan', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ folder: 'test' })
    }));

    expect(res.result.scannedCount).toBe(10);
    expect(res.result.unstructuredNotes).toHaveLength(2);

    const formatted = obsidianKnowledgeJanitorScan.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('Janitor Scan Complete');
    expect(formatted[0].text).toContain('Scanned: 10 notes');
    expect(formatted[0].text).toContain('- bad1.md');
  });
});
