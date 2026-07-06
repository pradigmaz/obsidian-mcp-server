import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const ConstraintEvidenceResultSchema = z
  .object({
    status: z.string().describe('Investigation status.'),
    evidence: z.string().describe('Evidence found for the requested constraint.'),
    relatedNotes: z
      .array(z.string().describe('Related vault-relative note path.'))
      .describe('Notes related to the investigated constraint.'),
    confidence: z.number().describe('Confidence score for the investigation result.'),
    gaps: z
      .array(z.string().describe('Discovery gap found during investigation.'))
      .describe('Known evidence gaps after investigation.'),
    suggestedStep: z.string().describe('Suggested next step for the user or agent.'),
  })
  .describe('Constraint investigation result.');

export const obsidianKnowledgeInvestigateConstraint = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_investigate_constraint',
  description:
    'Investigate a specific rule/constraint violation on a given note. Provides exact evidence, gaps, related notes, and actionable next steps in a knowledge-report format.',
  input: z.object({
    path: z.string().describe('The path of the note to investigate'),
    ruleId: z
      .string()
      .describe('The specific rule constraint ID (e.g., missing_okf, isolated_note)'),
  }),
  output: ConstraintEvidenceResultSchema,
  path: '/api/investigate/constraint',
  method: 'POST',
  format: ({ result }) => {
    const lines = [
      `**Constraint Investigation Result**`,
      `Status: ${result.status}`,
      `Confidence: ${result.confidence}`,
      '',
      `### Evidence`,
      result.evidence,
      '',
    ];

    if (result.relatedNotes.length > 0) {
      lines.push('### Related Notes');
      for (const note of result.relatedNotes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }

    if (result.gaps.length > 0) {
      lines.push('### Discovery Gaps');
      for (const gap of result.gaps) {
        lines.push(`- ${gap}`);
      }
      lines.push('');
    }

    lines.push(`### Suggested Next Step`);
    lines.push(result.suggestedStep);

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
