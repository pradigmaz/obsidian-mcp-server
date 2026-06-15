import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { requestKnowledgeJson } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('requestKnowledgeJson', () => {
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
    vi.clearAllMocks();
  });

  it('handles fetch network errors with knowledge_unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(requestKnowledgeJson({
      path: '/test',
      ctx: mockCtx,
    })).rejects.toThrow('Knowledge Analytics endpoint is not reachable at http://127.0.0.1:27125');

    expect(mockCtx.fail).toHaveBeenCalledWith(
      'knowledge_unreachable',
      expect.any(String),
      expect.objectContaining({ baseUrl: 'http://127.0.0.1:27125', path: '/test', recovery: 'recover_knowledge_unreachable' }),
      expect.objectContaining({ cause: expect.any(Error) })
    );
  });

  it('handles non-JSON responses with knowledge_bad_response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 502,
      ok: false,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    await expect(requestKnowledgeJson({
      path: '/test',
      ctx: mockCtx,
    })).rejects.toThrow('Knowledge Analytics endpoint returned non-JSON response with status 502.');

    expect(mockCtx.fail).toHaveBeenCalledWith(
      'knowledge_bad_response',
      expect.any(String),
      expect.objectContaining({ status: 502, path: '/test', recovery: 'recover_knowledge_bad_response' }),
      expect.objectContaining({ cause: expect.any(Error) })
    );
  });

  it('handles JSON responses with error status with knowledge_bad_response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    await expect(requestKnowledgeJson({
      path: '/test',
      ctx: mockCtx,
    })).rejects.toThrow('Knowledge Analytics endpoint returned status 400.');

    expect(mockCtx.fail).toHaveBeenCalledWith(
      'knowledge_bad_response',
      expect.any(String),
      expect.objectContaining({ status: 400, path: '/test', payload: { error: 'Bad request' }, recovery: 'recover_knowledge_bad_response' })
    );
  });

  it('handles successful requests', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: 'success' }),
    });

    const res = await requestKnowledgeJson({
      path: '/test',
      ctx: mockCtx,
    });

    expect(res).toStrictEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:27125/test', expect.objectContaining({
      method: 'GET',
      headers: { 'X-Schema-Version': '0.1.0' }
    }));
  });
});
