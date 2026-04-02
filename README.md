<p align="center">
  <img src="https://raw.githubusercontent.com/xiaolai/codex-octopus/main/assets/codex-octopus.svg" alt="Codex Octopus" width="200" />
</p>

# Codex Octopus

One brain, many arms.

An MCP server that wraps the [OpenAI Codex SDK](https://www.npmjs.com/package/@openai/codex-sdk), letting you run multiple specialized Codex agents — each with its own model, sandbox, effort, and personality — from any MCP client.

## Why

Codex is powerful. But one instance does everything the same way. Sometimes you want a **strict code reviewer** in read-only sandbox. A **test writer** with workspace-write access. A **cheap quick helper** on minimal effort. A **deep thinker** on xhigh.

Codex Octopus lets you spin up as many of these as you need. Same binary, different configurations. Each one shows up as a separate tool in your MCP client.

## Prerequisites

- **Node.js** >= 18
- **Codex CLI** — the [Codex SDK](https://www.npmjs.com/package/@openai/codex-sdk) spawns the Codex CLI under the hood, so you need it installed (`@openai/codex`)
- **OpenAI API key** (`CODEX_API_KEY` env var) or inherited from parent process

## Install

```bash
npm install codex-octopus
```

Or use `npx` directly in your `.mcp.json` (see Quick Start below).

## Quick Start

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "codex": {
      "command": "npx",
      "args": ["codex-octopus"],
      "env": {
        "CODEX_SANDBOX_MODE": "workspace-write",
        "CODEX_APPROVAL_POLICY": "never"
      }
    }
  }
}
```

This gives you two tools: `codex` and `codex_reply`. That's it — you have Codex as a tool.

## Multiple Agents

The real power is running several instances with different configurations:

```json
{
  "mcpServers": {
    "code-reviewer": {
      "command": "npx",
      "args": ["codex-octopus"],
      "env": {
        "CODEX_TOOL_NAME": "code_reviewer",
        "CODEX_SERVER_NAME": "code-reviewer",
        "CODEX_DESCRIPTION": "Strict code reviewer. Read-only sandbox.",
        "CODEX_MODEL": "o3",
        "CODEX_SANDBOX_MODE": "read-only",
        "CODEX_APPEND_INSTRUCTIONS": "You are a strict code reviewer. Report real bugs, not style preferences.",
        "CODEX_EFFORT": "high"
      }
    },
    "test-writer": {
      "command": "npx",
      "args": ["codex-octopus"],
      "env": {
        "CODEX_TOOL_NAME": "test_writer",
        "CODEX_SERVER_NAME": "test-writer",
        "CODEX_DESCRIPTION": "Writes thorough tests with edge case coverage.",
        "CODEX_MODEL": "gpt-5-codex",
        "CODEX_SANDBOX_MODE": "workspace-write",
        "CODEX_APPEND_INSTRUCTIONS": "Write tests first. Cover edge cases. TDD."
      }
    },
    "quick-qa": {
      "command": "npx",
      "args": ["codex-octopus"],
      "env": {
        "CODEX_TOOL_NAME": "quick_qa",
        "CODEX_SERVER_NAME": "quick-qa",
        "CODEX_DESCRIPTION": "Fast answers to quick coding questions.",
        "CODEX_EFFORT": "minimal"
      }
    }
  }
}
```

Your MCP client now sees three distinct tools — `code_reviewer`, `test_writer`, `quick_qa` — each purpose-built.

## Agent Factory

Don't want to write configs by hand? Add a factory instance:

```json
{
  "mcpServers": {
    "agent-factory": {
      "command": "npx",
      "args": ["codex-octopus"],
      "env": {
        "CODEX_FACTORY_ONLY": "true",
        "CODEX_SERVER_NAME": "agent-factory"
      }
    }
  }
}
```

This exposes a single `create_codex_mcp` tool — an interactive wizard. Tell it what you want ("a strict code reviewer with read-only sandbox") and it generates the `.mcp.json` entry for you.

## Tools

Each non-factory instance exposes:

| Tool           | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `<name>`       | Send a task to the agent, get a response + `thread_id` |
| `<name>_reply` | Continue a previous conversation by `thread_id`        |

Per-invocation parameters (override server defaults):

| Parameter        | Description                                        |
| ---------------- | -------------------------------------------------- |
| `prompt`         | The task or question (required)                    |
| `cwd`            | Working directory override                         |
| `model`          | Model override                                     |
| `additionalDirs` | Extra directories the agent can access             |
| `effort`         | Reasoning effort (`minimal` to `xhigh`)            |
| `sandboxMode`    | Sandbox override (can only tighten, never loosen)  |
| `approvalPolicy` | Approval override (can only tighten, never loosen) |
| `networkAccess`  | Enable network access from sandbox                 |
| `webSearchMode`  | Web search: `disabled`, `cached`, `live`           |
| `instructions`   | Additional instructions (prepended to prompt)      |

## Configuration

All configuration is via environment variables in `.mcp.json`. Every env var is optional.

### Identity

| Env Var              | Description                                   | Default          |
| -------------------- | --------------------------------------------- | ---------------- |
| `CODEX_TOOL_NAME`    | Tool name prefix (`<name>` and `<name>_reply`) | `codex`         |
| `CODEX_DESCRIPTION`  | Tool description shown to the host AI         | generic          |
| `CODEX_SERVER_NAME`  | MCP server name in protocol handshake         | `codex-octopus`  |
| `CODEX_FACTORY_ONLY` | Only expose the factory wizard tool           | `false`          |

### Agent

| Env Var                    | Description                                           | Default       |
| -------------------------- | ----------------------------------------------------- | ------------- |
| `CODEX_MODEL`              | Model (`gpt-5-codex`, `o3`, `codex-1`, etc.)         | SDK default   |
| `CODEX_CWD`                | Working directory                                     | `process.cwd()` |
| `CODEX_SANDBOX_MODE`       | `read-only`, `workspace-write`, `danger-full-access`  | `read-only`   |
| `CODEX_APPROVAL_POLICY`    | `never`, `on-failure`, `on-request`, `untrusted`      | `on-failure`  |
| `CODEX_EFFORT`             | `minimal`, `low`, `medium`, `high`, `xhigh`           | SDK default   |
| `CODEX_ADDITIONAL_DIRS`    | Extra directories (comma-separated)                   | none          |
| `CODEX_NETWORK_ACCESS`     | Allow network from sandbox                            | `false`       |
| `CODEX_WEB_SEARCH`         | `disabled`, `cached`, `live`                          | `disabled`    |

### Instructions

| Env Var                      | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `CODEX_INSTRUCTIONS`         | Replaces the default instructions                        |
| `CODEX_APPEND_INSTRUCTIONS`  | Appended to the default (usually what you want)          |

### Advanced

| Env Var                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `CODEX_PERSIST_SESSION`| `true`/`false` — enable session resume (default: `true`) |

### Authentication

| Env Var         | Description                    | Default               |
| --------------- | ------------------------------ | --------------------- |
| `CODEX_API_KEY` | OpenAI API key for this agent  | inherited from parent |

## Security

- **Sandbox defaults to `read-only`** — the agent can't write files unless you explicitly set `workspace-write` or `danger-full-access`.
- **`cwd` overrides preserve agent knowledge** — when the host overrides `cwd`, the agent's configured base directory is automatically added to `additionalDirectories`.
- **Security overrides narrow, never widen** — per-invocation `sandboxMode` and `approvalPolicy` can only tighten (e.g., `workspace-write` → `read-only`), never loosen.
- **`_reply` tool respects persistence** — not registered when `CODEX_PERSIST_SESSION=false`.
- **API keys are redacted** — the factory wizard never exposes `CODEX_API_KEY` in generated configs.

## Architecture

```
┌─────────────────────────────────┐
│  MCP Client                     │
│  (Claude Desktop, Cursor, etc.) │
│                                 │
│  Sees: code_reviewer,           │
│        test_writer, quick_qa    │
└──────────┬──────────────────────┘
           │ JSON-RPC / stdio
┌──────────▼──────────────────────┐
│  Codex Octopus (per instance)   │
│                                 │
│  Env: CODEX_MODEL=o3            │
│       CODEX_SANDBOX_MODE=...    │
│       CODEX_APPEND_INSTRUCTIONS │
│                                 │
│  Calls: Codex SDK thread.run()  │
└──────────┬──────────────────────┘
           │ in-process
┌──────────▼──────────────────────┐
│  Codex SDK → Codex CLI          │
│  Runs autonomously: reads files,│
│  writes code, runs commands     │
│  Returns result + thread_id     │
└─────────────────────────────────┘
```

## Known Limitations

- **`minimal` effort + web_search**: OpenAI does not allow `web_search` tools with `minimal` reasoning effort. Use `low` or higher if web search is needed.

## Development

```bash
pnpm install
pnpm build       # compile TypeScript
pnpm test        # run tests (vitest)
pnpm test:coverage  # coverage report
```

## License

[ISC](https://github.com/xiaolai/codex-octopus/blob/main/LICENSE) - Xiaolai Li
