import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obsidianKnowledgeStatus } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-status.tool.js';

describe('obsidianKnowledgeStatus', () => {
  let mockCtx: any;

  beforeEach(() => {
    process.env.OBSIDIAN_API_KEY = 'test-key';
    process.env.OBSIDIAN_BASE_URL = 'http://127.0.0.1:27123';
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
    mockCtx = {
      fail: vi.fn((reason, message, data, options) => {
        const err = new Error(message);
        Object.assign(err, { reason, data, options });
        return err;
      }),
      recoveryFor: vi.fn((reason) => ({ recovery: `recover_${reason}` })),
    };
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_API_KEY;
    delete process.env.OBSIDIAN_BASE_URL;
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.unstubAllGlobals();
  });

  it('returns diagnostic fallback without pretending the plugin schema was validated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const out = await obsidianKnowledgeStatus.handler({}, mockCtx);

    expect(out.result).toMatchObject({
      status: 'blocked',
      schemaVersion: 'unknown',
      errors: ['Knowledge Analytics endpoint is not reachable at http://127.0.0.1:27125.'],
    });
  });

  it('formats healthy status correctly', async () => {
    const formatted = obsidianKnowledgeStatus.format({
      result: {
        status: 'ready',
        schemaVersion: '0.1.0',
        pluginVersion: '1.0.0',
        vaultName: 'TestVault',
        enabledModules: ['core', 'search'],
        startupDependencies: [
          {
            elapsedMs: 12,
            name: 'database',
            state: 'none',
            recovery: 'No local DB/backend is configured for this MCP server.',
          },
          {
            elapsedMs: 80,
            name: 'obsidian',
            state: 'ready',
          },
        ],
        requiredCapabilities: [
          {
            id: 'knowledge-search',
            name: 'Smart Search',
            version: '0.1.0',
            status: 'ready',
            endpoints: ['/api/search'],
            tools: ['obsidian_knowledge_smart_search'],
            dependencies: ['Omnisearch'],
          },
        ],
      },
    });

    expect(formatted[0].type).toBe('text');
    expect(formatted[0].text).toContain('- Status: ready');
    expect(formatted[0].text).toContain('- Plugin version: 1.0.0');
    expect(formatted[0].text).toContain('- Vault: TestVault');
    expect(formatted[0].text).toContain('- Modules: core, search');
    expect(formatted[0].text).toContain('### Startup Dependencies');
    expect(formatted[0].text).toContain('- database: none (12ms)');
    expect(formatted[0].text).toContain('- obsidian: ready (80ms)');
    expect(formatted[0].text).toContain('- Capabilities: knowledge-search');
  });

  it('formats degraded status with warnings and errors', async () => {
    const formatted = obsidianKnowledgeStatus.format({
      result: {
        status: 'degraded',
        schemaVersion: '0.1.0',
        warnings: ['Some warning'],
        errors: ['Some error'],
        recoveryHint: 'Fix something',
      },
    });

    expect(formatted[0].type).toBe('text');
    expect(formatted[0].text).toContain('- Status: degraded');
    expect(formatted[0].text).toContain('### Warnings');
    expect(formatted[0].text).toContain('- Some warning');
    expect(formatted[0].text).toContain('### Errors');
    expect(formatted[0].text).toContain('- Some error');
    expect(formatted[0].text).toContain('**Recovery Hint**: Fix something');
  });
});
