/** Vault path case fallback and non-mutating "did you mean" suggestions. */

import type { Context } from '@cyanheads/mcp-ts-core';
import { conflict, JsonRpcErrorCode, McpError, notFound } from '@cyanheads/mcp-ts-core/errors';
import type { ObsidianService } from '@/services/obsidian/obsidian-service.js';
import type { NoteTarget } from '@/services/obsidian/types.js';

const MAX_SUGGESTIONS = 5;

interface ProbeResult {
  caseMatches: string[];
  extInsensitive: string[];
  stemPrefixes: string[];
}

export async function withCaseFallback<T>(
  ctx: Context,
  svc: ObsidianService,
  target: NoteTarget,
  fn: (target: NoteTarget) => Promise<T>,
): Promise<{ result: T; resolvedPath: string | undefined }> {
  if (target.type !== 'path') {
    return { result: await fn(target), resolvedPath: undefined };
  }
  try {
    return { result: await fn(target), resolvedPath: target.path };
  } catch (err) {
    if (!(err instanceof McpError) || err.code !== JsonRpcErrorCode.NotFound) {
      throw err;
    }
    const probe = await probeParentDir(ctx, svc, target.path);
    const sole = probe.caseMatches.length === 1 ? probe.caseMatches[0] : undefined;
    if (sole !== undefined) {
      const result = await fn({ type: 'path', path: sole });
      return { result, resolvedPath: sole };
    }
    if (probe.caseMatches.length > 1) {
      const list = probe.caseMatches.map((m) => `"${m}"`).join(', ');
      throw conflict(
        `Ambiguous case-insensitive matches for '${target.path}': ${list}.`,
        {
          path: target.path,
          reason: 'ambiguous_path',
          matches: probe.caseMatches,
          ...ctx.recoveryFor('ambiguous_path'),
        },
        { cause: err },
      );
    }
    const suggestions = [...probe.extInsensitive, ...probe.stemPrefixes].slice(0, MAX_SUGGESTIONS);
    if (suggestions.length === 0) throw err;
    const list = suggestions.map((s) => `"${s}"`).join(', ');
    const prefix = err.message.replace(/[.!?]?\s*$/, '');
    throw notFound(
      `${prefix}. Did you mean: ${list}?`,
      { ...(err.data ?? {}), suggestions },
      { cause: err },
    );
  }
}

export async function findSimilarPaths(
  ctx: Context,
  svc: ObsidianService,
  path: string,
): Promise<string[]> {
  const probe = await probeParentDir(ctx, svc, path);
  return [...probe.caseMatches, ...probe.extInsensitive, ...probe.stemPrefixes].slice(
    0,
    MAX_SUGGESTIONS,
  );
}

async function probeParentDir(
  ctx: Context,
  svc: ObsidianService,
  path: string,
): Promise<ProbeResult> {
  const empty: ProbeResult = { caseMatches: [], extInsensitive: [], stemPrefixes: [] };
  const normalized = path.replace(/^\/+|\/+$/g, '');
  if (!normalized) return empty;

  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash) : '';
  const base = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  if (!base) return empty;

  let entries: string[];
  try {
    const listing = await svc.listFiles(ctx, dir);
    entries = listing.files;
  } catch {
    // Expected on 404 or permission denied; fail silently to continue fallback
    return empty;
  }

  const baseLower = base.toLowerCase();
  const baseNoExt = stripExtension(baseLower);
  const caseMatches: string[] = [];
  const extInsensitive: string[] = [];
  const stemPrefixes: string[] = [];

  for (const entry of entries) {
    if (entry.endsWith('/')) continue;
    const entryLower = entry.toLowerCase();
    if (entryLower === baseLower) {
      caseMatches.push(qualify(dir, entry));
    } else if (stripExtension(entryLower) === baseNoExt) {
      extInsensitive.push(qualify(dir, entry));
    } else if (isDescriptiveStemVariant(baseNoExt, stripExtension(entryLower))) {
      stemPrefixes.push(qualify(dir, entry));
    }
  }
  return { caseMatches, extInsensitive, stemPrefixes };
}

function isDescriptiveStemVariant(left: string, right: string): boolean {
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  if (shorter.length < 8 || shorter.length === longer.length || !longer.startsWith(shorter)) {
    return false;
  }
  return /[\s—–_-]/u.test(longer.charAt(shorter.length));
}

function stripExtension(s: string): string {
  const dot = s.lastIndexOf('.');
  return dot > 0 ? s.slice(0, dot) : s;
}

function qualify(dir: string, base: string): string {
  return dir ? `${dir}/${base}` : base;
}
