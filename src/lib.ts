/**
 * Pure, testable logic extracted from index.ts.
 */

import { normalize, resolve, sep } from "node:path";

// ── Env helpers ────────────────────────────────────────────────────

export function envStr(
  key: string,
  env: Record<string, string | undefined> = process.env
): string | undefined {
  return env[key] || undefined;
}

export function envList(
  key: string,
  env: Record<string, string | undefined> = process.env
): string[] | undefined {
  const val = env[key];
  if (!val) return undefined;
  if (val.startsWith("[")) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // fall through to comma-split
    }
  }
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function envNum(
  key: string,
  env: Record<string, string | undefined> = process.env
): number | undefined {
  const val = env[key];
  if (!val) return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

export function envBool(
  key: string,
  fallback: boolean,
  env: Record<string, string | undefined> = process.env
): boolean {
  const val = env[key];
  if (val === undefined) return fallback;
  return val === "true" || val === "1";
}

// ── Tool name sanitization ─────────────────────────────────────────

export const MAX_TOOL_NAME_LEN = 64 - "_reply".length;

export function sanitizeToolName(raw: string): string {
  const sanitized = raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, MAX_TOOL_NAME_LEN);
  return sanitized || "codex";
}

// ── cwd security check ────────────────────────────────────────────

export function isDescendantPath(
  requested: string,
  baseCwd: string
): boolean {
  const normalBase = normalize(baseCwd);
  const normalReq = normalize(resolve(normalBase, requested));
  if (normalReq === normalBase) return true;
  const baseWithSep = normalBase.endsWith(sep)
    ? normalBase
    : normalBase + sep;
  return normalReq.startsWith(baseWithSep);
}

// ── Sandbox mode validation ───────────────────────────────────────

export const VALID_SANDBOX_MODES = new Set([
  "read-only",
  "workspace-write",
  "danger-full-access",
]);

export function validateSandboxMode(mode: string): string {
  return VALID_SANDBOX_MODES.has(mode) ? mode : "read-only";
}

// Strictness order: most permissive → most restrictive
const SANDBOX_STRICTNESS: Record<string, number> = {
  "danger-full-access": 0,
  "workspace-write": 1,
  "read-only": 2,
};

/**
 * Narrow sandbox mode: returns the stricter of base and override.
 * Callers can tighten but never loosen.
 */
export function narrowSandboxMode(base: string, override: string): string {
  if (!VALID_SANDBOX_MODES.has(override)) return base;
  const baseLevel = SANDBOX_STRICTNESS[base] ?? 2;
  const overrideLevel = SANDBOX_STRICTNESS[override] ?? 2;
  return overrideLevel >= baseLevel ? override : base;
}

// ── Approval policy validation ────────────────────────────────────

export const VALID_APPROVAL_POLICIES = new Set([
  "never",
  "on-request",
  "on-failure",
  "untrusted",
]);

export function validateApprovalPolicy(policy: string): string {
  return VALID_APPROVAL_POLICIES.has(policy) ? policy : "on-failure";
}

const APPROVAL_STRICTNESS: Record<string, number> = {
  never: 0,
  "on-failure": 1,
  "on-request": 2,
  untrusted: 3,
};

/**
 * Narrow approval policy: returns the stricter of base and override.
 * Callers can tighten but never loosen.
 */
export function narrowApprovalPolicy(base: string, override: string): string {
  if (!VALID_APPROVAL_POLICIES.has(override)) return base;
  const baseLevel = APPROVAL_STRICTNESS[base] ?? 1;
  const overrideLevel = APPROVAL_STRICTNESS[override] ?? 1;
  return overrideLevel >= baseLevel ? override : base;
}

// ── Effort validation ─────────────────────────────────────────────

export const VALID_EFFORTS = new Set([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export function validateEffort(effort: string): string {
  return VALID_EFFORTS.has(effort) ? effort : "medium";
}

// ── Factory name derivation ────────────────────────────────────────

export function deriveServerName(description: string): string {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return slug || `agent-${Date.now()}`;
}

export function deriveToolName(name: string): string {
  const slug = name
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_TOOL_NAME_LEN);
  return slug || "agent";
}

// ── Factory env serialization ──────────────────────────────────────

export function serializeArrayEnv(val: unknown[]): string {
  const hasComma = val.some((v) => String(v).includes(","));
  return hasComma ? JSON.stringify(val) : val.join(",");
}

// ── Formatters ─────────────────────────────────────────────────────

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
