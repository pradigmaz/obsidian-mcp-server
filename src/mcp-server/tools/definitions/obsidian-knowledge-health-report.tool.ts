import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const HygieneViolationSchema = z
  .object({
    ruleId: z.string().describe('Hygiene rule identifier.'),
    severity: z.enum(['info', 'warn', 'high']).describe('Violation severity.'),
    evidence: z.string().describe('Evidence explaining why the rule fired.'),
    suggestedStep: z.string().describe('Recommended fix or next action.'),
    expectedEffortMin: z.number().describe('Estimated effort to fix, in minutes.'),
  })
  .describe('Single Knowledge hygiene rule violation.');

const HotspotScoreExplanationSchema = z
  .object({
    ruleSeverity: z.number().describe('Score contribution from rule severity.'),
    noteRole: z.number().describe('Score contribution from the note role.'),
    graphCentrality: z.number().describe('Score contribution from graph centrality.'),
    freshness: z.number().describe('Score contribution from note freshness.'),
    expectedEffort: z.number().describe('Score contribution from expected remediation effort.'),
  })
  .describe('Breakdown of the hotspot score.');

const NoteHotspotSchema = z
  .object({
    path: z.string().describe('Vault-relative note path for the hotspot.'),
    score: z.number().describe('Overall hotspot score.'),
    roles: z
      .array(z.string().describe('Detected role for this note.'))
      .describe('Roles assigned to this note.'),
    violations: z.array(HygieneViolationSchema).describe('Hygiene violations found on this note.'),
    scoreExplanation: HotspotScoreExplanationSchema.describe('Hotspot score breakdown.'),
  })
  .describe('Problematic note hotspot.');

const SnapshotFindingSchema = z
  .object({
    path: z.string().describe('Vault-relative path for the finding.'),
    ruleId: z.string().describe('Hygiene rule identifier for the finding.'),
  })
  .describe('Snapshot finding identity.');

const SnapshotHotspotDeltaSchema = z
  .object({
    path: z.string().describe('Vault-relative note path for the changed hotspot.'),
    rankDelta: z.number().describe('Change in hotspot rank since the previous snapshot.'),
    scoreDelta: z.number().describe('Change in hotspot score since the previous snapshot.'),
  })
  .describe('Snapshot hotspot rank and score change.');

const SnapshotDiffSchema = z
  .object({
    newFindings: z
      .array(SnapshotFindingSchema)
      .describe('Findings newly present since the last snapshot.'),
    resolvedFindings: z
      .array(SnapshotFindingSchema)
      .describe('Findings resolved since the last snapshot.'),
    scoreDelta: z.number().describe('Overall health score delta since the last snapshot.'),
    hotspotDelta: z.array(SnapshotHotspotDeltaSchema).describe('Hotspot rank and score deltas.'),
  })
  .describe('Diff between the current and previous health snapshots.');

const HealthReportResultSchema = z
  .object({
    status: z.string().describe('Health report status.'),
    ruleViolations: z
      .array(
        z
          .object({
            path: z.string().describe('Vault-relative path where the violation occurred.'),
            violation: HygieneViolationSchema.describe('Violation details for this path.'),
          })
          .describe('Rule violation attached to a note path.'),
      )
      .describe('All rule violations found in the health report.'),
    hotspots: z.array(NoteHotspotSchema).describe('Ranked problematic notes.'),
    groupedByFolder: z
      .record(z.string(), z.array(NoteHotspotSchema))
      .describe('Hotspots grouped by containing folder.'),
    groupedByTag: z
      .record(z.string(), z.array(NoteHotspotSchema))
      .describe('Hotspots grouped by tag.'),
    severityCounts: z
      .object({
        info: z.number().describe('Number of informational findings.'),
        warn: z.number().describe('Number of warning findings.'),
        high: z.number().describe('Number of high-severity findings.'),
      })
      .describe('Finding counts by severity.'),
    snapshotDiff: SnapshotDiffSchema.optional().describe(
      'Optional diff from the previous health snapshot.',
    ),
  })
  .describe('Knowledge vault health report response.');

