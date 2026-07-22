// agent module config. ENV enters through here: AGENT / CLAUDE_CONFIG_DIR /
// CODEX_HOME. wmlet required all of these to be set in the environment; here
// they are optional with sane defaults so a bare checkout starts.
import { homedir } from "node:os";
import { join } from "node:path";

export default {
    id: { type: "string", required: true, default: "claude", env: "AGENT", validator: (v: any) => v === "claude" || v === "codex" },
    // Explicit argv override — empty means resolveCommand derives it from id.
    cmd: { type: "string[]", default: [] },
    claudeConfigDir: { type: "string", required: true, default: join(homedir(), ".claude"), env: "CLAUDE_CONFIG_DIR" },
    codexHome: { type: "string", required: true, default: join(homedir(), ".codex"), env: "CODEX_HOME" },
    initTimeoutMs: { type: "integer", required: true, default: 30000 },
    closeTimeoutMs: { type: "integer", required: true, default: 10000 },
    stderrLines: { type: "integer", required: true, default: 200 },
} as const satisfies ConfigSchema;
