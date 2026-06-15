import { type Context } from '@cyanheads/mcp-ts-core';
import {
  forbidden,
  internalError,
  notFound,
  serviceUnavailable,
  timeout,
  unauthorized,
  validationError,
} from '@cyanheads/mcp-ts-core/errors';
import { httpErrorFromResponse, withRetry } from '@cyanheads/mcp-ts-core/utils';
import { Agent, type Dispatcher, type RequestInit, fetch as undiciFetch } from 'undici';
import type { ServerConfig } from '@/config/server-config.js';
import {
  JSONLOGIC_CT,
  RETRY_SAFE_METHODS,
  parseContentLength,
  parseJsonObject,
} from '../obsidian-utils.js';

type UndiciResponse = Awaited<ReturnType<typeof undiciFetch>>;

export type ObsidianFetch = (
  url: string,
  init: RequestInit & { dispatcher?: Dispatcher; signal?: AbortSignal | null },
) => Promise<UndiciResponse>;

export class ObsidianHttpClient {
  readonly #config: ServerConfig;
  readonly #dispatcher: Dispatcher;
  readonly #fetch: ObsidianFetch;

  constructor(config: ServerConfig, fetchImpl?: ObsidianFetch) {
    this.#config = config;
    if (!config.verifySsl && typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    this.#dispatcher = new Agent({
      connect: { rejectUnauthorized: config.verifySsl },
      headersTimeout: config.requestTimeoutMs,
      bodyTimeout: config.requestTimeoutMs,
    });
    this.#fetch = fetchImpl ?? (undiciFetch as ObsidianFetch);
  }

  get config(): ServerConfig {
    return this.#config;
  }

  get dispatcher(): Dispatcher {
    return this.#dispatcher;
  }

  get fetch(): ObsidianFetch {
    return this.#fetch;
  }

  async request(
    ctx: Context,
    urlPath: string,
    opts: {
      method: string;
      headers?: Record<string, string>;
      body?: string;
      skipAuth?: boolean;
    },
  ): Promise<UndiciResponse> {
    const isSafe = RETRY_SAFE_METHODS.has(opts.method.toUpperCase());
    const fetchWrapper = async (signal?: AbortSignal | null) => {
      const init: RequestInit = {
        method: opts.method,
        headers: {
          Accept: 'application/json',
          ...(opts.skipAuth ? {} : { Authorization: `Bearer ${this.#config.apiKey}` }),
          ...opts.headers,
        },
        dispatcher: this.#dispatcher,
        signal: signal ?? null,
      };

      if (opts.body !== undefined) {
        init.body = opts.body;
      }

      const fullUrl = urlPath.startsWith('http')
        ? urlPath
        : `${this.#config.baseUrl}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;

      const res = await this.#fetch(fullUrl, init);
      if (!res.ok) {
        await this.throwForStatus(res, opts.method, urlPath, opts.headers?.['Content-Type']);
      }
      return res;
    };

    return isSafe
      ? await withRetry(fetchWrapper, {
          operation: `obsidian.${opts.method} ${urlPath}`,
          context: {
            requestId: ctx.requestId,
            timestamp: ctx.timestamp,
            ...(ctx.tenantId !== undefined ? { tenantId: ctx.tenantId } : {}),
            ...(ctx.traceId !== undefined ? { traceId: ctx.traceId } : {}),
            ...(ctx.spanId !== undefined ? { spanId: ctx.spanId } : {}),
          },
          baseDelayMs: this.#config.retryDelayMs,
          maxRetries: this.#config.retryAttempts,
          signal: ctx.signal,
        })
      : await fetchWrapper(ctx.signal);
  }

  async throwForStatus(
    res: UndiciResponse,
    method: string,
    urlPath: string,
    contentType?: string,
  ): Promise<never> {
    const isJsonError = res.headers.get('content-type')?.includes('application/json');
    const isSearchLog = urlPath.endsWith('/search/') && contentType === JSONLOGIC_CT;
    const bodyStr = await this.readBodySafe(res);

    let message = bodyStr || res.statusText || 'Unknown Obsidian Local REST API error';

    if (isJsonError) {
      const errObj = parseJsonObject(bodyStr);
      if (typeof errObj?.message === 'string') message = errObj.message;
      else if (typeof errObj?.error === 'string') message = errObj.error;
    }

    if (res.status === 401) {
      throw unauthorized(`Obsidian plugin rejected OBSIDIAN_API_KEY: ${message}`);
    }

    if (res.status === 404) {
      const reason = urlPath.startsWith('/active/')
        ? 'no_active_file'
        : urlPath.startsWith('/periodic/')
          ? 'periodic_not_found'
          : urlPath.startsWith('/commands/')
            ? 'command_unknown'
            : 'note_missing';
      const label = reason === 'no_active_file'
        ? 'No file is currently active'
        : reason === 'command_unknown'
          ? 'Unknown Obsidian command'
          : 'Obsidian resource not found';
      throw notFound(`${label} at ${urlPath}: ${message}`, {
        reason,
        path: urlPath,
      });
    }

    if (res.status === 400) {
      if (/content-already-preexists-in-target/i.test(message)) {
        throw validationError(
          `The supplied content already appears at the target in ${urlPath}. Pass \`applyIfContentPreexists: true\` to force-apply, or change the content.`,
          { reason: 'content_preexists', path: urlPath, ...(message ? { upstream: { message } } : {}) }
        );
      }
      if (/could not be applied/i.test(message)) {
        throw validationError(
          `Section target not found in ${urlPath}. The target section might not exist, or the file changed between read and write.`,
          { reason: 'section_target_missing', path: urlPath, ...(message ? { upstream: { message } } : {}) }
        );
      }
      if (isSearchLog) {
        throw validationError(`Invalid JsonLogic query: ${message}`, {
          reason: 'invalid_query', path: urlPath, ...(message ? { upstream: { message } } : {})
        });
      }
      throw validationError(message || `Bad request to ${urlPath}`, {
        reason: 'validation_error', path: urlPath, ...(message ? { upstream: { message } } : {})
      });
    }

    if (res.status === 405) {
      if (method === 'PATCH') {
        throw forbidden(
          `PATCH is not supported for ${urlPath}. The note likely does not exist yet (PATCH cannot create files in the Local REST API).`,
        );
      }
      throw validationError(`Obsidian Local REST API rejected ${method} for ${urlPath}: ${message}`, {
        reason: 'path_is_directory',
        path: urlPath,
        ...(message ? { upstream: { message } } : {}),
      });
    }

    if (res.status === 503) {
      throw serviceUnavailable(`Obsidian plugin internal error (503): ${message}`, {
        path: urlPath,
        ...(message ? { upstream: { message } } : {}),
      });
    }

    if (res.status === 504) {
      throw timeout(`Obsidian Local REST API timed out: ${message}`, {
        path: urlPath,
        ...(message ? { upstream: { message } } : {}),
      });
    }

    if (res.status >= 500) {
      throw internalError(`Obsidian Local REST API internal error (${res.status}): ${message}`, {
        path: urlPath,
        ...(message ? { upstream: { message } } : {}),
      });
    }

    const truncated = bodyStr ? (bodyStr.length > 500 ? `${bodyStr.slice(0, 500)}…` : bodyStr) : undefined;
    throw await httpErrorFromResponse(res as unknown as Response, {
      service: 'Obsidian Local REST API',
      captureBody: false,
      data: truncated !== undefined ? { body: truncated } : {},
    });
  }

  async readBodySafe(res: UndiciResponse): Promise<string> {
    try {
      const length = parseContentLength(res, 'unknown');
      if (length > 5 * 1024 * 1024) {
        await res.body?.cancel().catch(() => {});
        return '[Response truncated: exceeds 5MB limit]';
      }
    } catch {
      // Missing or invalid content-length, we proceed and rely on text() handling
    }
    return res.text().catch(() => '');
  }
}
