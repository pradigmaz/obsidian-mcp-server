import type { Context } from '@cyanheads/mcp-ts-core';
import type { ObsidianHttpClient } from '../core/http-client.js';
import type { PathPolicy } from '../path-policy.js';
import type { FileListing, ObsidianCommand, ObsidianTag, VaultStatus } from '../types.js';
import { encodeVaultPath } from '../obsidian-utils.js';

interface RawFileListing {
  files: string[];
}

interface RawTagsListing {
  tags: ObsidianTag[];
  totalDirectTags?: number;
  totalFileTags?: number;
}

export class VaultApi {
  readonly #http: ObsidianHttpClient;
  readonly #policy: PathPolicy;

  constructor(http: ObsidianHttpClient, policy: PathPolicy) {
    this.#http = http;
    this.#policy = policy;
  }

  async getStatus(ctx: Context): Promise<VaultStatus> {
    const res = await this.#http.request(ctx, '/', { method: 'GET', skipAuth: true });
    return (await res.json()) as VaultStatus;
  }

  async probeAuthenticated(ctx: Context): Promise<boolean> {
    try {
      const res = await this.#http.fetch(`${this.#http.config.baseUrl}/vault/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.#http.config.apiKey}` },
        dispatcher: this.#http.dispatcher,
        signal: ctx.signal,
      });
      return res.ok;
    } catch (err) {
      if (ctx.signal?.aborted) throw err;
      return false;
    }
  }

  async listFiles(ctx: Context, dirPath?: string): Promise<FileListing> {
    let url = '/vault/';
    let normalized = '';
    if (dirPath) {
      normalized = dirPath.replace(/^\/+|\/+$/g, '');
      if (normalized) url = `/vault/${encodeVaultPath(normalized)}/`;
    }
    if (normalized) {
      this.#policy.assertReadable(normalized);
    }
    const res = await this.#http.request(ctx, url, { method: 'GET' });
    return (await res.json()) as RawFileListing;
  }

  async listTags(ctx: Context): Promise<ObsidianTag[]> {
    const res = await this.#http.request(ctx, '/tags/', { method: 'GET' });
    const body = (await res.json()) as RawTagsListing;
    return body.tags ?? [];
  }

  async listCommands(ctx: Context): Promise<ObsidianCommand[]> {
    const res = await this.#http.request(ctx, '/commands/', { method: 'GET' });
    const body = (await res.json()) as { commands: ObsidianCommand[] };
    return body.commands ?? [];
  }

  async executeCommand(ctx: Context, commandId: string): Promise<void> {
    await this.#http.request(ctx, `/commands/${encodeURIComponent(commandId)}/`, { method: 'POST' });
  }

  async openInUi(ctx: Context, path: string, opts?: { newLeaf?: boolean }): Promise<void> {
    this.#policy.assertReadable(path);
    const params = new URLSearchParams();
    if (opts?.newLeaf) params.set('newLeaf', 'true');
    const qs = params.toString();
    await this.#http.request(ctx, `/open/${encodeVaultPath(path)}${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }
}
