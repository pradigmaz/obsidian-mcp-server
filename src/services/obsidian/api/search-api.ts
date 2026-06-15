import type { Context } from '@cyanheads/mcp-ts-core';
import { serviceUnavailable } from '@cyanheads/mcp-ts-core/errors';
import type { ObsidianHttpClient } from '../core/http-client.js';
import type { TextSearchHit, StructuredSearchHit, OmnisearchHit } from '../types.js';
import { JSONLOGIC_CT, normalizeOmnisearchHit, OMNISEARCH_PROBE_TIMEOUT_MS, deriveOmnisearchUrl, type RawOmnisearchHit } from '../obsidian-utils.js';
import type { ServerConfig } from '@/config/server-config.js';

interface RawSimpleSearchHit {
  filename: string;
  matches: Array<{ context: string; match: { start: number; end: number } }>;
  score?: number;
}

interface RawStructuredSearchHit {
  filename: string;
  result: unknown;
}

export class SearchApi {
  readonly #http: ObsidianHttpClient;
  readonly #omnisearchUrl: string;

  constructor(http: ObsidianHttpClient, config: ServerConfig) {
    this.#http = http;
    this.#omnisearchUrl = deriveOmnisearchUrl(config);
  }

  get omnisearchUrl(): string {
    return this.#omnisearchUrl;
  }

  async searchText(ctx: Context, query: string, contextLength = 100): Promise<TextSearchHit[]> {
    const params = new URLSearchParams({ query, contextLength: String(contextLength) });
    const res = await this.#http.request(ctx, `/search/simple/?${params}`, { method: 'POST' });
    const raw = (await res.json()) as RawSimpleSearchHit[];
    return raw.map((h) => ({ filename: h.filename, matches: h.matches }));
  }

  async searchJsonLogic(
    ctx: Context,
    logic: Record<string, unknown>,
  ): Promise<StructuredSearchHit[]> {
    const res = await this.#http.request(ctx, '/search/', {
      method: 'POST',
      headers: { 'Content-Type': JSONLOGIC_CT },
      body: JSON.stringify(logic),
    });
    return (await res.json()) as RawStructuredSearchHit[];
  }

  async probeOmnisearch(signal?: AbortSignal): Promise<boolean> {
    const probeSignal = signal ?? AbortSignal.timeout(OMNISEARCH_PROBE_TIMEOUT_MS);
    try {
      const res = await this.#http.fetch(`${this.#omnisearchUrl}/search?q=`, {
        method: 'GET',
        dispatcher: this.#http.dispatcher,
        signal: probeSignal,
      });
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) return false;
      const body = await res.json().catch(() => undefined);
      return Array.isArray(body);
    } catch (err) {
      return false;
    }
  }

  async searchOmnisearch(ctx: Context, query: string): Promise<OmnisearchHit[]> {
    const url = `${this.#omnisearchUrl}/search?q=${encodeURIComponent(query)}`;
    let res;
    try {
      res = await this.#http.fetch(url, {
        method: 'GET',
        dispatcher: this.#http.dispatcher,
        signal: ctx.signal,
      });
    } catch (err) {
      if (ctx.signal?.aborted) throw err;
      throw serviceUnavailable(
        `Omnisearch unreachable at ${this.#omnisearchUrl}. The plugin may have stopped (Obsidian quit, plugin disabled, or mobile session).`,
        {
          reason: 'omnisearch_unreachable',
          url: this.#omnisearchUrl,
          ...ctx.recoveryFor('omnisearch_unreachable'),
        },
        { cause: err },
      );
    }
    if (!res.ok) {
      throw serviceUnavailable(
        `Omnisearch returned HTTP ${res.status} at ${this.#omnisearchUrl}.`,
        {
          reason: 'omnisearch_unreachable',
          url: this.#omnisearchUrl,
          status: res.status,
          ...ctx.recoveryFor('omnisearch_unreachable'),
        },
      );
    }
    const body = (await res.json()) as RawOmnisearchHit[];
    return body.map(normalizeOmnisearchHit);
  }
}
