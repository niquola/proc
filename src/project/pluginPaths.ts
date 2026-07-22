import { resolve } from "node:path";
import { realpath } from "node:fs/promises";
// Bootstrap path: roots/scan run before the registry exists, so these are
// imported directly rather than called through ctx.fns.
import projectRoot from "./projectRoot";
import { expandHome } from "./workdir";

// Directories searched for plugins — each subdirectory holding an
// atomic-workspace.json is mounted. PLUGIN_PATHS (colon-separated) replaces
// the defaults: the project's own plugins/ plus every place skills live.
const DEFAULTS = ["./plugins", "~/.claude/skills", "~/.agent/skills", "~/.codex/skills", ".claude/skills", ".agents/skills"];

export default async function (ctx: Context, session: Session | null, _opts?: {}): Promise<string[]> {
    const root = projectRoot(ctx, session, {});
    const paths = ctx.env.PLUGIN_PATHS ? ctx.env.PLUGIN_PATHS.split(":").filter(Boolean) : DEFAULTS;
    const out: string[] = [];
    for (const path of paths) {
        // realpath collapses the symlinks the agent homes point at each other
        // with, so the same directory is not scanned (and mounted) twice.
        const dir = await realpath(resolve(root, expandHome(path))).catch(() => null);
        if (!dir || out.includes(dir)) continue;
        if (await Bun.file(dir).stat().then(s => s.isDirectory()).catch(() => false)) out.push(dir);
    }
    return out;
}
