import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { resolve } from "node:path";
import { Codex } from "@openai/codex-sdk";
import type { ThreadConfig, InvocationOverrides } from "../types.js";
import {
  narrowSandboxMode,
  narrowApprovalPolicy,
  formatErrorMessage,
} from "../lib.js";

interface RunResult {
  threadId: string;
  response: string;
  usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number };
  isError: boolean;
}

async function runQuery(
  prompt: string,
  overrides: InvocationOverrides,
  baseConfig: ThreadConfig,
  apiKey?: string
): Promise<RunResult> {
  const codex = new Codex({
    ...(apiKey ? { apiKey } : {}),
  });

  const threadOptions: Record<string, unknown> = {};

  // Model
  const model = overrides.model || baseConfig.model;
  if (model) threadOptions.model = model;

  // Working directory — accept any path, preserve agent's base access
  let cwd = baseConfig.cwd || process.cwd();
  if (overrides.cwd) {
    const resolvedCwd = resolve(cwd, overrides.cwd);
    if (resolvedCwd !== cwd) {
      const dirs = new Set(baseConfig.additionalDirectories || []);
      dirs.add(cwd);
      threadOptions.additionalDirectories = [...dirs];
      cwd = resolvedCwd;
    }
  }
  threadOptions.workingDirectory = cwd;

  // Per-invocation additionalDirs — unions with server-level + auto-added dirs
  if (overrides.additionalDirs?.length) {
    const existing = (threadOptions.additionalDirectories as string[]) || baseConfig.additionalDirectories || [];
    const dirs = new Set(existing);
    for (const dir of overrides.additionalDirs) {
      dirs.add(dir);
    }
    threadOptions.additionalDirectories = [...dirs];
  } else if (baseConfig.additionalDirectories && !threadOptions.additionalDirectories) {
    threadOptions.additionalDirectories = baseConfig.additionalDirectories;
  }

  // Sandbox mode — can only tighten
  const baseSandbox = baseConfig.sandboxMode || "read-only";
  if (overrides.sandboxMode) {
    threadOptions.sandboxMode = narrowSandboxMode(baseSandbox, overrides.sandboxMode);
  } else {
    threadOptions.sandboxMode = baseSandbox;
  }

  // Approval policy — can only tighten
  const baseApproval = baseConfig.approvalPolicy || "on-failure";
  if (overrides.approvalPolicy) {
    threadOptions.approvalPolicy = narrowApprovalPolicy(baseApproval, overrides.approvalPolicy);
  } else {
    threadOptions.approvalPolicy = baseApproval;
  }

  // Effort
  const effort = overrides.effort || baseConfig.effort;
  if (effort) threadOptions.modelReasoningEffort = effort;

  // Network access
  if (overrides.networkAccess !== undefined) {
    threadOptions.networkAccessEnabled = overrides.networkAccess;
  } else if (baseConfig.networkAccess !== undefined) {
    threadOptions.networkAccessEnabled = baseConfig.networkAccess;
  }

  // Web search
  const webSearch = overrides.webSearchMode || baseConfig.webSearchMode;
  if (webSearch) threadOptions.webSearchMode = webSearch;

  // Start or resume thread
  const thread = overrides.resumeThreadId
    ? codex.resumeThread(overrides.resumeThreadId, threadOptions)
    : codex.startThread(threadOptions);

  // Build prompt with instructions
  let fullPrompt = prompt;
  if (!overrides.resumeThreadId) {
    const instructions = overrides.instructions || baseConfig.instructions;
    const appendInstructions = baseConfig.appendInstructions;
    if (instructions) {
      fullPrompt = `${instructions}\n\n${prompt}`;
    } else if (appendInstructions) {
      fullPrompt = `${appendInstructions}\n\n${prompt}`;
    }
  }

  const turn = await thread.run(fullPrompt);

  return {
    threadId: thread.id || "",
    response: turn.finalResponse || "",
    usage: turn.usage || { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
    isError: false,
  };
}

function formatResult(result: RunResult) {
  const payload = {
    thread_id: result.threadId,
    result: result.response,
    usage: result.usage,
    is_error: result.isError,
  };
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
    isError: result.isError,
  };
}

function formatError(error: unknown) {
  return {
    content: [
      { type: "text" as const, text: `Error: ${formatErrorMessage(error)}` },
    ],
    isError: true,
  };
}

export function registerQueryTools(
  server: McpServer,
  baseConfig: ThreadConfig,
  toolName: string,
  toolDescription: string,
  apiKey?: string
) {
  const replyToolName = `${toolName}_reply`;

  server.registerTool(toolName, {
    description: toolDescription,
    inputSchema: z.object({
      prompt: z.string().describe("Task or question for Codex"),
      cwd: z.string().optional().describe("Working directory (overrides CODEX_CWD)"),
      model: z.string().optional().describe('Model override (e.g. "gpt-5-codex", "o3", "codex-1")'),
      additionalDirs: z.array(z.string()).optional().describe("Extra directories the agent can access for this invocation"),
      effort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional().describe("Reasoning effort override"),
      sandboxMode: z.enum(["read-only", "workspace-write"]).optional().describe("Sandbox mode override (can only tighten, never loosen)"),
      approvalPolicy: z.enum(["on-failure", "on-request", "untrusted"]).optional().describe("Approval policy override (can only tighten, never loosen)"),
      networkAccess: z.boolean().optional().describe("Enable network access from sandbox"),
      webSearchMode: z.enum(["disabled", "cached", "live"]).optional().describe("Web search mode"),
      instructions: z.string().optional().describe("Additional instructions (prepended to prompt)"),
    }),
  }, async ({ prompt, cwd, model, additionalDirs, effort, sandboxMode, approvalPolicy, networkAccess, webSearchMode, instructions }) => {
    try {
      const result = await runQuery(prompt, {
        cwd, model, additionalDirs, effort, sandboxMode, approvalPolicy, networkAccess, webSearchMode, instructions,
      }, baseConfig, apiKey);
      return formatResult(result);
    } catch (error) {
      return formatError(error);
    }
  });

  if (baseConfig.persistSession !== false) {
    server.registerTool(replyToolName, {
      description: [
        `Continue a previous ${toolName} conversation by thread ID.`,
        "Use this for follow-up questions, iterative refinement,",
        "or multi-step workflows that build on prior context.",
      ].join(" "),
      inputSchema: z.object({
        thread_id: z.string().describe(`Thread ID from a prior ${toolName} response`),
        prompt: z.string().describe("Follow-up instruction or question"),
        cwd: z.string().optional().describe("Working directory override"),
        model: z.string().optional().describe("Model override"),
      }),
    }, async ({ thread_id, prompt, cwd, model }) => {
      try {
        const result = await runQuery(prompt, {
          cwd, model, resumeThreadId: thread_id,
        }, baseConfig, apiKey);
        return formatResult(result);
      } catch (error) {
        return formatError(error);
      }
    });
  }
}
