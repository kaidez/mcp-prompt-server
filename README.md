# mcp-prompt-server

A TypeScript MCP (Model Context Protocol) server that connects Claude Desktop to a local `prompts/` folder. Claude can list, read, and save prompt files directly — no copy-paste required.

Built as a portfolio project demonstrating integration engineering patterns: event-driven architecture, ETL pipelines, runtime validation, and security-conscious design.

This project is part of a three-project series built to deepen understanding of the Claude API and the broader Anthropic ecosystem — including how MCP servers, VS Code extensions, and the Claude API itself relate to each other and work together.

---

## What This Is

This is an MCP server — a local process that Claude Desktop launches and communicates with via stdin/stdout (JSON-RPC over stdio). It exposes three tools that Claude can call at any time during a conversation:

| Tool | What it does |
|--|--|
| `list_prompts` | Lists all `.txt` and `.md` files in the `prompts/` folder |
| `read_prompt` | Reads and returns the contents of a specific file |
| `save_prompt` | Saves text as a new timestamped `.txt` file |

---

## Why It Exists

The two companion projects — [`claude-prompt-reader`](https://github.com/kaidez/claude-prompt-reader) and [`save-selected-text`](https://github.com/kaidez/save-selected-text) — trigger Claude via file events inside VS Code. This project takes the next step: exposing that same prompt workflow as MCP tools that Claude Desktop can call autonomously, without any manual trigger.

Together, the three projects form a complete picture of how to build AI-adjacent tooling at different layers of the stack:

| Project | Trigger | Pattern |
|--|--|--|
| `claude-prompt-reader` | File save event | Event-driven ETL |
| `save-selected-text` | Right-click selection | User-initiated ETL |
| `mcp-prompt-server` | Claude's own reasoning | Autonomous tool use |

---

## How the MCP Architecture Works

MCP has two sides:

**Claude Desktop = the client.** It connects to your server at startup, discovers available tools, and decides when to call them based on the conversation.

**This server = the server.** It registers tools, waits for JSON-RPC requests over stdio, runs the requested logic, and returns results.

```
You type in Claude Desktop
        ↓
Claude decides to call a tool
        ↓
Claude Desktop sends JSON-RPC request over stdio
        ↓
This server runs the tool and returns the result
        ↓
Claude uses the result to form its response
```

Every tool call is stateless — the server receives a request, does its work, and responds. No session state, no memory between calls.

---

## ETL Pattern

Each tool follows the same Extract → Transform → Load pattern used in enterprise data pipelines:

**`list_prompts`**
- Extract: Read the `prompts/` directory
- Transform: Filter for `.txt` and `.md` files only
- Load: Return the file list as text

**`read_prompt`**
- Extract: Read a specific file from disk
- Transform: Sanitize the filename (directory traversal guard)
- Load: Return the file contents as text

**`save_prompt`**
- Extract: Receive text input from Claude
- Transform: Validate content, generate ISO 8601 timestamp
- Load: Write file to disk (write-on-success pattern)

---

## Security Design

**Directory traversal guard** — `read_prompt` strips all path components from the filename using `path.basename()` before constructing the file path. A malicious input like `../../etc/passwd` is reduced to `passwd`, which won't exist in the prompts folder.

**Write-on-success** — `save_prompt` only writes to disk after all validation passes. Empty content is rejected before any file operation begins. This mirrors the transactional integrity pattern used in database writes.

**Least privilege** — Claude Desktop requires explicit user permission before any MCP server can run. Each new conversation requires the toggle to be re-enabled by the user.

---

## Tech Stack

- **TypeScript** — strict mode, ES Modules
- **`@modelcontextprotocol/sdk`** — MCP server implementation
- **`zod`** — runtime input validation and TypeScript type inference
- **`fs` / `path`** — Node.js standard library for file operations
- **Mocha + Sinon** — unit testing with stubs for isolated file system testing

---

## Getting Started

**Prerequisites**
- Node.js 18+
- Claude Desktop installed
- An Anthropic API key (for Claude Desktop)

**Install**
```bash
git clone https://github.com/kaidez/mcp-prompt-server.git
cd mcp-prompt-server
npm install
npm run build
```

**Connect to Claude Desktop**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-prompt-server": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/repos/mcp-prompt-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. In a new conversation, click `+` → Connectors → enable `mcp-prompt-server`.

---

## Usage

Once connected, speak naturally in Claude Desktop:

```
List my prompt files
Read the contents of test.txt
Save this as a new prompt: What makes a great integration engineer?
```

Claude will call the appropriate tool automatically.

---

## Project Structure

```
mcp-prompt-server/
├── src/
│   ├── index.ts                  # MCP server — all three tools
│   └── test/
│       └── suite/
│           └── index.test.ts     # 9 unit tests (Mocha + Sinon)
├── prompts/                      # Prompt files live here
│   └── test.txt
├── dist/                         # Compiled output (git-ignored)
├── skills/
│   └── prompt-manager/
│       └── SKILL.md              # Agent Skills layer
├── package.json
└── tsconfig.json
```

---

## Tests

9 unit tests covering happy paths, sad paths, and security guards:

```bash
npm test
```

| # | Test | Coverage |
|--|--|--|
| 1 | Server name and version | Identity |
| 2 | `list_prompts` returns files | Happy path |
| 3 | `list_prompts` returns empty message | Sad path |
| 4 | `list_prompts` filters non-.txt/.md files | Guard |
| 5 | `read_prompt` returns file contents | Happy path |
| 6 | `read_prompt` handles missing file | Sad path |
| 7 | `read_prompt` blocks directory traversal | Security |
| 8 | `save_prompt` writes file and returns name | Happy path |
| 9 | `save_prompt` rejects empty content | Sad path |

---

## What I'd Add Next

- **Python port** — same server rebuilt with the `mcp` Python SDK
- **Conversation history** — persist Claude's responses alongside prompt files
- **`update_prompt` tool** — edit existing files by name
- **`delete_prompt` tool** — remove files with confirmation guard
- **Remote transport** — switch from stdio to Streamable HTTP for networked access

---

## Companion Projects

All three projects were built as a series to better understand the Claude API and Anthropic ecosystem — specifically how the API, MCP protocol, and VS Code tooling relate to each other.

| Project | Uses Claude API directly | Description |
|--|--|--|
| [`claude-prompt-reader`](https://github.com/kaidez/claude-prompt-reader) | ✅ Yes | VS Code extension — watches `prompts/` folder, sends files to `api.anthropic.com/v1/messages` on save |
| [`save-selected-text`](https://github.com/kaidez/save-selected-text) | ✅ Yes | VS Code extension — saves highlighted text to `prompts/` and sends to Claude API via right-click |
| `mcp-prompt-server` (this project) | ❌ No | MCP server — exposes prompt files as tools for Claude Desktop to call autonomously via stdio |

**Key distinction:** The two VS Code extensions make direct HTTP calls to `api.anthropic.com/v1/messages` using an API key. This MCP server does not — it communicates with Claude Desktop via stdio (JSON-RPC), and Claude Desktop handles the API layer internally. Understanding this boundary — where the Claude API lives vs. where MCP lives — was one of the core learnings from building this series.

---

## Why This Architecture Matters

MCP turns Claude from a conversational assistant into an autonomous agent that can interact with local systems. The stdio transport used here is the same IPC pattern used in language servers, compilers, and build tools — battle-tested Unix infrastructure repurposed for AI tooling.

The stateless, tool-based design maps directly to enterprise integration patterns: each tool is a discrete, testable unit with defined inputs, defined outputs, and no hidden side effects. That's the same contract you'd write for a REST endpoint, a message queue consumer, or a workflow node in an iPaaS (Integration Platform as a Service) platform like Workato or Boomi.