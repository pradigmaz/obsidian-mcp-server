import { validationError } from '@cyanheads/mcp-ts-core/errors';
import type { OmnisearchHit } from './types.js';
import type { ServerConfig } from '@/config/server-config.js';

export interface UpstreamErrorBody {
  errorCode?: number;
  message?: string;
  [k: string]: unknown;
}

export interface RawOmnisearchHit {
  basename: string;
  excerpt: string;
  foundWords: string[];
  matches: Array<{ match: string; offset: number }>;
  path: string;
  score: number;
  vault?: string;
}

/** Per-call timeout for the startup probe — covers the 4-tuple TCP handshake + a tiny GET. */
export const OMNISEARCH_PROBE_TIMEOUT_MS = 500;

export const OMNISEARCH_DEFAULT_PORT = '51361';

export const NOTE_JSON_ACCEPT = 'application/vnd.olrapi.note+json';
export const DOCUMENT_MAP_ACCEPT = 'application/vnd.olrapi.document-map+json';
export const JSONLOGIC_CT = 'application/vnd.olrapi.jsonlogic+json';

export const RETRY_SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'PUT', 'DELETE']);

/**
 * Encode a vault-relative path for the URL. Splits on `/` and `\` (so
 * Windows-style separators are honored), URL-encodes each segment, and
 * rejoins with `/` since the Local REST API plugin expects forward slashes.
 *
 * Rejects `.` and `..` segments here rather than relying on the upstream Local
 * REST API plugin to normalize them — `PathPolicy` short-circuits to "allow"
 * when `OBSIDIAN_READ_PATHS` is unset, and `..` is unreserved per RFC 3986 so
 * `encodeURIComponent` leaves it intact. This is the single chokepoint before
 * URL construction, so guard vault escape here. Backslash is treated as a
 * separator so `..\..\etc` traverses identically to `../../etc` and can't
 * sneak past as a single opaque segment.
 */
export function encodeVaultPath(path: string): string {
  const segments = path.split(/[/\\]/).filter((seg) => seg.length > 0);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      throw validationError(`Path traversal not allowed: '${path}'`, {
        path,
        reason: 'path_traversal',
      });
    }
  }
  return segments.map((seg) => encodeURIComponent(seg)).join('/');
}

/**
 * Convert an internal URL path (e.g. `/vault/Projects/My%20Note.md`) to the
 * vault-relative form a caller would recognize. Used in error messages so the
 * user sees the same path they sent in.
 */
export function displayPath(urlPath: string): string {
  if (urlPath.startsWith('/active/')) return '(active file)';
  const noQuery = urlPath.split('?')[0] ?? urlPath;
  let decoded: string;
  try {
    decoded = decodeURIComponent(noQuery);
  } catch (err) {
    // Fall back to un-decoded if URI string is malformed
    decoded = noQuery;
  }
  const periodic =
    /^\/periodic\/(daily|weekly|monthly|quarterly|yearly)\/(?:(\d{4})\/(\d{2})\/(\d{2})\/?)?$/.exec(
      decoded,
    );
  if (periodic) {
    const [, period, y, mo, d] = periodic;
    return y && mo && d
      ? `${period} note for ${y}-${mo}-${d}`
      : `${period} note for the current period`;
  }
  for (const prefix of ['/vault/', '/open/', '/commands/']) {
    if (decoded.startsWith(prefix)) {
      return decoded.slice(prefix.length).replace(/\/+$/, '') || decoded;
    }
  }
  return decoded;
}

/**
 * Trim the upstream error body down to a safe, user-presentable shape — drops
 * `errorCode` and any other plugin-internal fields that would otherwise leak
 * into JSON-RPC `error.data`.
 */
export function safeUpstream(
  body: UpstreamErrorBody | undefined,
  text: string,
): { message: string } | undefined {
  if (body?.message) return { message: body.message };
  const trimmed = text.trim();
  if (trimmed) return { message: trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed };
  return;
}

/**
 * Read the `Content-Length` header from a HEAD response and parse it as a
 * non-negative integer byte count. Throws when the upstream omits the header
 * or returns a non-numeric value — the size helpers don't fall back to GET.
 */
export function parseContentLength(res: any, url: string): number {
  const raw = res.headers.get('content-length');
  if (raw === null) {
    throw new Error(
      `Obsidian Local REST API HEAD response missing Content-Length header for ${url}.`,
    );
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Obsidian Local REST API returned invalid Content-Length '${raw}' for ${url}.`);
  }
  return n;
}

/**
 * Resolve the Omnisearch URL. Override wins. Otherwise: take the host from
 * `OBSIDIAN_BASE_URL`, force `http:` (Omnisearch is HTTP-only), swap port
 * `27123/27124` → `51361`. `127.0.0.1` is mapped to `localhost` since
 * Omnisearch's current Node listener binds IPv4 only but the platform's
 * loopback resolver is flexible — `localhost` insulates us if a future
 * build switches binding. Falls back to `http://localhost:51361` on any
 * URL parse failure (config validation catches malformed `baseUrl`, so this
 * is belt-and-suspenders).
 */
export function deriveOmnisearchUrl(config: ServerConfig): string {
  if (config.omnisearchUrl) return config.omnisearchUrl.replace(/\/+$/, '');
  try {
    const u = new URL(config.baseUrl);
    const host = u.hostname === '127.0.0.1' ? 'localhost' : u.hostname;
    return `http://${host}:${OMNISEARCH_DEFAULT_PORT}`;
  } catch (err) {
    // Fall back if config.baseUrl is malformed
    return `http://localhost:${OMNISEARCH_DEFAULT_PORT}`;
  }
}

export function normalizeOmnisearchHit(raw: any): OmnisearchHit {
  return {
    basename: raw.basename,
    excerpt: cleanExcerpt(raw.excerpt),
    filename: raw.path,
    foundWords: raw.foundWords,
    matches: raw.matches,
    score: raw.score,
  };
}

/**
 * Normalize Omnisearch's excerpt HTML: `<br>` → `\n`, decode the entities
 * the upstream actually emits (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#039;`,
 * `&apos;`, plus numeric `&#NNN;` / `&#xNN;`). `<mark>` tags are preserved —
 * they highlight the match span and are interpretable as emphasis.
 */
export function cleanExcerpt(excerpt: string): string {
  return excerpt
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => safeCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function safeCodePoint(cp: number): string {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return '';
  return String.fromCodePoint(cp);
}

export function parseJsonObject(text: string): UpstreamErrorBody | undefined {
  if (!text) return;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? (v as UpstreamErrorBody) : undefined;
  } catch (err) {
    // Expected if body is not valid JSON
    return;
  }
}
