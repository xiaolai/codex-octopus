import type { ThreadConfig } from "./types.js";
import {
  envStr,
  envList,
  envBool,
  validateSandboxMode,
  validateApprovalPolicy,
  validateEffort,
} from "./lib.js";

export function buildBaseConfig(): ThreadConfig {
  const config: ThreadConfig = {
    cwd: envStr("CODEX_CWD") || process.cwd(),
    persistSession: envBool("CODEX_PERSIST_SESSION", true),
  };

  const model = envStr("CODEX_MODEL");
  if (model) config.model = model;

  const rawSandbox = envStr("CODEX_SANDBOX_MODE") || "read-only";
  const sandbox = validateSandboxMode(rawSandbox);
  if (rawSandbox !== sandbox) {
    console.error(
      `codex-octopus: invalid CODEX_SANDBOX_MODE "${rawSandbox}", using "read-only"`
    );
  }
  config.sandboxMode = sandbox as ThreadConfig["sandboxMode"];

  const rawApproval = envStr("CODEX_APPROVAL_POLICY") || "on-failure";
  const approval = validateApprovalPolicy(rawApproval);
  if (rawApproval !== approval) {
    console.error(
      `codex-octopus: invalid CODEX_APPROVAL_POLICY "${rawApproval}", using "on-failure"`
    );
  }
  config.approvalPolicy = approval as ThreadConfig["approvalPolicy"];

  const effort = envStr("CODEX_EFFORT");
  if (effort) {
    const validated = validateEffort(effort);
    if (effort !== validated) {
      console.error(
        `codex-octopus: invalid CODEX_EFFORT "${effort}", using "medium"`
      );
    }
    config.effort = validated as ThreadConfig["effort"];
  }

  const dirs = envList("CODEX_ADDITIONAL_DIRS");
  if (dirs) config.additionalDirectories = dirs;

  const networkAccess = envStr("CODEX_NETWORK_ACCESS");
  if (networkAccess !== undefined) {
    config.networkAccess = networkAccess === "true" || networkAccess === "1";
  }

  const webSearch = envStr("CODEX_WEB_SEARCH");
  if (webSearch) config.webSearchMode = webSearch as ThreadConfig["webSearchMode"];

  const instructions = envStr("CODEX_INSTRUCTIONS");
  if (instructions) config.instructions = instructions;

  const appendInstructions = envStr("CODEX_APPEND_INSTRUCTIONS");
  if (appendInstructions) config.appendInstructions = appendInstructions;

  return config;
}
