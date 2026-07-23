import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAgentMemoryHook,
  resetAgentMemoryHookState,
  resolveHookWorkspace,
} from '../../src/hooks/agent-memory-hook.js';

describe('agent memory lifecycle hook', () => {
  beforeEach(() => resetAgentMemoryHookState());

  it('resolves the workspace from supported client payloads', () => {
    expect(resolveHookWorkspace({ cwd: 'E:\\Projects\\Alpha' }, {}, 'C:\\fallback')).toBe(
      'E:\\Projects\\Alpha',
    );
    expect(
      resolveHookWorkspace(
        { workspace_roots: [{ path: 'E:\\Projects\\Beta' }] },
        {},
        'C:\\fallback',
      ),
    ).toBe('E:\\Projects\\Beta');
  });

  it('returns bounded untrusted startup memory for Codex', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        notes: [
          {
            path: 'Agent Tooling/Memory/alpha/facts/a.md',
            title: 'Decision',
            excerpt: 'Use one vault.',
          },
        ],
      }),
    });

    const output = await handleAgentMemoryHook(
      'sessionstart',
      'codex',
      { cwd: 'E:\\Projects\\Alpha' },
      { fetch: fetch as typeof globalThis.fetch, env: {}, cwd: 'C:\\fallback', timeoutMs: 25 },
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/bootstrap',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"workspacePath":"E:\\\\Projects\\\\Alpha"'),
      }),
    );
    expect(output).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: expect.stringContaining('<agent-memory>'),
      },
    });
    expect(JSON.stringify(output)).toContain('untrusted');
    expect(JSON.stringify(output).length).toBeLessThanOrEqual(6500);
  });

  it('captures a compact stop summary once per session', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) });
    const payload = {
      cwd: 'E:\\Projects\\Alpha',
      session_id: 'session-1',
      last_assistant_message: 'Implemented and verified the shared memory path.',
    };

    const first = await handleAgentMemoryHook('stop', 'claude', payload, {
      fetch: fetch as typeof globalThis.fetch,
      env: {},
      cwd: 'C:\\fallback',
      timeoutMs: 25,
    });
    const second = await handleAgentMemoryHook('stop', 'claude', payload, {
      fetch: fetch as typeof globalThis.fetch,
      env: {},
      cwd: 'C:\\fallback',
      timeoutMs: 25,
    });

    expect(first).toEqual({});
    expect(second).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      workspacePath: 'E:\\Projects\\Alpha',
      agent: 'claude',
      session: {
        id: 'session-1',
        summary: 'Implemented and verified the shared memory path.',
      },
    });
  });

  it('fails open on malformed payloads and network errors', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(
      handleAgentMemoryHook(
        'sessionstart',
        'codex',
        { cwd: 'E:\\Projects\\Alpha' },
        {
          fetch: fetch as typeof globalThis.fetch,
          env: {},
          cwd: 'C:\\fallback',
          timeoutMs: 25,
        },
      ),
    ).resolves.toEqual({});
    await expect(
      handleAgentMemoryHook(
        'stop',
        'gemini',
        { cwd: 'E:\\Projects\\Alpha' },
        {
          fetch: fetch as typeof globalThis.fetch,
          env: {},
          cwd: 'C:\\fallback',
          timeoutMs: 25,
        },
      ),
    ).resolves.toEqual({});
  });
});
