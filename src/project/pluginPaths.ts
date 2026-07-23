import { resolve } from "node:path";
import { realpath } from "node:fs/promises";
// Bootstrap path: roots/scan run before the registry exists, so these are
// imported directly rather than called through ctx.fns.
import projectRoot from "./projectRoot";
import workdir, { expandHome } from "./workdir";

// Directories searched for plugins — each subdirectory holding an
// atomic-workspace.json is mounted. PLUGIN_PATHS (colon-separated) replaces
// the defaults.
//
// A plugin IS a skill directory: the project keeps its own in
// WORKDIR/.claude/skills, where the coding agent finds them as skills by itself
// and the workspace finds them as plugins by their manifest. "./…" resolves
// against the workspace's own repo, a bare relative path against the project.
//
const DEFAULTS = ["./plugins", ".claude/skills", ".agents/skills", "~/.claude/skills", "~/.agent/skills", "~/.codex/skills"];

export default async function (ctx: Context, session: Session | null, _opts?: {}): Promise<string[]> {
    const root = projectRoot(ctx, session, {});
    const project = workdir(ctx, session, {});
    const paths = ctx.env.PLUGIN_PATHS ? ctx.env.PLUGIN_PATHS.split(":").filter(Boolean) : DEFAULTS;
    const out: string[] = [];
    for (const path of paths) {
        // realpath collapses the symlinks the agent homes point at each other
        // with, so the same directory is not scanned (and mounted) twice.
        const base = path.startsWith("./") || path.startsWith("../") ? root : project;
        const dir = await realpath(resolve(base, expandHome(path))).catch(() => null);
        if (!dir || out.includes(dir)) continue;
        if (await Bun.file(dir).stat().then(s => s.isDirectory()).catch(() => false)) out.push(dir);
    }
    return out;
}
