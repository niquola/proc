// Resolve a module's config: defaults < package.json proc.prod.<module> < env.
// ENV ENTERS THROUGH CONFIG — a module reads ctx.fns.config.resolve, never
// ctx.env directly. Each param's env var is schema.env or <MODULE>__<KEY>.
// Coerced + validated; invalid config throws (so a bad $start fails loudly).
// Sync (readFileSync) so db.url() and friends stay synchronous.
import { readFileSync } from "node:fs";

const envify = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "_");

export default function (ctx: Context, _session: Session | null, opts: { module: string; schema?: ConfigSchema }) {
    const mod = opts.module;
    // Schema comes from ctx.state.configSchemas (collected from module/$config.ts
    // at boot), so a module reads its config without importing anything.
    const schema = opts.schema ?? ctx.state.configSchemas?.[mod];
    if (!schema) throw new Error(`config "${mod}": no schema — add ${mod}/$config.ts`);

    let fromPkg: Record<string, any> = {};
    try {
        const pkg = JSON.parse(readFileSync(ctx.fns.project.projectRoot({}) + "/package.json", "utf8"));
        fromPkg = pkg.proc?.prod?.[mod] ?? pkg.proc?.config?.[mod] ?? {};
    } catch { /* no package.json (e.g. prod bundle) → env-only */ }

    const fromEnv: Record<string, any> = {};
    for (const [k, s] of Object.entries(schema)) {
        const name = s.env ?? `${envify(mod)}__${envify(k)}`;
        if (ctx.env[name] !== undefined) fromEnv[k] = ctx.env[name];
    }

    const merged = { ...fromPkg, ...fromEnv }; // env wins over package.json
    const coerced = ctx.fns.config.coerce({ schema, config: merged });
    const errors = ctx.fns.config.validate({ schema, config: coerced });
    if (errors.length) throw new Error(`config "${mod}": ${errors.join("; ")}`);
    return coerced;
}
