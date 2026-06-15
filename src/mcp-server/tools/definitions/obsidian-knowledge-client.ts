import type { Context } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getServerConfig } from '@/config/server-config.js';

type KnowledgeErrorReason = 'knowledge_unreachable' | 'knowledge_bad_response' | 'knowledge_gatekeeper_blocked';
type KnowledgeToolContext = Context & {
  fail: (
    reason: KnowledgeErrorReason,
    message: string,
    data?: Record<string, unknown>,
    options?: { cause?: unknown },
  ) => Error;
  recoveryFor: (reason: KnowledgeErrorReason) => Record<string, unknown>;
};

interface KnowledgeRequest {
  body?: unknown;
  ctx: KnowledgeToolContext;
  method?: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
}

const KNOWLEDGE_ERRORS = [
  {
    reason: 'knowledge_unreachable',
    code: JsonRpcErrorCode.ServiceUnavailable,
    when: 'The Knowledge Analytics Obsidian plugin endpoint did not respond.',
    retryable: true,
    recovery:
      'Enable the Knowledge Analytics Obsidian plugin, verify its local HTTP endpoint, or set OBSIDIAN_KNOWLEDGE_URL.',
  },
  {
    reason: 'knowledge_bad_response',
    code: JsonRpcErrorCode.ServiceUnavailable,
    when: 'The Knowledge Analytics Obsidian plugin returned a non-JSON response or an error status.',
    retryable: true,
    recovery: 'Check the Knowledge Analytics plugin log and retry after the endpoint returns JSON.',
  },
  {
    reason: 'knowledge_gatekeeper_blocked',
    code: JsonRpcErrorCode.InvalidParams,
    when: 'The Knowledge Analytics Gatekeeper blocked the request due to failing OKF health checks.',
    retryable: true,
    recovery: 'Run obsidian_knowledge_health_report and fix the reported issues manually before proceeding.',
  },
] as const;

export const knowledgeToolErrors = KNOWLEDGE_ERRORS;
const CLIENT_SCHEMA_VERSION = '0.1.0';

export async function requestKnowledgeJson<T>({
  body,
  ctx,
  method = 'GET',
  path,
  headers = {},
}: KnowledgeRequest): Promise<T> {
  const baseUrl = getServerConfig().knowledgeUrl.replace(/\/+$/, '');
  let res: Response;

  try {
    const init: RequestInit = { 
      method,
      headers: { 'X-Schema-Version': CLIENT_SCHEMA_VERSION, ...headers },
      signal: AbortSignal.timeout(10000)
    };
    if (body !== undefined) {
      init.headers = { ...init.headers, 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    res = await fetch(`${baseUrl}${path}`, init);
  } catch (err) {
    throw ctx.fail(
      'knowledge_unreachable',
      `Knowledge Analytics endpoint is not reachable at ${baseUrl}.`,
      { baseUrl, path, ...ctx.recoveryFor('knowledge_unreachable') },
      { cause: err },
    );
  }

  const pluginHeader = res.headers?.get?.('x-knowledge-plugin');
  if (pluginHeader === null) {
    throw ctx.fail(
      'knowledge_bad_response',
      `Stale or incorrect server detected at ${baseUrl}. Port is occupied by a non-Knowledge process.`,
      { status: res.status, path, ...ctx.recoveryFor('knowledge_bad_response') },
    );
  }

  const schemaHeader = res.headers?.get?.('x-schema-version');
  if (schemaHeader !== undefined && schemaHeader !== null && schemaHeader !== CLIENT_SCHEMA_VERSION) {
    throw ctx.fail(
      'knowledge_bad_response',
      `Knowledge Analytics schema mismatch. Expected ${CLIENT_SCHEMA_VERSION}, got ${schemaHeader}.`,
      { status: res.status, path, expectedSchemaVersion: CLIENT_SCHEMA_VERSION, schemaVersion: schemaHeader, ...ctx.recoveryFor('knowledge_bad_response') },
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw ctx.fail(
      'knowledge_bad_response',
      `Knowledge Analytics endpoint returned non-JSON response with status ${res.status}.`,
      { status: res.status, path, ...ctx.recoveryFor('knowledge_bad_response') },
      { cause: err },
    );
  }

  if (res.status === 428) {
    throw ctx.fail(
      'knowledge_gatekeeper_blocked',
      `Vault fails OKF standards. Blocked by Gatekeeper (HTTP 428). You MUST run 'obsidian_knowledge_health_report', fix critical issues manually (Janitor Protocol), and try again.`,
      { status: res.status, path, payload, ...ctx.recoveryFor('knowledge_gatekeeper_blocked') },
    );
  }

  if (!res.ok) {
    throw ctx.fail(
      'knowledge_bad_response',
      `Knowledge Analytics endpoint returned status ${res.status}.`,
      { status: res.status, path, payload, ...ctx.recoveryFor('knowledge_bad_response') },
    );
  }

  return payload as T;
}

import { tool, z } from '@cyanheads/mcp-ts-core';

const SENSITIVE_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g, // AWS Key
  /AIza[0-9A-Za-z-_]{35}/g, // Google API Key
  /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/g, // Telegram Bot Token
  /-----BEGIN.*?PRIVATE KEY-----[\s\S]+?-----END.*?PRIVATE KEY-----/g, // SSH/Private Keys
  /xox[bpa]-[0-9]{10,13}-[a-zA-Z0-9]{24}/g, // Slack Tokens
  /[a-zA-Z0-9_-]{23,28}\.[a-zA-Z0-9_-]{6,7}\.[a-zA-Z0-9_-]{27,}/g, // Discord Bot Tokens
  /mfa\.[a-z0-9_-]{20,}/g, // Discord MFA
  /[sr]k_(live|test)_[0-9a-zA-Z]{24}/g, // Stripe Keys
  /(?:vk|vkontakte|access_token)[\s_a-z]*['"]?\s*[:=]\s*['"]?([a-zA-Z0-9]{32,85})['"]?/gi, // VK API tokens
  /(?:password|passwd|pwd|secret|token|api_key)['"]?\s*[:=]\s*['"]?([^\s'"&;]+)['"]?/gi // Generic credentials
];

function redactSensitiveData(text: string): string {
  let redacted = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '***REDACTED***');
  }
  return redacted;
}

