// Run each module's $start.ts in order (package.json proc.start). A $start gets
// (ctx, config) and may RETURN a state object — merged into ctx.state.<module>
// (and handed back to $stop). Idempotent (a started module is skipped). On
// failure, already-started modules are stopped (rollback) and the error rethrows.
//   ctx.fns.lifecycle.start({})
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const order: string[] = await ctx.fns.lifecycle.order({});
    const entries = await ctx.fns.project.scan({});
    const life = (ctx.state.lifecycle ??= { started: [] });

    for (const mod of order) {
        if (life.started.includes(mod)) continue;
        const e = entries.find((x: any) => x.kind === "lifecycle" && x.hook === "start" && x.moduleDir === mod);
        if (!e) continue; // module has no $start — nothing to init
        try {
            const fn = (await import((e as any).abs + `?t=${Date.now()}`)).default;
            const config = await ctx.fns.lifecycle.config({ module: mod });
            const state = await fn(ctx, null, config);
            if (state && typeof state === "object") Object.assign((ctx.state[mod] ??= {}), state);
            life.started.push(mod);
            console.log(`[lifecycle] started ${mod}`);
        } catch (err: any) {
            console.error(`[lifecycle] ${mod} failed to start: ${err?.message ?? err}`);
            await ctx.fns.lifecycle.stop({}); // rollback what started
            throw err;
        }
    }
    return { started: [...life.started] };
}
