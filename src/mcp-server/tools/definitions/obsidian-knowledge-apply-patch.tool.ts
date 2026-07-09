import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';
import { PatchApplyResultSchema, PatchInputSchema } from './obsidian-knowledge-patch-schemas.js';

export const obsidianKnowledgeApplyPatch = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_apply_patch',
  description:
    'Apply a Knowledge patch only if baseHash/baseMtime still match. Creates a vault-local backup before modifying the note.',
  input: PatchInputSchema,
  output: PatchApplyResultSchema,
  path: '/api/write/apply-patch',
  authWrite: true,

  format: ({ result }) => {
    const lines = [
      `**Knowledge Patch Apply: ${result.status}**`,
      `Applied: ${result.applied ? 'yes' : 'no'}`,
      `Path: ${result.path}`,
      `Before: ${result.beforeHash ?? 'none'}`,
      `After: ${result.afterHash}`,
      `Backup: ${result.backupPath ?? 'none'}`,
      `Audit: ${result.auditId}`,
      `Post-write validation: ${result.postWriteValidation.status}`,
    ];
    if (result.postWriteValidation.violations.length > 0) {
      lines.push(
        '',
        'Validation violations:',
        ...result.postWriteValidation.violations.map(
          (violation) => `- ${JSON.stringify(violation)}`,
        ),
      );
    }
    if (!result.applied) {
      lines.push('', 'Recovery: reread the note, then retry with the new baseHash and baseMtime.');
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
