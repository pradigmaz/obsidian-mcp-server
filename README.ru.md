<div align="center">
  
  <img src="https://modelcontextprotocol.io/logo.svg" alt="Логотип MCP" width="120" height="120" />

  <h1>obsidian-knowledge-mcp</h1>

  <p>
    <b>Продвинутый MCP-сервер для хранилищ Obsidian с аналитикой графа и валидацией Google OKF.</b>
  </p>

  <p>
    <a href="README.md">🇺🇸 English</a> | <b>🇷🇺 Русский</b>
  </p>

  <p>
    <a href="https://github.com/pradigmaz/obsidian-mcp-server/releases"><img src="https://img.shields.io/github/v/release/pradigmaz/obsidian-mcp-server?style=for-the-badge&color=blue" alt="Релиз"></a>
    <a href="https://github.com/pradigmaz/obsidian-mcp-server/blob/main/LICENSE"><img src="https://img.shields.io/github/license/pradigmaz/obsidian-mcp-server?style=for-the-badge&color=success" alt="Лицензия"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-^6.0.3-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"></a>
    <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-v1.3.11-fbf0df?style=for-the-badge&logo=bun" alt="Bun"></a>
  </p>

  <p>
    <i>Этот проект — форк <a href="https://github.com/cyanheads/obsidian-mcp-server">cyanheads/obsidian-mcp-server</a>. Мы расширили базовые возможности чтения/записи набором аналитических инструментов, чтобы превратить ваше хранилище в идеальную систему памяти для автономного ИИ-агента. Архитектура базового сервера принадлежит его оригинальным авторам.</i>
  </p>
  
  <p>
    <b>14 Инструментов ядра • 9 Инструментов аналитики • 3 Ресурса</b>
  </p>
</div>

---

## ⚠️ Обязательные зависимости

> **ВАЖНО:** Для использования аналитических инструментов этого сервера, в вашем хранилище Obsidian **ОБЯЗАТЕЛЬНО** должны быть установлены и включены следующие плагины:

1. **[Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)** (Для базовых операций чтения/записи)
2. **[Knowledge Analytics](https://github.com/pradigmaz/knowledge-obsidian-plugin)** (Для гигиены и графа)
3. **[Omnisearch](https://github.com/scambier/obsidian-omnisearch)** (Требуется плагину Knowledge Analytics для инструментов `obsidian_search_notes` и `obsidian_knowledge_smart_search`)

---

## 🌟 Возможности

- **Лимиты контекста (Context Under Budget):** Умная обрезка защищает от исчерпания токенов. Длинные результаты поиска обрезаются до 15 000 символов.
- **Маскировка ключей (Sensitive Data Detection):** Сервер находит и вырезает через регулярные выражения ключи AWS, Telegram, Discord и SSH-токены ДО их отправки в контекст LLM.
- **Архитектурные ограничения (Vault Layering):** Отслеживание нарушений зависимостей (например, если активный проект ссылается на архивы).

---

## 🛠️ Инструменты (Tools)

### Инструменты Knowledge Analytics
*Требуют запущенного плагина Knowledge Analytics на `http://127.0.0.1:27125`.*

| Название инструмента | Описание |
|:----------|:------------|
| `obsidian_knowledge_smart_search` | Ранжированный поиск (BM25 + центральность в графе) с пенализацией сгенерированных логов. |
| `obsidian_knowledge_health_report` | Скан гигиены хранилища на предмет заметок-сирот, мертвых хабов и отсутствующих OKF метаданных. |
| `obsidian_knowledge_workspace_brief` | Быстрая сводка: айдентика хранилища, статистика графа и ключевые точки входа. |
| `obsidian_knowledge_agent_bootstrap` | Сжатый стартовый снепшот (сводка + поиск) для инициализации работы агента. |
| `obsidian_knowledge_signal_memory` | Управление сигналами памяти для выравнивания (alignment) поведения ИИ. |
| `obsidian_knowledge_query_benchmark` | Регрессионное тестирование поисковых запросов. |
| `obsidian_knowledge_route_trace` | Графовый алгоритм BFS для поиска кратчайшего пути между двумя заметками. |
| `obsidian_knowledge_concept_cluster` | Поиск перекрестных ссылок и семантических соседей для любого концепта. |
| `obsidian_knowledge_janitor_scan` | Поиск неструктурированных файлов без обязательных полей `type` и `summary`/`description` (по стандарту OKF). |

### Базовые инструменты Obsidian (из апстрима)
*Требуют плагин Local REST API на `http://127.0.0.1:27123`.*

| Название инструмента | Описание |
|:----------|:------------|
| `obsidian_get_note` | Чтение заметки: сырой контент, структура, карта документа или секция. |
| `obsidian_list_notes` | Список заметок и папок по указанному пути. |
| `obsidian_list_tags` | Список всех тегов в хранилище с количеством использований. |
| `obsidian_search_notes` | Поиск по хранилищу: текст, JSONLogic или полнотекстовый BM25-поиск через Omnisearch. |
| `obsidian_write_note` | Создание заметки или ювелирная замена секции. |
| `obsidian_append_to_note` | Добавление контента в конец заметки или конкретной секции. |
| `obsidian_patch_note` | Точечные операции `append` / `prepend` / `replace` над заголовком или блоком. |
| `obsidian_replace_in_note` | Глобальный поиск-замена по всему телу одной заметки. |
| `obsidian_manage_frontmatter` | Атомарные `get` / `set` / `delete` над одним ключом frontmatter. |
| `obsidian_manage_tags` | Добавление, удаление или просмотр тегов в свойствах или тексте. |
| `obsidian_delete_note` | Безвозвратное удаление заметки. |
| `obsidian_open_in_ui` | Открытие файла в интерфейсе приложения Obsidian. |
| `obsidian_list_commands` | Список команд Obsidian (command-palette). |
| `obsidian_execute_command` | Запуск команды Obsidian из палитры команд. |

---

## ⚙️ Установка и настройка

### Переменные окружения

| Переменная | Описание | По умолчанию |
|:---------|:------------|:--------|
| `OBSIDIAN_API_KEY` | **Обязательно.** Токен (Bearer) плагина Obsidian Local REST API. | — |
| `OBSIDIAN_KNOWLEDGE_URL` | Базовый URL плагина Knowledge Analytics. | `http://127.0.0.1:27125` |
| `OBSIDIAN_BASE_URL` | Базовый URL плагина Local REST API. | `http://127.0.0.1:27123` |
| `OBSIDIAN_READ_ONLY` | Глобальный рубильник. Если `true`, блокирует любую запись. | `false` |

*(Смотрите документацию оригинального сервера для настройки путей `OBSIDIAN_READ_PATHS` и `OBSIDIAN_WRITE_PATHS`)*

### 1. Codex
Если вы используете Codex, добавьте следующий блок в файл `~/.codex/config.toml` (или проектный `.codex/config.toml`):

```toml
[mcp_servers.obsidian-knowledge-mcp]
command = "bunx"
args = ["obsidian-mcp-server@latest"]
env = { OBSIDIAN_API_KEY = "your-local-rest-api-key", OBSIDIAN_KNOWLEDGE_URL = "http://127.0.0.1:27125" }
```

### 2. Остальные MCP Клиенты
Для большинства стандартных MCP-сред (Antigravity, Claude Desktop, IDE) используйте стандартный JSON-синтаксис:

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

## 📄 Лицензия
Apache-2.0 — подробности в файле [LICENSE](LICENSE). Код основан на оригинальном сервере `cyanheads/obsidian-mcp-server`.
