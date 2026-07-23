import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readToolDefinitions,
  writeToolDefinitions,
} from '../../src/mcp-server/tools/definitions/index.js';
import { obsidianKnowledgeAgentMemoryCapture } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-agent-memory-capture.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockCtx = {
  fail: vi.fn(),
  recoveryFor: vi.fn(),
};

describe('obsidian_knowledge_agent_memory_capture', () => {
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

  it('posts a bounded structured capture to the plugin', async () => {
    const input = {
      workspacePath: 'E:\\Projects\\Alpha',
      agent: 'codex' as const,
      session: {
        id: 'session-1',
        goal: 'Remember the result',
        summary: 'Tests passed',
        status: 'completed' as const,
        decisions: ['Use one vault'],
      },
      facts: [
        {
          type: 'decision' as const,
          statement: 'Use the existing Obsidian vault.',
          confidence: 'confirmed' as const,
        },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        workspaceKey: 'alpha-12345678',
        memoryRoot: 'Agent Tooling/Memory/alpha-12345678',
        sessionPath: 'Agent Tooling/Memory/alpha-12345678/sessions/2026-07-23--codex--session-1.md',
        factPaths: ['Agent Tooling/Memory/alpha-12345678/facts/decision--abc.md'],
        skippedFacts: 0,
      }),
    });

    const result = await obsidianKnowledgeAgentMemoryCapture.handler(input, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:27125/api/memory/capture',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
    expect(result.result).toMatchObject({ status: 'ok', workspaceKey: 'alpha-12345678' });
    expect(obsidianKnowledgeAgentMemoryCapture.format(result)[0].text).toContain('alpha-12345678');
  });

  it('is registered only as a write tool', () => {
    expect(
      writeToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_agent_memory_capture'),
    ).toBe(true);
    expect(
      readToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_agent_memory_capture'),
    ).toBe(false);
  });
});
