// Reconcile ctx.state.services with workspace.json: a record for every declared
// service, the freshest spec on each, ports and addresses filled in from the
// shared environment — and the records of services that left the manifest
// dropped, unless one of them is still running (you do not lose the handle on a
// live process because a file was edited).
//
// This is what makes the manifest editable at runtime: the panel calls it before
// it paints, `start` calls it when it is handed a name it has never seen, and
// `startAll` calls it at boot. Nothing else creates a record.
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Record<string, types.services.Service>> {
    const specs = await ctx.fns.services.resolve({});
    // Assigns a port to anything new; existing entries are left alone, so a
    // service added after boot cannot move anybody else's address.
    const env = await ctx.fns.services.env({});
    const services: Record<string, types.services.Service> = (ctx.state.services ??= {});
    let changed = false;

    for (const [name, spec] of Object.entries(specs)) {
        if (!services[name]) {
            services[name] = blank(name, spec);
            changed = true;
        }
        const record = services[name]!;
        record.spec = spec;
        record.port = spec.portEnv.length ? Number(env[spec.portEnv[0]!]) : undefined;
        record.url = spec.url ?? (record.port ? `http://localhost:${record.port}` : undefined);
    }

    for (const [name, record] of Object.entries(services)) {
        if (specs[name] || record.proc) continue;
        // A service mid-backoff has no process but does have an armed timer;
        // undeclaring it has to disarm that, or it would spawn a child for a
        // record nobody holds any more.
        clearTimeout(record.timer);
        delete services[name];
        changed = true;
    }

    // Only when the set of cards changed — the list repaints on its own timer,
    // and an event per paint would loop through the browser and back.
    if (changed) ctx.fns.events.emit({ event: { type: "service" } });
    return services;
}

function blank(name: string, spec: types.services.Spec): types.services.Service {
    return { name, spec, state: "idle", wanted: "down", ready: false, restarts: 0, lines: [], seq: 0 };
}
