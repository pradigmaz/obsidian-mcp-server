import type { Context } from '@cyanheads/mcp-ts-core';
import { validationError } from '@cyanheads/mcp-ts-core/errors';
import type { ObsidianHttpClient } from '../core/http-client.js';

interface LintViolation {
  evidence: string;
  ruleId: string;
  severity: string;
  suggestedStep: string;
}

interface LintWriteResponse {
  valid?: boolean;
  violations?: LintViolation[];
}

export class LintClient {
  readonly #httpClient: ObsidianHttpClient;

  constructor(httpClient: ObsidianHttpClient) {
    this.#httpClient = httpClient;
  }

  async lintWrite(ctx: Context, vaultPath: string, content?: string): Promise<void> {
    const config = this.#httpClient.config;
    if (!config.knowledgeUrl) return;
    const cleanPath = vaultPath.replace(/^\/vault\//, '');
    const url = `${config.knowledgeUrl}/api/lint-write`;

    let res: Response;
    try {
      res = await this.#httpClient.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: cleanPath, content }),
        dispatcher: this.#httpClient.dispatcher,
        signal: ctx.signal,
      });
    } catch {
      // If knowledge plugin is down, we allow writes to proceed (fail open)
      return;
    }

    const body = (await res.json().catch(() => ({}))) as LintWriteResponse;
    if (res.status === 422 || body.valid === false) {
      const violations = body.violations || [];
      const messages = violations
        .map(
          (v) => `- [${v.severity.toUpperCase()}] ${v.ruleId}: ${v.evidence} (${v.suggestedStep})`,
        )
        .join('\n');
      throw validationError(
        `Write rejected by Knowledge Gatekeeper due to health rule violations:\n${messages}\n\nPlease fix these issues before writing.`,
        { reason: 'gatekeeper_rejected' },
      );
    }
  }
}
