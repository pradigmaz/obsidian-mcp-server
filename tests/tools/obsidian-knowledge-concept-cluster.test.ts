import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { obsidianKnowledgeConceptCluster } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-concept-cluster.tool.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('obsidian_knowledge_concept_cluster', () => {
  beforeEach(() => {
    process.env.OBSIDIAN_KNOWLEDGE_URL = 'http://127.0.0.1:27125';
  });

  afterEach(() => {
    delete process.env.OBSIDIAN_KNOWLEDGE_URL;
    vi.clearAllMocks();
  });

  it('calls POST /api/concept-cluster and formats response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        concept: 'AI',
        cluster: ['AI.md', 'Agents.md'],
        relatedConcepts: ['LLM', 'Prompting']
      })
    });

    const mockCtx = {
      fail: vi.fn(),
      recoveryFor: vi.fn()
    };

    const res = await obsidianKnowledgeConceptCluster.handler({ concept: 'AI' }, mockCtx as any);

    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/api/concept-cluster', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ concept: 'AI' })
    }));

    expect(res.result.cluster).toHaveLength(2);

    const formatted = obsidianKnowledgeConceptCluster.format(res);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toContain('Concept Cluster: AI');
    expect(formatted[0].text).toContain('Cluster Notes (2)');
    expect(formatted[0].text).toContain('Related Concepts (2)');
  });
});
