import { computeFenceMask } from '@/services/obsidian/section-extractor.js';
import { type Context } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode, McpError, notFound } from '@cyanheads/mcp-ts-core/errors';
import type { NoteJson, SectionTarget } from '@/services/obsidian/types.js';

export function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return '(empty)';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

export function parseOutgoingLinks(
  content: string,
): Array<{ target: string; type: 'wikilink' | 'markdown' }> {
  const cleaned = stripMarkdownCode(content);
  const links: Array<{ target: string; type: 'wikilink' | 'markdown' }> = [];

  for (const m of cleaned.matchAll(/!?\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
    const target = m[1]?.trim();
    if (target) links.push({ target, type: 'wikilink' });
  }

  for (const m of cleaned.matchAll(/\[[^\]]*\]\((<[^<>\n]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    let target = m[1]?.trim();
    if (!target) continue;
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1).trim();
    }
    if (target && !/^[a-z][a-z0-9+\-.]*:/i.test(target)) {
      links.push({ target, type: 'markdown' });
    }
  }

  return links;
}

export function stripMarkdownCode(content: string): string {
  const lines = content.split('\n');
  const inFence = computeFenceMask(lines);
  return lines
    .map((line, i) =>
      inFence[i]
        ? ' '.repeat(line.length)
        : line.replace(/`[^`\n]+`/g, (s) => ' '.repeat(s.length)),
    )
    .join('\n');
}

export function reclassifyAsSectionMiss(
  ctx: Context,
  note: NoteJson,
  section: SectionTarget,
  err: unknown,
): never {
  if (err instanceof McpError && err.code === JsonRpcErrorCode.NotFound) {
    throw notFound(
      err.message,
      {
        path: note.path,
        section,
        reason: 'section_missing',
        ...ctx.recoveryFor('section_missing'),
      },
      { cause: err },
    );
  }
  throw err;
}
