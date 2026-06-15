import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { requestKnowledgeJson } from '../../src/mcp-server/tools/definitions/obsidian-knowledge-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
const knowledgeHeaders = {
  get: (key: string) => key === 'x-knowledge-plugin' ? '1' : '0.1.0',
};

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
      headers: knowledgeHeaders,
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

  it('reports a non-Knowledge port owner before generic HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      headers: { get: () => null },
      json: () => Promise.resolve({ error: 'not found' }),
    });

    await expect(requestKnowledgeJson({
      path: '/api/status',
      ctx: mockCtx,
    })).rejects.toThrow('Stale or incorrect server detected');

    expect(mockCtx.fail).toHaveBeenCalledWith(
      'knowledge_bad_response',
      expect.stringContaining('non-Knowledge process'),
      expect.objectContaining({ status: 404, path: '/api/status', recovery: 'recover_knowledge_bad_response' })
    );
  });

  it('reports schema header mismatch', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: { get: (key: string) => key === 'x-knowledge-plugin' ? '1' : '0.0.0' },
      json: () => Promise.resolve({ status: 'ready' }),
    });

    await expect(requestKnowledgeJson({
      path: '/api/status',
      ctx: mockCtx,
    })).rejects.toThrow('Knowledge Analytics schema mismatch');

    expect(mockCtx.fail).toHaveBeenCalledWith(
      'knowledge_bad_response',
      expect.any(String),
      expect.objectContaining({ expectedSchemaVersion: '0.1.0', schemaVersion: '0.0.0' })
    );
  });

  it('uses gatekeeper recovery metadata for HTTP 428', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 428,
      ok: false,
      headers: knowledgeHeaders,
      json: () => Promise.resolve({ error: 'Health gate failed' }),
    });

    await expect(requestKnowledgeJson({
      path: '/test',
      ctx: mockCtx,
    })).rejects.toThrow('Vault fails OKF standards.');

    expect(mockCtx.fail).toHaveBeenCalledWith(
      'knowledge_gatekeeper_blocked',
      expect.any(String),
      expect.objectContaining({
        status: 428,
        path: '/test',
        payload: { error: 'Health gate failed' },
        recovery: 'recover_knowledge_gatekeeper_blocked',
      })
    );
  });

  it('handles successful requests', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: knowledgeHeaders,
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
