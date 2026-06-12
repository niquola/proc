// A module's config, passed to its $start. From package.json proc.config.<module>,
// merged over env vars of the form <MODULE>__<KEY> (so e.g. db can read its url
// from DB__URL). Priority: package.json proc.config < explicit env vars.
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { module: string }): Promise<Record<string, any>> {
    const projectRoot = resolve(import.meta.dir, "..", "..");
    let fromPkg: Record<string, any> = {};
    try {
        fromPkg = JSON.parse(await Bun.file(projectRoot + "/package.json").text()).proc?.config?.[opts.module] ?? {};
    } catch { /* none */ }

    const prefix = opts.module.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_") + "__";
    const fromEnv: Record<string, any> = {};
    for (const [k, v] of Object.entries(ctx.env)) {
        if (k.startsWith(prefix)) fromEnv[k.slice(prefix.length).toLowerCase()] = v;
    }
    return { ...fromPkg, ...fromEnv };
}
