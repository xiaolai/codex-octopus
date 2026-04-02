import { describe, it, expect } from "vitest";
import {
  envStr,
  envList,
  envNum,
  envBool,
  sanitizeToolName,
  MAX_TOOL_NAME_LEN,
  isDescendantPath,
  validateSandboxMode,
  narrowSandboxMode,
  VALID_SANDBOX_MODES,
  validateApprovalPolicy,
  narrowApprovalPolicy,
  VALID_APPROVAL_POLICIES,
  validateEffort,
  VALID_EFFORTS,
  deriveServerName,
  deriveToolName,
  serializeArrayEnv,
  formatErrorMessage,
} from "./lib.js";

// ── envStr ────────────────────────────────────────────────────────

describe("envStr", () => {
  it("returns the value when set", () => {
    expect(envStr("FOO", { FOO: "bar" })).toBe("bar");
  });

  it("returns undefined for missing keys", () => {
    expect(envStr("MISSING", {})).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(envStr("EMPTY", { EMPTY: "" })).toBeUndefined();
  });
});

// ── envList ───────────────────────────────────────────────────────

describe("envList", () => {
  it("splits comma-separated values", () => {
    expect(envList("X", { X: "a,b,c" })).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace", () => {
    expect(envList("X", { X: " a , b " })).toEqual(["a", "b"]);
  });

  it("parses JSON arrays", () => {
    expect(envList("X", { X: '["a,b","c"]' })).toEqual(["a,b", "c"]);
  });

  it("returns undefined for missing keys", () => {
    expect(envList("MISSING", {})).toBeUndefined();
  });

  it("falls back to comma-split on bad JSON", () => {
    expect(envList("X", { X: "[bad" })).toEqual(["[bad"]);
  });

  it("filters empty strings", () => {
    expect(envList("X", { X: "a,,b," })).toEqual(["a", "b"]);
  });
});

// ── envNum ────────────────────────────────────────────────────────

describe("envNum", () => {
  it("parses valid numbers", () => {
    expect(envNum("X", { X: "42" })).toBe(42);
    expect(envNum("X", { X: "3.14" })).toBeCloseTo(3.14);
  });

  it("returns undefined for missing keys", () => {
    expect(envNum("MISSING", {})).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(envNum("X", { X: "abc" })).toBeUndefined();
  });
});

// ── envBool ───────────────────────────────────────────────────────

describe("envBool", () => {
  it("returns true for 'true' and '1'", () => {
    expect(envBool("X", false, { X: "true" })).toBe(true);
    expect(envBool("X", false, { X: "1" })).toBe(true);
  });

  it("returns false for other values", () => {
    expect(envBool("X", true, { X: "false" })).toBe(false);
    expect(envBool("X", true, { X: "0" })).toBe(false);
  });

  it("returns fallback when missing", () => {
    expect(envBool("MISSING", true, {})).toBe(true);
    expect(envBool("MISSING", false, {})).toBe(false);
  });
});

// ── sanitizeToolName ──────────────────────────────────────────────

describe("sanitizeToolName", () => {
  it("passes through valid names", () => {
    expect(sanitizeToolName("my_tool")).toBe("my_tool");
  });

  it("replaces invalid characters with underscore", () => {
    expect(sanitizeToolName("my-tool.v2")).toBe("my_tool_v2");
  });

  it("truncates to MAX_TOOL_NAME_LEN", () => {
    const long = "a".repeat(100);
    expect(sanitizeToolName(long).length).toBe(MAX_TOOL_NAME_LEN);
  });

  it("falls back to 'codex' for empty result", () => {
    expect(sanitizeToolName("")).toBe("codex");
  });
});

// ── isDescendantPath ──────────────────────────────────────────────

describe("isDescendantPath", () => {
  it("accepts subdirectories", () => {
    expect(isDescendantPath("subdir", "/srv/app")).toBe(true);
    expect(isDescendantPath("a/b/c", "/srv/app")).toBe(true);
  });

  it("accepts same directory", () => {
    expect(isDescendantPath(".", "/srv/app")).toBe(true);
    expect(isDescendantPath("/srv/app", "/srv/app")).toBe(true);
  });

  it("rejects parent traversal", () => {
    expect(isDescendantPath("..", "/srv/app")).toBe(false);
    expect(isDescendantPath("../other", "/srv/app")).toBe(false);
  });

  it("rejects sibling paths", () => {
    expect(isDescendantPath("/srv/other", "/srv/app")).toBe(false);
  });

  it("rejects prefix attacks", () => {
    expect(isDescendantPath("/srv/app-escape", "/srv/app")).toBe(false);
  });
});

// ── validateSandboxMode ───────────────────────────────────────────

