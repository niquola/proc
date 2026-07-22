// Wait until a service is ready. The probing itself belongs to probeReady —
// this only watches `ready` on the record, so a dependent in start.ts and a
// human in the REPL wait on exactly the same signal, and N dependents of one
// service cost N polls of a boolean rather than N probes.
//
// The timeout bounds the *waiting*, never the probe: a service that turns green
// at 65 s is still noticed and still goes green, the dependent just stopped
// waiting at 60 and started anyway. A crashed service is not worth waiting for
// either — it has already given up, so we return instead of burning the clock.
//
// The record is re-read every tick: track.ts may refresh it, and a stop/start
// while we wait must be seen, not remembered.
export default async function (ctx: Context, _session: Session | null, opts: { name: string; timeout?: number }): Promise<boolean> {
    const spec = ctx.state.services?.[opts.name]?.spec;
    if (!spec) return false;

    const period = (spec.ready.period ?? 0.5) * 1000;
    const deadline = Date.now() + (opts.timeout ?? spec.ready.timeout ?? 60) * 1000;
    while (true) {
        const record = ctx.state.services?.[opts.name];
        if (!record || record.state === "crashed") return false;
        if (record.ready) return true;
        const left = deadline - Date.now();
        if (left <= 0) return false;
        await Bun.sleep(Math.min(period, left));
    }
}
