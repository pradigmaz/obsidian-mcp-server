import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';
import { PatchInputSchema, PatchPreviewResultSchema } from './obsidian-knowledge-patch-schemas.js';

export const obsidianKnowledgePreviewPatch = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_preview_patch',
  description:
    'Preview a compare-before-write Knowledge patch. Returns a diff, hashes, affected range, and preflight result without modifying the vault.',
  input: PatchInputSchema,
  output: PatchPreviewResultSchema,
  path: '/api/write/preview-patch',

  format: ({ result }) => {
    const lines = [
      `**Knowledge Patch Preview: ${result.status}**`,
      `Range: L${result.affectedRange.startLine}-L${result.affectedRange.endLine}`,
      `Before: ${result.beforeHash ?? 'none'}`,
      `After: ${result.afterHash}`,
      `Preflight: ${result.preflight.status} (${result.preflight.allowed ? 'allowed' : 'blocked'})`,
      `Safe apply hint: ${result.preflight.safeApplyHint}`,
      '',
      '```diff',
      result.diff,
      '```',
    ];
    if (result.preflight.checks.length > 0) {
      lines.push(
        '',
        'Preflight checks:',
        ...result.preflight.checks.map(
          (check) => `- id=${check.id}; status=${check.status}; message=${check.message}`,
        ),
      );
    }
    if (result.preflight.warnings.length > 0) {
      lines.push('', 'Warnings:', ...result.preflight.warnings.map((warning) => `- ${warning}`));
    }
    if (result.preflight.requiredFixes.length > 0) {
      lines.push('', 'Required fixes:', ...result.preflight.requiredFixes.map((fix) => `- ${fix}`));
      if (
        result.preflight.requiredFixes.some(
          (fix) => fix.includes('baseHash mismatch') || fix.includes('baseMtime mismatch'),
        )
      ) {
        lines.push(
          '',
          'Recovery: reread the note, then retry with the new baseHash and baseMtime.',
        );
      }
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