describe("validateSandboxMode", () => {
  it("passes valid modes through", () => {
    for (const mode of VALID_SANDBOX_MODES) {
      expect(validateSandboxMode(mode)).toBe(mode);
    }
  });

  it("falls back to read-only for invalid modes", () => {
    expect(validateSandboxMode("garbage")).toBe("read-only");
    expect(validateSandboxMode("")).toBe("read-only");
  });
});

// ── narrowSandboxMode ─────────────────────────────────────────────

describe("narrowSandboxMode", () => {
  it("allows tightening from danger-full-access", () => {
    expect(narrowSandboxMode("danger-full-access", "workspace-write")).toBe("workspace-write");
    expect(narrowSandboxMode("danger-full-access", "read-only")).toBe("read-only");
  });

  it("allows tightening from workspace-write", () => {
    expect(narrowSandboxMode("workspace-write", "read-only")).toBe("read-only");
  });

  it("rejects loosening", () => {
    expect(narrowSandboxMode("read-only", "danger-full-access")).toBe("read-only");
    expect(narrowSandboxMode("read-only", "workspace-write")).toBe("read-only");
    expect(narrowSandboxMode("workspace-write", "danger-full-access")).toBe("workspace-write");
  });

  it("same mode returns same mode", () => {
    expect(narrowSandboxMode("read-only", "read-only")).toBe("read-only");
  });

  it("invalid override returns base", () => {
    expect(narrowSandboxMode("workspace-write", "garbage")).toBe("workspace-write");
  });
});

// ── validateApprovalPolicy ────────────────────────────────────────

describe("validateApprovalPolicy", () => {
  it("passes valid policies through", () => {
    for (const policy of VALID_APPROVAL_POLICIES) {
      expect(validateApprovalPolicy(policy)).toBe(policy);
    }
  });

  it("falls back to on-failure for invalid policies", () => {
    expect(validateApprovalPolicy("garbage")).toBe("on-failure");
    expect(validateApprovalPolicy("")).toBe("on-failure");
  });
});

// ── narrowApprovalPolicy ──────────────────────────────────────────

describe("narrowApprovalPolicy", () => {
  it("allows tightening from never", () => {
    expect(narrowApprovalPolicy("never", "on-failure")).toBe("on-failure");
    expect(narrowApprovalPolicy("never", "on-request")).toBe("on-request");
    expect(narrowApprovalPolicy("never", "untrusted")).toBe("untrusted");
  });

  it("rejects loosening", () => {
    expect(narrowApprovalPolicy("untrusted", "never")).toBe("untrusted");
    expect(narrowApprovalPolicy("on-request", "never")).toBe("on-request");
    expect(narrowApprovalPolicy("on-failure", "never")).toBe("on-failure");
  });

  it("same policy returns same", () => {
    expect(narrowApprovalPolicy("never", "never")).toBe("never");
    expect(narrowApprovalPolicy("untrusted", "untrusted")).toBe("untrusted");
  });

  it("invalid override returns base", () => {
    expect(narrowApprovalPolicy("on-failure", "garbage")).toBe("on-failure");
  });
});

// ── validateEffort ────────────────────────────────────────────────

describe("validateEffort", () => {
  it("passes valid efforts through", () => {
    for (const effort of VALID_EFFORTS) {
      expect(validateEffort(effort)).toBe(effort);
    }
  });

  it("falls back to medium for invalid", () => {
    expect(validateEffort("garbage")).toBe("medium");
    expect(validateEffort("")).toBe("medium");
  });
});

// ── deriveServerName ──────────────────────────────────────────────

describe("deriveServerName", () => {
  it("slugifies descriptions", () => {
    expect(deriveServerName("A strict code reviewer")).toBe("a-strict-code-reviewer");
  });

  it("limits length to 30 chars", () => {
    const long = "This is a very long description that should be truncated";
    expect(deriveServerName(long).length).toBeLessThanOrEqual(30);
  });

  it("falls back for empty input", () => {
    expect(deriveServerName("!!!")).toMatch(/^agent-\d+$/);
  });
});

// ── deriveToolName ────────────────────────────────────────────────

describe("deriveToolName", () => {
  it("converts dashes to underscores", () => {
    expect(deriveToolName("code-reviewer")).toBe("code_reviewer");
  });

  it("falls back for empty result", () => {
    expect(deriveToolName("---")).toBe("agent");
  });
});

// ── serializeArrayEnv ─────────────────────────────────────────────

describe("serializeArrayEnv", () => {
  it("joins with comma when no commas in values", () => {
    expect(serializeArrayEnv(["a", "b"])).toBe("a,b");
  });

  it("uses JSON when values contain commas", () => {
    expect(serializeArrayEnv(["a,b", "c"])).toBe('["a,b","c"]');
  });
});

// ── formatErrorMessage ────────────────────────────────────────────

describe("formatErrorMessage", () => {
  it("extracts message from Error", () => {
    expect(formatErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(formatErrorMessage("oops")).toBe("oops");
    expect(formatErrorMessage(42)).toBe("42");
  });
});
