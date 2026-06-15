import { describe, expect, it } from 'vitest';
import { obsidianKnowledgeStatus } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-status.tool.js';

describe('obsidianKnowledgeStatus', () => {
  it('formats healthy status correctly', async () => {
    const formatted = obsidianKnowledgeStatus.format({
      result: {
        status: 'ready',
        schemaVersion: '0.1.0',
        pluginVersion: '1.0.0',
        vaultName: 'TestVault',
        enabledModules: ['core', 'search'],
        requiredCapabilities: [{
          id: 'knowledge-search',
          name: 'Smart Search',
          version: '0.1.0',
          status: 'ready',
          endpoints: ['/api/search'],
          tools: ['obsidian_knowledge_smart_search'],
          dependencies: ['Omnisearch'],
        }],
      },
    });
    
    expect(formatted[0].type).toBe('text');
    expect(formatted[0].text).toContain('- Status: ready');
    expect(formatted[0].text).toContain('- Plugin version: 1.0.0');
    expect(formatted[0].text).toContain('- Vault: TestVault');
    expect(formatted[0].text).toContain('- Modules: core, search');
    expect(formatted[0].text).toContain('- Capabilities: knowledge-search');
  });

  it('formats degraded status with warnings and errors', async () => {
    const formatted = obsidianKnowledgeStatus.format({
      result: {
        status: 'degraded',
        schemaVersion: '0.1.0',
        warnings: ['Some warning'],
        errors: ['Some error'],
        recoveryHint: 'Fix something'
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
