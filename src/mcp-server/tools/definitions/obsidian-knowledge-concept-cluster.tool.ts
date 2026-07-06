import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const ConceptClusterResultSchema = z
  .object({
    seed: z
      .object({
        seed: z.string().describe('Concept, note, or path used as the cluster seed.'),
        seed_kind: z.string().describe('Kind of cluster seed, such as concept, note, or path.'),
      })
      .describe('Resolved concept-cluster seed.'),
    variants: z
      .array(z.any().describe('Cluster variant candidate.'))
      .describe('Cluster variants returned by Knowledge Analytics.'),
    cluster_summary: z
      .object({
        variant_count: z.number().describe('Number of cluster variants.'),
        languages: z
          .array(z.string().describe('Language represented in cluster variants.'))
          .describe('Languages represented in the cluster.'),
        route_kinds: z
          .array(z.string().describe('Route or relation kind represented in the cluster.'))
          .describe('Route kinds represented in the cluster.'),
      })
      .passthrough()
      .describe('Summary statistics for the cluster.'),
    gaps: z.array(z.string().describe('Cluster gap description.')).describe('Known cluster gaps.'),
    capability_status: z.string().describe('Capability status for concept clustering.'),
    unsupported_sources: z
      .array(z.string().describe('Unsupported source encountered while clustering.'))
      .describe('Sources that concept clustering could not use.'),
    confidence: z.number().describe('Overall concept-cluster confidence score.'),
    // Legacy fields for backward compat
    concept: z.string().optional().describe('Legacy concept identifier.'),
    cluster: z
      .array(z.string().describe('Legacy cluster note path.'))
      .optional()
      .describe('Legacy cluster notes.'),
    relatedConcepts: z
      .array(z.string().describe('Legacy related concept.'))
      .optional()
      .describe('Legacy related concepts.'),
    centralityScore: z.number().optional().describe('Legacy centrality score.'),
  })
  .describe('Knowledge Analytics concept-cluster response.');

export const obsidianKnowledgeConceptCluster = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_concept_cluster',
  description:
    'Finds a cluster of notes with intersecting links related to a specific focal concept or note.',
  input: z.object({
    concept: z
      .string()
      .describe('The focal concept, keyword, or note path to build a cluster around.'),
    depth: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Optional graph traversal depth. Defaults to the plugin setting.'),
  }),
  output: ConceptClusterResultSchema,
  path: '/api/concept-cluster',
  gatekeeper: { requireHealth: true },

  format: ({ result }) => {
    // ponytail: fallback to legacy fields if knowledge strict fields are empty
    const concept = result.seed?.seed || result.concept;
    const asText = (value: unknown) => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string')
        return value.id;
      return JSON.stringify(value);
    };
    const cluster = result.variants?.map((variant) => asText(variant)) || result.cluster || [];
    const related = result.relatedConcepts || [];
    const lines = [
      `**Concept Cluster: ${concept}**`,
      `- Seed kind: ${result.seed?.seed_kind || 'unknown'}`,
      `- Capability status: ${result.capability_status}`,
      `- Confidence: ${result.confidence}`,
      `- Variant count: ${result.cluster_summary?.variant_count ?? cluster.length}`,
      `- Languages: ${result.cluster_summary?.languages?.join(', ') || 'none'}`,
      `- Route kinds: ${result.cluster_summary?.route_kinds?.join(', ') || 'none'}`,
      '',
      `Cluster Notes (${cluster.length}):`,
      ...cluster.map((note) => `- ${note}`),
      '',
      `Related Concepts (${related.length}):`,
      ...related.map((c) => `- ${c}`),
    ];
    if (result.variants?.length)
      lines.push('', '### Variants', ...result.variants.map((variant) => `- ${asText(variant)}`));
    if (result.gaps?.length) lines.push('', '### Gaps', ...result.gaps.map((gap) => `- ${gap}`));
    if (result.unsupported_sources?.length)
      lines.push(
        '',
        '### Unsupported Sources',
        ...result.unsupported_sources.map((source) => `- ${source}`),
      );
    if (result.concept) lines.push('', `Legacy concept: ${result.concept}`);
    if (result.cluster?.length) lines.push(`Legacy cluster: ${result.cluster.join(', ')}`);
    if (result.centralityScore !== undefined)
      lines.push(`Legacy centrality score: ${result.centralityScore}`);
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