const MAX_OUTPUT_LENGTH = process.env.OBSIDIAN_KNOWLEDGE_BUDGET 
  ? parseInt(process.env.OBSIDIAN_KNOWLEDGE_BUDGET, 10) 
  : 15000;

function enforceBudget(text: string): string {
  if (text.length > MAX_OUTPUT_LENGTH) {
    return text.substring(0, MAX_OUTPUT_LENGTH) + '\n\n...[Truncated for Context Under Budget]';
  }
  return text;
}

export function createKnowledgeProxyTool<TInput extends z.ZodObject<any, any>, TResult>(opts: {
  name: string;
  description: string;
  input: TInput;
  output: z.ZodType<TResult>;
  path: string | ((input: z.infer<TInput>) => string);
  method?: 'GET' | 'POST' | ((input: z.infer<TInput>) => 'GET' | 'POST');
  authWrite?: boolean;
  gatekeeper?: { requireHealth: boolean };
  format: (params: { result: TResult; input?: z.infer<TInput> }) => any[];
}) {
  return tool(opts.name, {
    description: opts.description,
    annotations: { 
      readOnlyHint: !opts.authWrite, 
      idempotentHint: !opts.authWrite 
    },
    input: opts.input,
    output: z.object({ result: opts.output }),
    auth: [`tool:${opts.name}:${opts.authWrite ? 'write' : 'read'}`],
    errors: knowledgeToolErrors,
    async handler(rawInput, ctx) {
      const input = rawInput as z.infer<TInput>;
      const p = typeof opts.path === 'function' ? opts.path(input) : opts.path;
      const m = typeof opts.method === 'function' ? opts.method(input) : (opts.method ?? 'POST');
      
      const result = await requestKnowledgeJson<TResult>({
        ctx,
        path: p,
        method: m,
        ...(opts.gatekeeper?.requireHealth ? { headers: { 'X-Gatekeeper-Strict': 'true' } } : {}),
        body: m === 'POST' ? input : undefined,
      });
      return { result };
    },
    format: (data: { result: TResult }) => {
      const formatted = opts.format({ result: data.result });
      return formatted.map((part: any) => {
        if (part.type === 'text' && typeof part.text === 'string') {
          return {
            ...part,
            text: redactSensitiveData(enforceBudget(part.text))
          };
        }
        return part;
      }) as any;
    },
  });
}
