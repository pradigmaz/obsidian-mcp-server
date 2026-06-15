<div align="center">
  
  <img src="https://modelcontextprotocol.io/logo.svg" alt="MCP Logo" width="120" height="120" />

  <h1>obsidian-knowledge-mcp</h1>

  <p>
    <b>Advanced MCP server for Obsidian vaults with Knowledge Analytics, graph intelligence, and Google OKF validation.</b>
  </p>

  <p>
    <a href="https://github.com/pradigmaz/obsidian-mcp-server/releases"><img src="https://img.shields.io/github/v/release/pradigmaz/obsidian-mcp-server?style=for-the-badge&color=blue" alt="Release"></a>
    <a href="https://github.com/pradigmaz/obsidian-mcp-server/blob/main/LICENSE"><img src="https://img.shields.io/github/license/pradigmaz/obsidian-mcp-server?style=for-the-badge&color=success" alt="License"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-^6.0.3-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"></a>
    <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-v1.3.11-fbf0df?style=for-the-badge&logo=bun" alt="Bun"></a>
  </p>

  <p>
    <i>This project is a fork of <a href="https://github.com/cyanheads/obsidian-mcp-server">cyanheads/obsidian-mcp-server</a>. We extended the core read/write capabilities with a suite of analytical tools to make your vault an autonomous agent's perfect memory system. We do not claim authorship of the base server architecture.</i>
  </p>
  
  <p>
    <b>14 Core Tools • 9 Knowledge Tools • 3 Resources</b>
  </p>
</div>

---

## ⚠️ Required Dependencies

> **IMPORTANT:** To use the analytical tools exposed by this server, your Obsidian vault **MUST** have the following plugins installed and enabled:

1. **[Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)** (For core read/write tools)
2. **[Knowledge Analytics](https://github.com/pradigmaz/knowledge-obsidian-plugin)** (For graph/hygiene tools)
3. **[Omnisearch](https://github.com/scambier/obsidian-omnisearch)** (Required by Knowledge Analytics for `obsidian_search_notes` and `obsidian_knowledge_smart_search`)

---

## 🌟 Features

- **Context Under Budget:** Smart truncation prevents token exhaustion. Large search results are limited to 15,000 characters.
- **Sensitive Data Detection:** Real-time regex censorship of AWS, Telegram, Discord, and SSH keys before they reach the LLM context.
- **Vault Layering:** Detects architectural violations (e.g., active projects linking to archives).

---

## 🛠️ Tools

### Knowledge Analytics Tools
*Requires the Knowledge Analytics plugin running on `http://127.0.0.1:27125`.*

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
*Requires the Local REST API plugin running on `http://127.0.0.1:27123`.*

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

## ⚙️ Setup & Configuration

### Environment Variables

| Variable | Description | Default |
|:---------|:------------|:--------|
| `OBSIDIAN_API_KEY` | **Required.** Bearer token for the Obsidian Local REST API plugin. | — |
| `OBSIDIAN_KNOWLEDGE_URL` | Base URL of the Knowledge Analytics plugin. | `http://127.0.0.1:27125` |
| `OBSIDIAN_BASE_URL` | Base URL of the Local REST API plugin. | `http://127.0.0.1:27123` |
| `OBSIDIAN_READ_ONLY` | Global kill switch. When `true`, denies every write. | `false` |

*(See upstream documentation for `OBSIDIAN_READ_PATHS` and `OBSIDIAN_WRITE_PATHS`)*

### 1. Codex
If you are using Codex, add the following to your `~/.codex/config.toml` (or project `.codex/config.toml`):

```toml
[mcp_servers.obsidian-knowledge-mcp]
command = "bunx"
args = ["obsidian-mcp-server@latest"]
env = { OBSIDIAN_API_KEY = "your-local-rest-api-key", OBSIDIAN_KNOWLEDGE_URL = "http://127.0.0.1:27125" }
```

### 2. Other MCP Clients
For most standard MCP environments (Antigravity, Claude Desktop, IDEs), use the standard JSON configuration syntax:

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

---

## 📄 License
Apache-2.0 — see [LICENSE](LICENSE) for details. Codebase derived from `cyanheads/obsidian-mcp-server`.
