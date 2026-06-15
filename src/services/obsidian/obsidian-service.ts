import type { Context } from '@cyanheads/mcp-ts-core';
import { type ServerConfig, getServerConfig } from '@/config/server-config.js';
import { PathPolicy } from './path-policy.js';
import { ObsidianHttpClient, type ObsidianFetch } from './core/http-client.js';
import { BackupManager } from './gatekeeper/backup-manager.js';
import { LintClient } from './gatekeeper/lint-client.js';
import { NoteApi } from './api/note-api.js';
import { SearchApi } from './api/search-api.js';
import { VaultApi } from './api/vault-api.js';
import type {
  DocumentMap,
  FileListing,
  NoteJson,
  NoteTarget,
  ObsidianCommand,
  ObsidianTag,
  OmnisearchHit,
  PatchHeaders,
  StructuredSearchHit,
  TextSearchHit,
  VaultStatus,
} from './types.js';

export { encodeVaultPath } from './obsidian-utils.js';

/**
 * ObsidianService Facade
 * 
 * This class serves as the single entry point for all Obsidian operations,
 * preserving backward compatibility with all existing MCP tools. It delegates
 * actual work to domain-specific APIs and infrastructure classes.
 */
export class ObsidianService {
  readonly #http: ObsidianHttpClient;
  readonly #policy: PathPolicy;
  readonly #backup: BackupManager;
  readonly #lint: LintClient;
  
  readonly #noteApi: NoteApi;
  readonly #searchApi: SearchApi;
  readonly #vaultApi: VaultApi;

  constructor(config: ServerConfig, fetchImpl?: ObsidianFetch) {
    this.#http = new ObsidianHttpClient(config, fetchImpl);
    this.#policy = new PathPolicy(config);
    this.#backup = new BackupManager(config);
    this.#lint = new LintClient(this.#http);
    
    this.#noteApi = new NoteApi(this.#http, this.#policy, this.#backup, this.#lint);
    this.#searchApi = new SearchApi(this.#http, config);
    this.#vaultApi = new VaultApi(this.#http, this.#policy);
  }

  get policy(): PathPolicy {
    return this.#policy;
  }

  get omnisearchUrl(): string {
    return this.#searchApi.omnisearchUrl;
  }

  // ── Status ───────────────────────────────────────────────────────────────

  async getStatus(ctx: Context): Promise<VaultStatus> {
    return this.#vaultApi.getStatus(ctx);
  }

  async probeAuthenticated(ctx: Context): Promise<boolean> {
    return this.#vaultApi.probeAuthenticated(ctx);
  }

  // ── Notes ────────────────────────────────────────────────────────────────

  async getNoteContent(ctx: Context, target: NoteTarget): Promise<string> {
    return this.#noteApi.getNoteContent(ctx, target);
  }

  async getNoteJson(ctx: Context, target: NoteTarget): Promise<NoteJson> {
    return this.#noteApi.getNoteJson(ctx, target);
  }

  async resolvePath(ctx: Context, target: NoteTarget): Promise<string> {
    return this.#noteApi.resolvePath(ctx, target);
  }

  async getDocumentMap(ctx: Context, target: NoteTarget): Promise<DocumentMap> {
    return this.#noteApi.getDocumentMap(ctx, target);
  }

  async writeNote(
    ctx: Context,
    target: NoteTarget,
    content: string,
    contentType: 'markdown' | 'json' = 'markdown',
  ): Promise<void> {
    return this.#noteApi.writeNote(ctx, target, content, contentType);
  }

  async appendToNote(
    ctx: Context,
    target: NoteTarget,
    content: string,
    contentType: 'markdown' | 'json' = 'markdown',
  ): Promise<void> {
    return this.#noteApi.appendToNote(ctx, target, content, contentType);
  }

  async patchNote(
    ctx: Context,
    target: NoteTarget,
    content: string,
    headers: PatchHeaders,
  ): Promise<void> {
    return this.#noteApi.patchNote(ctx, target, content, headers);
  }

  async deleteNote(ctx: Context, target: NoteTarget): Promise<void> {
    return this.#noteApi.deleteNote(ctx, target);
  }

  async tryGetSize(ctx: Context, target: NoteTarget): Promise<number | null> {
    return this.#noteApi.tryGetSize(ctx, target);
  }

  async getSize(ctx: Context, target: NoteTarget): Promise<number> {
    return this.#noteApi.getSize(ctx, target);
  }

  // ── Listings ─────────────────────────────────────────────────────────────

  async listFiles(ctx: Context, dirPath?: string): Promise<FileListing> {
    return this.#vaultApi.listFiles(ctx, dirPath);
  }

  async listTags(ctx: Context): Promise<ObsidianTag[]> {
    return this.#vaultApi.listTags(ctx);
  }

  async listCommands(ctx: Context): Promise<ObsidianCommand[]> {
    return this.#vaultApi.listCommands(ctx);
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async searchText(ctx: Context, query: string, contextLength = 100): Promise<TextSearchHit[]> {
    return this.#searchApi.searchText(ctx, query, contextLength);
  }

  async searchJsonLogic(
    ctx: Context,
    logic: Record<string, unknown>,
  ): Promise<StructuredSearchHit[]> {
    return this.#searchApi.searchJsonLogic(ctx, logic);
  }

  async probeOmnisearch(signal?: AbortSignal): Promise<boolean> {
    return this.#searchApi.probeOmnisearch(signal);
  }

  async searchOmnisearch(ctx: Context, query: string): Promise<OmnisearchHit[]> {
    return this.#searchApi.searchOmnisearch(ctx, query);
  }

  // ── UI / commands ────────────────────────────────────────────────────────

  async executeCommand(ctx: Context, commandId: string): Promise<void> {
    return this.#vaultApi.executeCommand(ctx, commandId);
  }

  async openInUi(ctx: Context, path: string, opts?: { newLeaf?: boolean }): Promise<void> {
    return this.#vaultApi.openInUi(ctx, path, opts);
  }
}

// Global instance cache
let instance: ObsidianService | undefined;

export function getObsidianService(): ObsidianService {
  if (!instance) {
    throw new Error('ObsidianService not initialized. Call initObsidianService() first.');
  }
  return instance;
}

export function initObsidianService(
  config: ServerConfig = getServerConfig(),
  fetchImpl?: ObsidianFetch
): void {
  instance = new ObsidianService(config, fetchImpl);
}

/** Test-only: directly install an instance (e.g., one backed by a stub fetch). */
export function setObsidianService(service: ObsidianService | undefined): void {
  instance = service;
}
