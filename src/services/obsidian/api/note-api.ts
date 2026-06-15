import type { Context } from '@cyanheads/mcp-ts-core';
import { notFound, validationError } from '@cyanheads/mcp-ts-core/errors';
import type { ObsidianHttpClient } from '../core/http-client.js';
import type { PathPolicy } from '../path-policy.js';
import type { BackupManager } from '../gatekeeper/backup-manager.js';
import type { LintClient } from '../gatekeeper/lint-client.js';
import type {
  DocumentMap,
  NoteJson,
  NoteTarget,
  PatchHeaders,
} from '../types.js';
import { NOTE_JSON_ACCEPT, DOCUMENT_MAP_ACCEPT, encodeVaultPath, parseContentLength } from '../obsidian-utils.js';
import * as fs from 'fs/promises';

export class NoteApi {
  readonly #http: ObsidianHttpClient;
  readonly #policy: PathPolicy;
  readonly #backup: BackupManager;
  readonly #lint: LintClient;

  constructor(
    http: ObsidianHttpClient,
    policy: PathPolicy,
    backup: BackupManager,
    lint: LintClient
  ) {
    this.#http = http;
    this.#policy = policy;
    this.#backup = backup;
    this.#lint = lint;
  }

  async getNoteContent(ctx: Context, target: NoteTarget): Promise<string> {
    if (target.type === 'path') {
      this.#policy.assertReadable(target.path);
      const url = this.#targetToPath(target);
      const res = await this.#http.request(ctx, url, {
        method: 'GET',
        headers: { Accept: 'text/markdown' },
      });
      return await res.text();
    }
    if (!this.#policy.isUnrestricted) {
      const note = await this.getNoteJson(ctx, target);
      return note.content;
    }
    const url = this.#targetToPath(target);
    const res = await this.#http.request(ctx, url, {
      method: 'GET',
      headers: { Accept: 'text/markdown' },
    });
    return await res.text();
  }

  async getNoteJson(ctx: Context, target: NoteTarget): Promise<NoteJson> {
    if (target.type === 'path') {
      this.#policy.assertReadable(target.path);
    }
    const note = await this.#rawGetNoteJson(ctx, target);
    if (target.type !== 'path') {
      this.#policy.assertReadable(note.path);
    }
    return note;
  }

  async resolvePath(ctx: Context, target: NoteTarget): Promise<string> {
    if (target.type === 'path') return target.path;
    return (await this.getNoteJson(ctx, target)).path;
  }

  async getDocumentMap(ctx: Context, target: NoteTarget): Promise<DocumentMap> {
    if (target.type === 'path') {
      this.#policy.assertReadable(target.path);
      return this.#rawGetDocumentMap(ctx, target);
    }
    if (this.#policy.isUnrestricted) {
      return this.#rawGetDocumentMap(ctx, target);
    }
    const [path, map] = await Promise.all([
      this.resolvePath(ctx, target),
      this.#rawGetDocumentMap(ctx, target),
    ]);
    this.#policy.assertReadable(path);
    return map;
  }

  async writeNote(
    ctx: Context,
    target: NoteTarget,
    content: string,
    contentType: 'markdown' | 'json' = 'markdown',
  ): Promise<void> {
    const safe = await this.#gateAsWrite(ctx, target);
    const url = this.#targetToPath(safe);
    
    await this.#lint.lintWrite(ctx, url, content);
    await this.#backupExisting(ctx, url);

    await this.#http.request(ctx, url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType === 'json' ? 'application/json' : 'text/markdown' },
      body: content,
    });
  }

  async appendToNote(
    ctx: Context,
    target: NoteTarget,
    content: string,
    contentType: 'markdown' | 'json' = 'markdown',
  ): Promise<void> {
    const safe = await this.#gateAsWrite(ctx, target);
    const url = this.#targetToPath(safe);
    
    const backupPath = await this.#backupExisting(ctx, url);

    await this.#http.request(ctx, url, {
      method: 'POST',
      headers: { 'Content-Type': contentType === 'json' ? 'application/json' : 'text/markdown' },
      body: content,
    });
    
    try {
      await this.#lint.lintWrite(ctx, url);
    } catch (e) {
      if (backupPath) {
        const originalContent = await fs.readFile(backupPath, 'utf8');
        await this.#http.request(ctx, url, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/markdown' },
          body: originalContent,
        }).catch(() => {});
      }
      throw e;
    }
  }

  async patchNote(
    ctx: Context,
    target: NoteTarget,
    content: string,
    headers: PatchHeaders,
  ): Promise<void> {
    const safe = await this.#gateAsWrite(ctx, target);
    const url = this.#targetToPath(safe);
    
    const backupPath = await this.#backupExisting(ctx, url);

    await this.#http.request(ctx, url, {
      method: 'PATCH',
      headers: this.#buildPatchHeaders(headers),
      body: content,
    });
    
    try {
      await this.#lint.lintWrite(ctx, url);
    } catch (e) {
      if (backupPath) {
        const originalContent = await fs.readFile(backupPath, 'utf8');
        await this.#http.request(ctx, url, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/markdown' },
          body: originalContent,
        }).catch(() => {});
      }
      throw e;
    }
  }

  async deleteNote(ctx: Context, target: NoteTarget): Promise<void> {
    const safe = await this.#gateAsWrite(ctx, target);
    const url = this.#targetToPath(safe);
    await this.#http.request(ctx, url, { method: 'DELETE' });
  }

  async tryGetSize(ctx: Context, target: NoteTarget): Promise<number | null> {
    if (target.type === 'path') {
      this.#policy.assertReadable(target.path);
    }
    const url = this.#targetToPath(target);
    const res = await this.#http.fetch(`${this.#http.config.baseUrl}${url}`, {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${this.#http.config.apiKey}` },
      dispatcher: this.#http.dispatcher,
      signal: ctx.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) await this.#http.throwForStatus(res, 'HEAD', url);
    
    return parseContentLength(res, url);
  }

  async getSize(ctx: Context, target: NoteTarget): Promise<number> {
    const size = await this.tryGetSize(ctx, target);
    if (size === null) {
      const display = target.type === 'path' ? target.path : '(target)';
      throw notFound(`Note not found: ${display}`, {
        path: display,
        reason: 'note_missing',
        ...ctx.recoveryFor('note_missing'),
      });
    }
    return size;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  async #rawGetNoteJson(ctx: Context, target: NoteTarget): Promise<NoteJson> {
    const url = this.#targetToPath(target);
    const res = await this.#http.request(ctx, url, {
      method: 'GET',
      headers: { Accept: NOTE_JSON_ACCEPT },
    });
    return (await res.json()) as NoteJson;
  }

  async #rawGetDocumentMap(ctx: Context, target: NoteTarget): Promise<DocumentMap> {
    const url = this.#targetToPath(target);
    const res = await this.#http.request(ctx, url, {
      method: 'GET',
      headers: { Accept: DOCUMENT_MAP_ACCEPT },
    });
    return (await res.json()) as DocumentMap;
  }

  async #gateAsWrite(ctx: Context, target: NoteTarget): Promise<NoteTarget> {
    if (target.type === 'path') {
      this.#policy.assertWritable(target.path);
      return target;
    }
    const path = await this.resolvePath(ctx, target);
    this.#policy.assertWritable(path);
    return { type: 'path', path };
  }

  #targetToPath(target: NoteTarget): string {
    switch (target.type) {
      case 'path':
        return `/vault/${encodeVaultPath(target.path)}`;
      case 'active':
        return '/active/';
      case 'periodic':
        if (target.date === undefined) return `/periodic/${target.period}/`;
        return `/periodic/${target.period}/${this.#formatPeriodicDate(target.date)}/`;
    }
  }

  #formatPeriodicDate(date: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (match === null) {
      throw validationError(`Invalid periodic note date '${date}'. Expected YYYY-MM-DD.`, {
        reason: 'invalid_periodic_date',
      });
    }
    return `${match[1]}/${match[2]}/${match[3]}`;
  }

  #buildPatchHeaders(headers: PatchHeaders): Record<string, string> {
    const out: Record<string, string> = {
      'Content-Type': headers.contentType === 'json' ? 'application/json' : 'text/markdown',
      'Operation': headers.operation,
      'Target': encodeURIComponent(headers.target),
      'Target-Type': headers.targetType,
    };
    if (headers.targetDelimiter) out['Target-Delimiter'] = headers.targetDelimiter;
    if (headers.createTargetIfMissing !== undefined) {
      out['Create-Target-If-Missing'] = String(headers.createTargetIfMissing);
    }
    if (!headers.applyIfContentPreexists) {
      out['Reject-If-Content-Preexists'] = 'true';
    }
    if (headers.trimTargetWhitespace !== undefined) {
      out['Trim-Target-Whitespace'] = String(headers.trimTargetWhitespace);
    }
    return out;
  }

  async #backupExisting(ctx: Context, vaultPath: string): Promise<string> {
    if (this.#http.config.maxBackupsPerNote <= 0) return '';
    const res = await this.#http.fetch(`${this.#http.config.baseUrl}${vaultPath}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.#http.config.apiKey}`,
        Accept: 'text/markdown'
      },
      dispatcher: this.#http.dispatcher,
      signal: ctx.signal,
    });
    if (res.status === 404) return '';
    if (!res.ok) await this.#http.throwForStatus(res, 'GET', vaultPath);
    const originalContent = await res.text();
    return await this.#backup.createTempBackup(vaultPath, originalContent);
  }
}
