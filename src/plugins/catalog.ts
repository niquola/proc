// The platform catalogue: every plugin the machine has that this project has
// NOT asked for. Mounting one is a line in workspace.json, so this is the list
// the manager offers and the agent can read before proposing anything.
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const mounted = new Set((ctx.state.plugins ?? []).map(p => p.namespace));
    const out: Array<{ namespace: string; label: string; icon: string; description: string; skill: string | null; dir: string }> = [];
    for (const searchDir of await ctx.fns.project.pluginPaths({})) {
        for (const name of await readdir(searchDir).catch(() => [] as string[])) {
            const dir = resolve(searchDir, name);
            const manifest = await Bun.file(dir + "/atomic-workspace.json").json().catch(() => null);
            if (!manifest) continue;
            const namespace = manifest.namespace ?? name;
            if (mounted.has(namespace) || out.some(p => p.namespace === namespace)) continue;
            out.push({ ...await ctx.fns.plugins.describe({ dir, namespace, manifest }), namespace, dir });
        }
    }
    return out;
}
