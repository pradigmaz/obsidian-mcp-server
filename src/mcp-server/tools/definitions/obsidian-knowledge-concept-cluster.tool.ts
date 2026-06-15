import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const ConceptClusterResultSchema = z.object({
  concept: z.string(),
  cluster: z.array(z.string()).describe('List of notes strongly clustered around the given concept.'),
  relatedConcepts: z.array(z.string()).describe('Other concepts frequently intersecting with this cluster.'),
});

export const obsidianKnowledgeConceptCluster = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_concept_cluster',
  description:
    'Finds a cluster of notes with intersecting links related to a specific focal concept or note.',
  input: z.object({
    concept: z.string().describe('The focal concept, keyword, or note path to build a cluster around.'),
  }),
  output: ConceptClusterResultSchema,
  path: '/api/concept-cluster',
  gatekeeper: { requireHealth: true },

  format: ({ result }) => {
    const lines = [
      `**Concept Cluster: ${result.concept}**`,
      '',
      `Cluster Notes (${result.cluster.length}):`,
      ...result.cluster.map((note) => `- ${note}`),
      '',
      `Related Concepts (${result.relatedConcepts.length}):`,
      ...result.relatedConcepts.map((concept) => `- ${concept}`),
    ];
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
