export interface ThreadConfig {
  cwd?: string;
  model?: string;
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted";
  effort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  additionalDirectories?: string[];
  networkAccess?: boolean;
  webSearchMode?: "disabled" | "cached" | "live";
  persistSession?: boolean;
  instructions?: string;
  appendInstructions?: string;
}

export interface InvocationOverrides {
  cwd?: string;
  model?: string;
  sandboxMode?: string;
  approvalPolicy?: string;
  effort?: string;
  additionalDirs?: string[];
  networkAccess?: boolean;
  webSearchMode?: string;
  instructions?: string;
  resumeThreadId?: string;
}

export interface OptionCatalogEntry {
  key: string;
  envVar: string;
  label: string;
  hint: string;
  example: string;
}
