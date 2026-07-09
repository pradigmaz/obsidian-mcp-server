import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeApplyPatch } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-apply-patch.tool.js';
import { obsidianKnowledgePreviewPatch } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-preview-patch.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const preflight = {
  status: 'ok',
  allowed: true,
  checks: [],
  requiredFixes: [],
  warnings: [],
  safeApplyHint: 'safe',
};

describe('Knowledge patch tools', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('previews a patch without write auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-knowledge-plugin' ? '1' : '0.1.0'),
      },
      json: async () => ({
        status: 'ok',
        diff: '--- before\n+++ after',
        beforeHash: 'sha256:before',
        afterHash: 'sha256:after',
        affectedRange: { startLine: 1, endLine: 2 },
        preflight,
      }),
    });

    const input = {
      path: 'Notes/Patch.md',
      baseHash: 'sha256:before',
      baseMtime: 1,
      mode: 'append_to_note' as const,
      content: 'Tail',
    };
    const res = await obsidianKnowledgePreviewPatch.handler(input, {
      fail: vi.fn(),
      recoveryFor: vi.fn(() => ({})),
    } as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/write/preview-patch',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
    expect(res.result.status).toBe('ok');
    expect(obsidianKnowledgePreviewPatch.format(res)[0].text).toContain(
      'Knowledge Patch Preview: ok',
    );
  });

  it('maps stale apply conflicts as blocked results with recovery detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-knowledge-plugin' ? '1' : '0.1.0'),
      },
      json: async () => ({
        status: 'blocked',
        applied: false,
        path: 'Notes/Patch.md',
        beforeHash: 'sha256:current',
        afterHash: 'sha256:after',
        backupPath: null,
        auditId: 'patch-test',
        postWriteValidation: {
          status: 'ok',
          violations: [],
          newViolations: [],
          resolvedViolations: [],
        },
      }),
    });

    const ctx = {
      fail: vi.fn((reason: string, message: string) => new Error(`${reason}: ${message}`)),
      recoveryFor: vi.fn(() => ({})),
    };
    const input = {
      path: 'Notes/Patch.md',
      baseHash: 'sha256:stale',
      baseMtime: 1,
      mode: 'append_to_note' as const,
      content: 'Tail',
    };
    const res = await obsidianKnowledgeApplyPatch.handler(input, ctx as any);

    expect(ctx.fail).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/write/apply-patch',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
    expect(res.result.status).toBe('blocked');
    expect(res.result.applied).toBe(false);
    expect(obsidianKnowledgeApplyPatch.format(res)[0].text).toContain('Applied: no');
    expect(obsidianKnowledgeApplyPatch.format(res)[0].text).toContain('reread the note');
  });

  it('allows replace_file create calls without baseHash and baseMtime', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-knowledge-plugin' ? '1' : '0.1.0'),
      },
      json: async () => ({
        status: 'ok',
        applied: true,
        path: 'Notes/New.md',
        beforeHash: null,
        afterHash: 'sha256:after',
        backupPath: null,
        auditId: 'patch-create',
        postWriteValidation: {
          status: 'ok',
          violations: [],
          newViolations: [],
          resolvedViolations: [],
        },
      }),
    });

    const input = {
      path: 'Notes/New.md',
      mode: 'replace_file' as const,
      content: '---\ntype: concept\n---\n# New\n',
    };
    const res = await obsidianKnowledgeApplyPatch.handler(input, {
      fail: vi.fn(),
      recoveryFor: vi.fn(() => ({})),
    } as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/write/apply-patch',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
    expect(res.result.beforeHash).toBeNull();
    expect(obsidianKnowledgeApplyPatch.format(res)[0].text).toContain('Before:');
  });
});
