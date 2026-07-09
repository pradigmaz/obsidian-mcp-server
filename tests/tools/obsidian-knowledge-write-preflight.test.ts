import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeWritePreflight } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-write-preflight.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_write_preflight', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('calls POST /api/write/preflight and formats blocked/degraded results without generic errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-knowledge-plugin' ? '1' : '0.1.0'),
      },
      json: async () => ({
        status: 'blocked',
        allowed: false,
        checks: [
          {
            id: 'path_vault_relative',
            status: 'fail',
            message: 'Path must be vault-relative and must not escape the vault.',
          },
          { id: 'frontmatter_type', status: 'warn', message: 'Frontmatter should include type.' },
        ],
        requiredFixes: ['Path must be vault-relative and must not escape the vault.'],
        warnings: ['Frontmatter should include type.'],
        safeApplyHint: 'Do not write. Resolve requiredFixes and run preflight again.',
      }),
    });

    const ctx = {
      fail: vi.fn((reason: string, message: string) => new Error(`${reason}: ${message}`)),
      recoveryFor: vi.fn(() => ({})),
    };
    const input = {
      operation: 'create' as const,
      path: '../escape.md',
      frontmatter: { title: 'Escape' },
      contentPreview: '# Escape',
    };

    const res = await obsidianKnowledgeWritePreflight.handler(input, ctx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/write/preflight',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
    expect(ctx.fail).not.toHaveBeenCalled();
    expect(res.result.status).toBe('blocked');
    expect(res.result.allowed).toBe(false);

    const formatted = obsidianKnowledgeWritePreflight.format(res);
    expect(formatted[0].text).toContain('Knowledge Write Preflight: blocked');
    expect(formatted[0].text).toContain('Allowed: no');
    expect(formatted[0].text).toContain('FAIL path_vault_relative');
    expect(formatted[0].text).toContain('Required fixes:');
  });
});
