<div align="center">
  <h1>obsidian-knowledge-mcp</h1>
  <p><b>Advanced MCP server for Obsidian vaults with Knowledge Analytics, graph intelligence, and Google OKF validation.</b><br/>
  <i>This project is a fork of <a href="https://github.com/cyanheads/obsidian-mcp-server">cyanheads/obsidian-mcp-server</a>. We extended the core read/write capabilities with a suite of analytical tools to make your vault an autonomous agent's perfect memory system. We do not claim authorship of the base server architecture.</i>
  <div>14 Core Tools • 9 Knowledge Tools • 3 Resources</div>
  </p>
</div>

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-^6.0.3-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-v1.3.11-blueviolet.svg?style=flat-square)](https://bun.sh/)

</div>

---

## What makes this different?

This is not just a tool for reading and writing files. It's a structured intelligence gateway:

- **Google OKF (Open Knowledge Format):** Strict enforcement of note structure. Unstructured notes trigger hygiene warnings (see the [Google OKF Specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)).
- **Context Under Budget:** Smart truncation prevents token exhaustion. Large search results are limited to 15,000 characters.
- **Sensitive Data Detection:** Real-time regex censorship of AWS, VK, Discord, and SSH keys before they reach the LLM context.
- **Vault Layering & Lineage Demotion:** Penalizes auto-generated logs in search results and detects architectural violations (e.g., active projects linking to archives).
- **Graph Pathfinding:** High-performance BFS route-tracing (`MAX_NODES = 2000`) and concept clustering.

---

## Tools

### Knowledge Analytics Tools
Requires the [knowledge-obsidian-plugin](https://github.com/pradigmaz/knowledge-obsidian-plugin) running on `http://127.0.0.1:27125`.

| Tool Name | Description |
|:----------|:------------|
| `obsidian_knowledge_smart_search` | BM25 + graph centrality ranked search with generated lineage demotion. |
| `obsidian_knowledge_health_report` | Vault hygiene scan for orphaned notes, stale hubs, and missing OKF metadata. |
| `obsidian_knowledge_workspace_brief` | Fast vault identity, graph summary, and top entry points. |
| `obsidian_knowledge_agent_bootstrap` | Condensed bootstrap snapshot (brief + search) for starting tasks. |
| `obsidian_knowledge_signal_memory` | Manage memory signals for agent alignment. |
| `obsidian_knowledge_query_benchmark` | Regression testing for search queries. |
| `obsidian_knowledge_route_trace` | BFS pathfinding graph algorithm to discover connections between notes. |
| `obsidian_knowledge_concept_cluster` | Find cross-links and semantic neighbors for any given concept. |
| `obsidian_knowledge_janitor_scan` | Find unstructured notes missing `type` and `summary`/`description` OKF frontmatter. |

### Core Obsidian Tools (from upstream)
| Tool Name | Description |
|:----------|:------------|
| `obsidian_get_note` | Read a note as raw content, full structured form, document map, or section. |
| `obsidian_list_notes` | List notes and subdirectories under a vault path. |
| `obsidian_list_tags` | List every tag found across the vault with usage counts. |
| `obsidian_search_notes` | Search the vault by text, JSONLogic, or BM25-ranked Omnisearch. |
| `obsidian_write_note` | Create a note or surgically replace a section in place. |
| `obsidian_append_to_note` | Append content to a note or a specific section. |
| `obsidian_patch_note` | Surgical `append` / `prepend` / `replace` against a heading or block. |
| `obsidian_replace_in_note` | Body-wide search-replace inside a single note. |
| `obsidian_manage_frontmatter` | Atomic `get` / `set` / `delete` on a single frontmatter key. |
| `obsidian_manage_tags` | Add, remove, or list tags in frontmatter or body. |
| `obsidian_delete_note` | Permanently delete a note. |
| `obsidian_open_in_ui` | Open a file in the Obsidian app UI. |
| `obsidian_list_commands` | List Obsidian command-palette commands. |
| `obsidian_execute_command` | Execute an Obsidian command-palette command. |

---

## Setup & Configuration

In addition to the standard upstream setup, you need the **[Knowledge Analytics](https://github.com/pradigmaz/knowledge-obsidian-plugin)** plugin installed in your vault.

Client configuration:

```json
{
  "mcpServers": {
    "obsidian-knowledge-mcp": {
      "type": "stdio",
      "command": "bunx",
      "args": ["obsidian-mcp-server@latest"],
      "env": {
        "OBSIDIAN_API_KEY": "your-local-rest-api-key",
        "OBSIDIAN_KNOWLEDGE_URL": "http://127.0.0.1:27125"
      }
    }
  }
}
```

### Environment Variables
| Variable | Description | Default |
|:---------|:------------|:--------|
| `OBSIDIAN_API_KEY` | **Required.** Bearer token for the Obsidian Local REST API plugin. | — |
| `OBSIDIAN_KNOWLEDGE_URL` | Base URL of the Knowledge Analytics plugin. | `http://127.0.0.1:27125` |
| `OBSIDIAN_BASE_URL` | Base URL of the Local REST API plugin. | `http://127.0.0.1:27123` |
| `OBSIDIAN_READ_ONLY` | Global kill switch. When `true`, denies every write. | `false` |

*(See upstream documentation for `OBSIDIAN_READ_PATHS` and `OBSIDIAN_WRITE_PATHS`)*

---
## License
Apache-2.0 — see [LICENSE](LICENSE) for details. Codebase derived from `cyanheads/obsidian-mcp-server`.
