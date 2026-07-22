// Watch one process until it is ready, then stop. Ready stays ready until the
// process exits, so this is a startup gate and not a health monitor: a service
// that is alive but sick is something you read the logs of, and killing it would
// only delete the evidence.
//
// The loop is bounded by the *process*, never by a clock — `ready.timeout` bounds
// how long a dependent waits, so a service that comes up at 65 s is still noticed
// and still turns green. It gives up only when the process it was handed is no
// longer the current one, or when a human asked for the service to be down.
//
// Three probes, and no probe at all is the fourth answer: a service that declared
// nothing is ready the moment it is spawned.
export default async function (ctx: Context, _session: Session | null, opts: { name: string; proc: any }): Promise<void> {
    const service = ctx.state.services?.[opts.name];
    if (!service) return;
    const ready = service.spec.ready;
    // Only lines from *this* run count for a log probe — the ring outlives the
    // process, so yesterday's "listening on" must not make today's run green.
    const from = service.seq;

    while (service.proc === opts.proc && service.wanted === "up") {
        if (await passes(service, ready, from)) {
            service.ready = true;
            ctx.fns.log.info({ event: "service.ready", msg: opts.name, service: opts.name });
            ctx.fns.events.emit({ event: { type: "service", name: opts.name } });
            return;
        }
        await Bun.sleep(ready.period * 1000);
    }
}

async function passes(service: types.services.Service, ready: types.services.Spec["ready"], from: number): Promise<boolean> {
    // Any answer below 500 means the socket is serving — a 404 on `/` is a
    // running web server, which is the question being asked.
    if (ready.http !== undefined) {
        const base = service.url ?? `http://localhost:${service.port}`;
        try { return (await fetch(base + ready.http, { redirect: "manual" })).status < 500; } catch { return false; }
    }
    // Meaningful precisely because the workspace assigned the port: a successful
    // connect means *this* child bound it.
    if (ready.tcp) {
        if (!service.port) return false;
        try {
            const socket = await Bun.connect({ hostname: "127.0.0.1", port: service.port, socket: { data() {} } });
            socket.end();
            return true;
        } catch { return false; }
    }
    if (ready.log !== undefined) return service.lines.some(line => line.seq > from && line.text.includes(ready.log!));
    return true;
}
