import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const AgentBootstrapResponseSchema = z.object({
  status: z.string(),
  brief: z.object({
    filesCount: z.number().optional(),
    topTags: z.array(z.object({ tag: z.string(), count: z.number() })).optional(),
    entryPoints: z.array(z.object({ path: z.string(), score: z.number() })).optional(),
  }),
  notes: z.array(z.object({
    path: z.string(),
    title: z.string(),
    score: z.number(),
    excerpt: z.string().optional(),
  })),
  relevantLinks: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
  suggestedTools: z.array(z.string()),
});

export const obsidianKnowledgeAgentBootstrap = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_agent_bootstrap',
  description:
    'Provide compact agent startup context including workspace brief, relevant notes, nearby links, and suggested next steps.',
  input: z.object({
    query: z.string().min(1).describe('The main task or question to bootstrap context for.'),
    limit: z.number().int().positive().max(50).optional().describe('Maximum number of notes to return. Defaults to 10.'),
    budget: z.number().int().positive().optional().describe('Maximum character budget for the total context excerpt. Defaults to 12000.'),
    filters: z.object({
      pathPrefix: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fileTypes: z.array(z.string()).optional(),
      modifiedAfter: z.number().optional(),
      modifiedBefore: z.number().optional(),
    }).optional().describe('Optional search filters.'),
  }),
  output: AgentBootstrapResponseSchema,
  path: '/api/bootstrap',

  format: ({ result }) => {
    const lines: string[] = [];
    lines.push('**Agent Bootstrap Context**');
    lines.push('');

    // Brief
    lines.push('### Workspace Context');
    if (result.brief.filesCount !== undefined) {
      lines.push(`- Markdown notes: ${result.brief.filesCount}`);
    }
    if (result.brief.topTags && result.brief.topTags.length > 0) {
      lines.push(`- Top tags: ${result.brief.topTags.slice(0, 3).map(t => `${t.tag} (${t.count})`).join(', ')}`);
    }
    lines.push('');

    // Notes
    lines.push(`### Relevant Notes (${result.notes.length})`);
    for (const note of result.notes) {
      lines.push(`- **${note.path}** (score: ${note.score.toFixed(2)})`);
      if (note.excerpt) {
        lines.push(`  *Excerpt*: ${note.excerpt}`);
      }
    }
    lines.push('');

    // Links
    if (result.relevantLinks && result.relevantLinks.length > 0) {
      lines.push('### Nearby Links');
      for (const link of result.relevantLinks) {
        lines.push(`- ${link}`);
      }
      lines.push('');
    }

    // Suggestions
    lines.push('### Suggested Next Steps');
    if (result.openQuestions && result.openQuestions.length > 0) {
      lines.push('**Open Questions:**');
      for (const q of result.openQuestions) {
        lines.push(`- ${q}`);
      }
    }
    lines.push('**Suggested Tools:**');
    for (const t of result.suggestedTools) {
      lines.push(`- \`${t}\``);
    }

    return [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ];
  },
});
