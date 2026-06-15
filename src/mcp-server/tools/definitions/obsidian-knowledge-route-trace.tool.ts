import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const RouteTraceResultSchema = z.object({
  source: z.string(),
  target: z.string(),
  path: z.array(z.string()).describe('The shortest sequence of notes linking source to target.'),
  distance: z.number().describe('The number of hops between source and target.'),
});

export const obsidianKnowledgeRouteTrace = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_route_trace',
  description:
    'Finds the shortest link path (route trace) between a source note and a target note in the Obsidian vault using a Breadth-First Search (BFS) graph algorithm.',
  input: z.object({
    source: z.string().describe('The file path or name of the starting note.'),
    target: z.string().describe('The file path or name of the destination note.'),
  }),
  output: RouteTraceResultSchema,
  path: '/api/route-trace',
  gatekeeper: { requireHealth: true },
  format: ({ result }) => {
    if (result.path.length === 0) {
      return [{ type: 'text', text: `No path found between ${result.source} and ${result.target}.` }];
    }
    const lines = [
      `**Route Trace: ${result.source} ➔ ${result.target}**`,
      `Distance: ${result.distance} hops`,
      '',
      'Path:',
      ...result.path.map((step, index) => `${index + 1}. ${step}`)
    ];
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
