/**
 * @fileoverview Tool registration barrel. Tools are split into read-only and
 * write groups so the entry point can wrap the write set with `disabledTool()`
 * when `OBSIDIAN_READ_ONLY=true`. The command-palette pair is exported
 * separately so the entry point wraps it with `disabledTool()` when either
 * `OBSIDIAN_ENABLE_COMMANDS=false` or `OBSIDIAN_READ_ONLY=true` — keeping this
 * module free of eager config reads. `obsidian_search_notes` is exposed as a
 * factory (`buildSearchNotesTool`) because its mode enum is conditional on
 * Omnisearch reachability, which is only known after the startup probe runs.
 * @module mcp-server/tools/definitions/index
 */

import { obsidianAppendToNote } from './obsidian-append-to-note.tool.js';
import { obsidianDeleteNote } from './obsidian-delete-note.tool.js';
import { obsidianExecuteCommand } from './obsidian-execute-command.tool.js';
import { obsidianGetNote } from './obsidian-get-note.tool.js';
import { obsidianListCommands } from './obsidian-list-commands.tool.js';
import { obsidianListNotes } from './obsidian-list-notes.tool.js';
import { obsidianListTags } from './obsidian-list-tags.tool.js';
import { obsidianManageFrontmatter } from './obsidian-manage-frontmatter.tool.js';
import { obsidianManageTags } from './obsidian-manage-tags.tool.js';
import { obsidianOpenInUi } from './obsidian-open-in-ui.tool.js';
import { obsidianPatchNote } from './obsidian-patch-note.tool.js';
import { obsidianReplaceInNote } from './obsidian-replace-in-note.tool.js';
import { obsidianWriteNote } from './obsidian-write-note.tool.js';

export { buildSearchNotesTool } from './obsidian-search-notes.tool.js';

import { obsidianKnowledgeStatus } from './obsidian-knowledge-status.tool.js';
import { obsidianKnowledgeHealthReport } from './obsidian-knowledge-health-report.tool.js';
import { obsidianKnowledgeSmartSearch } from './obsidian-knowledge-smart-search.tool.js';
import { obsidianKnowledgeWorkspaceBrief } from './obsidian-knowledge-workspace-brief.tool.js';
import { obsidianKnowledgeAgentBootstrap } from './obsidian-knowledge-agent-bootstrap.tool.js';
import { obsidianKnowledgeSignalMemoryTool } from './obsidian-knowledge-signal-memory.tool.js';
import { obsidianKnowledgeQueryBenchmark } from './obsidian-knowledge-query-benchmark.tool.js';
import { obsidianKnowledgeRouteTrace } from './obsidian-knowledge-route-trace.tool.js';
import { obsidianKnowledgeConceptCluster } from './obsidian-knowledge-concept-cluster.tool.js';
import { obsidianKnowledgeJanitorScan } from './obsidian-knowledge-janitor-scan.tool.js';

/**
 * Read-only tools that don't depend on runtime probes — always registered,
 * even with `OBSIDIAN_READ_ONLY=true`. `obsidian_search_notes` is constructed
 * separately in the entry point via `buildSearchNotesTool` so its mode enum
 * can reflect Omnisearch reachability.
 */
export const readToolDefinitions = [
  obsidianGetNote,
  obsidianListNotes,
  obsidianListTags,
  obsidianOpenInUi,
  obsidianKnowledgeStatus,
  obsidianKnowledgeHealthReport,
  obsidianKnowledgeSmartSearch,
  obsidianKnowledgeWorkspaceBrief,
  obsidianKnowledgeAgentBootstrap,
  obsidianKnowledgeSignalMemoryTool,
  obsidianKnowledgeQueryBenchmark,
  obsidianKnowledgeRouteTrace,
  obsidianKnowledgeConceptCluster,
  obsidianKnowledgeJanitorScan,
  obsidianManageBackups,
];

import { obsidianManageBackups } from './obsidian-manage-backups.tool.js';

/** Write tools — wrapped with `disabledTool()` when `OBSIDIAN_READ_ONLY=true`. */
export const writeToolDefinitions = [
  obsidianWriteNote,
  obsidianAppendToNote,
  obsidianPatchNote,
  obsidianReplaceInNote,
  obsidianManageFrontmatter,
  obsidianManageTags,
  obsidianDeleteNote,
];

/** Command-palette tools — opt-in via `OBSIDIAN_ENABLE_COMMANDS=true`; suppressed by `OBSIDIAN_READ_ONLY=true`. */
export const commandToolDefinitions = [obsidianListCommands, obsidianExecuteCommand];
