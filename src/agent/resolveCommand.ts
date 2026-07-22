// The argv to spawn for an agent id. Paths are resolved against projectRoot —
// process.cwd() is whatever directory the workspace happened to be launched
// from, so node_modules goes missing as soon as the two differ.
import { join } from "node:path";

export default function (ctx: Context, _session: Session | null, opts?: { id?: "claude" | "codex" }): string[] {
    const config = ctx.fns.config.resolve({ module: "agent" }) as ConfigOf<typeof import("./$config").default>;
    if (config.cmd.length) return [...config.cmd];

    const root = ctx.fns.project.projectRoot({});
    const id = opts?.id ?? config.id;
    if (id === "codex") {
        // The codex binary ships as a per-platform package.
        const pkg = `codex-acp-${process.platform}-${process.arch}`;
        const bin = process.platform === "win32" ? "codex-acp.exe" : "codex-acp";
        return [join(root, "node_modules", "@zed-industries", pkg, "bin", bin)];
    }
    return ["bun", join(root, "node_modules", "@agentclientprotocol", "claude-agent-acp", "dist", "index.js")];
}
