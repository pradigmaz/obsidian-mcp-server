import { type Context } from '@cyanheads/mcp-ts-core';
import type { RequestContext } from '@cyanheads/mcp-ts-core/utils';
import { paginateArray } from '@cyanheads/mcp-ts-core/utils';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function paginate<T>(
  items: T[],
  cursor: string | undefined,
  ctx: Context,
): { hits: T[]; totalCount: number; nextCursor?: string } {
  const page = paginateArray(
    items,
    cursor,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    ctx as unknown as RequestContext,
  );
  return {
    hits: page.items,
    totalCount: page.totalCount ?? items.length,
    ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
  };
}

export function clipMatches<T extends { matches: unknown[] }>(
  hit: T,
  cap: number,
): T & { truncated?: boolean; totalMatches?: number } {
  if (hit.matches.length <= cap) return hit;
  return {
    ...hit,
    matches: hit.matches.slice(0, cap),
    truncated: true,
    totalMatches: hit.matches.length,
  };
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

export function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
