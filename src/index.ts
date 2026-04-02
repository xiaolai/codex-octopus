#!/usr/bin/env node

/**
 * Codex Octopus — one brain, many arms.
 *
 * Wraps the OpenAI Codex SDK as MCP servers, letting you spawn multiple
 * specialized Codex agents — each with its own model, sandbox, effort,
 * and personality.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { envStr, envBool, sanitizeToolName } from "./lib.js";
import { buildBaseConfig } from "./config.js";
import { registerQueryTools } from "./tools/query.js";
import { registerFactoryTool } from "./tools/factory.js";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json");

// ── Configuration ──────────────────────────────────────────────────

const BASE_CONFIG = buildBaseConfig();
const API_KEY = envStr("CODEX_API_KEY");

const TOOL_NAME = sanitizeToolName(envStr("CODEX_TOOL_NAME") || "codex");
const REPLY_TOOL_NAME = `${TOOL_NAME}_reply`;
const SERVER_NAME = envStr("CODEX_SERVER_NAME") || "codex-octopus";
const FACTORY_ONLY = envBool("CODEX_FACTORY_ONLY", false);

const DEFAULT_DESCRIPTION = [
  "Send a task to an autonomous Codex agent.",
  "It reads/writes files, runs shell commands, searches codebases,",
  "and handles complex software engineering tasks end-to-end.",
  `Returns the result text plus a thread_id for follow-ups via ${REPLY_TOOL_NAME}.`,
].join(" ");

const TOOL_DESCRIPTION = envStr("CODEX_DESCRIPTION") || DEFAULT_DESCRIPTION;

// ── Server ─────────────────────────────────────────────────────────

const server = new McpServer({ name: SERVER_NAME, version: PKG_VERSION });

if (!FACTORY_ONLY) {
  registerQueryTools(server, BASE_CONFIG, TOOL_NAME, TOOL_DESCRIPTION, API_KEY);
}

if (FACTORY_ONLY) {
  registerFactoryTool(server);
}

// ── Start ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const toolList = FACTORY_ONLY
    ? ["create_codex_mcp"]
    : BASE_CONFIG.persistSession !== false
      ? [TOOL_NAME, REPLY_TOOL_NAME]
      : [TOOL_NAME];
  console.error(`${SERVER_NAME}: running on stdio (tools: ${toolList.join(", ")})`);
}

main().catch((error) => {
  console.error(`${SERVER_NAME}: fatal:`, error);
  process.exit(1);
});