export const obsidianKnowledgeHealthReport = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_health_report',
  description:
    'Get Knowledge vault health signals from the Obsidian plugin: identifies problematic notes (hotspots) based on hygiene rules like missing tags, unresolved links, empty notes, etc.',
  input: z.object({}),
  output: HealthReportResultSchema,
  path: '/api/health',
  method: 'GET',
  format: ({ result }) => {
    const lines = ['**Knowledge Vault Health Report**', ''];
    lines.push(`Status: ${result.status}`);

    if (result.hotspots.length === 0) {
      lines.push('Vault is healthy! No hotspots found.');
    }

    lines.push(`Total Hotspots: ${result.hotspots.length}`);
    lines.push(
      `Severity: high ${result.severityCounts.high}, warn ${result.severityCounts.warn}, info ${result.severityCounts.info}`,
    );

    if (result.snapshotDiff) {
      const d = result.snapshotDiff;
      lines.push('');
      lines.push('### Snapshot Diff (Since Last Run)');
      lines.push(`Score Delta: ${d.scoreDelta > 0 ? '+' : ''}${d.scoreDelta}`);
      if (d.resolvedFindings.length > 0) {
        lines.push(`Resolved: ${d.resolvedFindings.length} issues`);
        for (const finding of d.resolvedFindings) {
          lines.push(`- ${finding.path}: ${finding.ruleId}`);
        }
      }
      if (d.newFindings.length > 0) {
        lines.push(`New: ${d.newFindings.length} issues`);
        for (const finding of d.newFindings) {
          lines.push(`- ${finding.path}: ${finding.ruleId}`);
        }
      }
      if (d.hotspotDelta.length > 0) {
        lines.push('Hotspot delta:');
        for (const hotspot of d.hotspotDelta) {
          lines.push(
            `- ${hotspot.path}: rank ${hotspot.rankDelta > 0 ? '+' : ''}${hotspot.rankDelta}, score ${hotspot.scoreDelta > 0 ? '+' : ''}${hotspot.scoreDelta}`,
          );
        }
      }
    }

    lines.push('');

    if (result.ruleViolations.length > 0) {
      lines.push('### Rule Violations');
      for (const item of result.ruleViolations) {
        lines.push(
          `- **${item.path}** [${item.violation.severity.toUpperCase()}] ${item.violation.ruleId}: ${item.violation.evidence}`,
        );
        lines.push(
          `  - Fix: ${item.violation.suggestedStep} (~${item.violation.expectedEffortMin}m)`,
        );
      }
      lines.push('');
    }

    // Top 10 hotspots
    lines.push('### Top 10 Hotspots');
    result.hotspots.slice(0, 10).forEach((h) => {
      const exp = h.scoreExplanation;
      lines.push(`- **${h.path}** (Score: ${h.score}) [Roles: ${h.roles.join(', ')}]`);
      lines.push(
        `  - *Score Breakdown*: Rules: ${exp.ruleSeverity}, Role: ${exp.noteRole}, Graph: ${exp.graphCentrality}, Freshness: ${exp.freshness}, Effort: ${exp.expectedEffort}`,
      );
      h.violations.forEach((v) => {
        lines.push(`  - [${v.severity.toUpperCase()}] **${v.ruleId}**: ${v.evidence}`);
        lines.push(`    - *Fix*: ${v.suggestedStep} (~${v.expectedEffortMin}m)`);
      });
    });

    lines.push('');
    lines.push('### Grouped by Folder');
    for (const [folder, folderHotspots] of Object.entries(result.groupedByFolder)) {
      if (folderHotspots.length === 0) continue;
      lines.push(`- **${folder}** (${folderHotspots.length} issues)`);
      for (const h of folderHotspots) {
        const exp = h.scoreExplanation;
        lines.push(`  - ${h.path} (score: ${h.score}; roles: ${h.roles.join(', ')})`);
        lines.push(
          `    - Score: Rules ${exp.ruleSeverity}, Role ${exp.noteRole}, Graph ${exp.graphCentrality}, Freshness ${exp.freshness}, Effort ${exp.expectedEffort}`,
        );
        for (const v of h.violations) {
          lines.push(`    - [${v.severity.toUpperCase()}] ${v.ruleId}: ${v.evidence}`);
          lines.push(`      - Fix: ${v.suggestedStep} (~${v.expectedEffortMin}m)`);
        }
      }
    }

    lines.push('');
    lines.push('### Grouped by Tag');
    for (const [tag, tagHotspots] of Object.entries(result.groupedByTag)) {
      if (tagHotspots.length === 0) continue;
      lines.push(`- **${tag}** (${tagHotspots.length} issues)`);
      for (const h of tagHotspots) {
        const exp = h.scoreExplanation;
        lines.push(`  - ${h.path} (score: ${h.score}; roles: ${h.roles.join(', ')})`);
        lines.push(
          `    - Score: Rules ${exp.ruleSeverity}, Role ${exp.noteRole}, Graph ${exp.graphCentrality}, Freshness ${exp.freshness}, Effort ${exp.expectedEffort}`,
        );
        for (const v of h.violations) {
          lines.push(`    - [${v.severity.toUpperCase()}] ${v.ruleId}: ${v.evidence}`);
          lines.push(`      - Fix: ${v.suggestedStep} (~${v.expectedEffortMin}m)`);
        }
      }
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
