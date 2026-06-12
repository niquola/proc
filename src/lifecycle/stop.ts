// Run each started module's $stop.ts in REVERSE order. $stop gets
// (ctx, state) — the state its $start returned (ctx.state.<module>) — to tear
// down (close connections, stop the server). Errors are logged, not fatal.
//   ctx.fns.lifecycle.stop({})
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const started: string[] = ctx.state.lifecycle?.started ?? [];
    const entries = await ctx.fns.project.scan({});
    const stopped: string[] = [];

    for (const mod of [...started].reverse()) {
        const e = entries.find((x: any) => x.kind === "lifecycle" && x.hook === "stop" && x.moduleDir === mod);
        if (!e) continue;
        try {
            const fn = (await import((e as any).abs + `?t=${Date.now()}`)).default;
            await fn(ctx, null, ctx.state[mod]);
            stopped.push(mod);
            console.log(`[lifecycle] stopped ${mod}`);
        } catch (err: any) {
            console.error(`[lifecycle] ${mod} failed to stop: ${err?.message ?? err}`);
        }
    }
    ctx.state.lifecycle = { started: [] };
    return { stopped };
}
