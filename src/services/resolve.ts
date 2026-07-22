// Turn workspace.json declarations into runnable specs. A declaration that
// says how to run (cmd/url) is used as-is; otherwise it is a *request* — like
// GitHub Actions `services:` — and the `service.<name>` hook, registered by
// whatever plugin or environment can supply it, fills in the rest.
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Record<string, any>> {
    const { services } = await ctx.fns.services.manifest({});
    const resolved: Record<string, any> = {};
    for (const [name, spec] of Object.entries(services)) {
        if (spec.cmd || spec.url) { resolved[name] = spec; continue; }
        const provider = spec.provider ?? name;
        const provided = await ctx.fns.hooks.first({ name: `service.${provider}`, opts: { name, spec } });
        if (!provided) throw new Error(`nothing provides service "${name}" (looked for hook service.${provider})`);
        resolved[name] = { ...provided, provider };
    }
    return resolved;
}
