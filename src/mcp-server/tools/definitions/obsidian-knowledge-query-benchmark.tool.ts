import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const BenchmarkCaseSchema = z.object({
  query: z.string(),
  expectedPaths: z.array(z.string()),
  minTopK: z.number(),
  notes: z.string().optional(),
});

const BenchmarkCaseResultSchema = z.object({
  query: z.string(),
  pass: z.boolean(),
  missingPaths: z.array(z.string()),
  rankingDrift: z.record(z.string(), z.number()),
});

const BenchmarkReportSchema = z.object({
  pass: z.boolean(),
  topKHitRate: z.number(),
  cases: z.array(BenchmarkCaseResultSchema),
});

export const obsidianKnowledgeQueryBenchmark = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_query_benchmark',
  description:
    'Run a search relevance benchmark against a set of queries to measure ranking quality. Run this after tweaking search behavior to ensure no regressions.',
  authWrite: true,
  input: z.object({
    cases: z.array(BenchmarkCaseSchema).optional().describe('Optional list of benchmark cases to test. If not provided, the default vault benchmark file will be used.'),
  }),
  output: BenchmarkReportSchema,
  path: '/api/benchmark',
  method: 'POST',

  format: ({ result }) => {
    const lines = [
      '**Knowledge Query Benchmark Report**',
      '',
      `Overall Pass: ${result.pass ? '✅ PASS' : '❌ FAIL'}`,
      `Top-K Hit Rate: ${result.topKHitRate}%`,
      '',
      '### Cases Detail',
    ];

    for (const testCase of result.cases) {
      const status = testCase.pass ? '✅' : '❌';
      lines.push(`- **${testCase.query}**: ${status}`);
      if (!testCase.pass && testCase.missingPaths.length > 0) {
        lines.push(`  - Missing expected notes in Top-K:`);
        for (const missing of testCase.missingPaths) {
          const rank = testCase.rankingDrift[missing];
          const rankStr = rank === -1 ? 'Not found' : `Ranked #${rank}`;
          lines.push(`    - \`${missing}\` (${rankStr})`);
        }
      }
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
