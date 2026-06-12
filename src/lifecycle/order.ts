// The module start order: package.json `proc.start` if set (explicit, ordered),
// otherwise every module that has a $start.ts, with "http" last (so the server
// only accepts traffic after everything else has initialized). Plugins are
// modules too — list their namespace to start their lifecycle.
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string[]> {
    const projectRoot = resolve(import.meta.dir, "..", "..");
    let declared: string[] | undefined;
    try {
        declared = JSON.parse(await Bun.file(projectRoot + "/package.json").text()).proc?.start;
    } catch { /* no package.json */ }
    if (Array.isArray(declared)) return declared;

    const entries = await ctx.fns.project.scan({});
    const mods = [...new Set(entries
        .filter((e: any) => e.kind === "lifecycle" && e.hook === "start")
        .map((e: any) => e.moduleDir))];
    return mods.sort((a, b) => (a === "http" ? 1 : 0) - (b === "http" ? 1 : 0));
}
