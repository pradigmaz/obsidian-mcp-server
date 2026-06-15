import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it, vi } from 'vitest';
import { LintClient } from '@/services/obsidian/gatekeeper/lint-client.js';

function clientFor(response: Response): LintClient {
  return new LintClient({
    config: { knowledgeUrl: 'http://127.0.0.1:27125' },
    dispatcher: undefined,
    fetch: vi.fn().mockResolvedValue(response),
  } as any);
}

describe('LintClient', () => {
  it('rejects HTTP 200 responses when valid is false', async () => {
    const client = clientFor(Response.json({
      valid: false,
      violations: [{ severity: 'high', ruleId: 'missing_okf', evidence: 'missing type', suggestedStep: 'add type' }],
    }));

    await expect(client.lintWrite(createMockContext(), '/vault/N.md', '# n')).rejects.toMatchObject({
      data: expect.objectContaining({ reason: 'gatekeeper_rejected' }),
    });
  });
});
