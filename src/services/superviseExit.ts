// A service process ended. `wanted` is what makes this a crash or a chore: stop
// and restart set it to "down" before they signal, so an exit while it is still
// "up" is the only thing this file treats as a failure.
//
// Bounded three ways, in this order: a clean exit is not a failure (that is the
// default `on-failure` policy), the delay doubles up to a cap, and after
// `maxRestarts` consecutive tries the service lands in `crashed` and waits for a
// human. The counter resets after HEALTHY_MS of uptime, so a service that dies
// once an hour restarts forever while one that dies in 200 ms gives up.
//
// The retry calls `spawn`, not `start`: the counter reset and the `needs` wait
// belong to the human/boot path, not to a backoff loop.
//
// Dependents are left alone — `needs` is a start gate, not a supervision link.
// The card of a service whose dependency is down says so; killing it would only
// destroy state the developer cares about.
const HEALTHY_MS = 10_000;
const MAX_BACKOFF = 30;

export default function (ctx: Context, _session: Session | null, opts: { name: string; proc: any; code?: number | null }) {
    const service: types.services.Service | undefined = ctx.state.services?.[opts.name];
    // A slow exit from a previous process must not clobber the one a newer
    // spawn has already committed.
    if (!service || service.proc !== opts.proc) return;

    const code = opts.code ?? null;
    service.proc = undefined;
    service.pid = undefined;
    service.ready = false;
    service.exitCode = code;

    if (service.wanted === "down") return settle(ctx, service, "idle");

    const healthy = Date.now() - (service.startedAt ?? 0) >= HEALTHY_MS;
    service.restarts = healthy ? 1 : service.restarts + 1;

    const spec = service.spec;
    if (spec.restart === "never") return settle(ctx, service, "crashed");
    if (spec.restart === "on-failure" && code === 0) return settle(ctx, service, "idle");
    if (service.restarts > spec.maxRestarts) {
        service.error = `gave up after ${spec.maxRestarts} restarts`;
        return settle(ctx, service, "crashed");
    }

    const delay = Math.min(spec.backoff * 2 ** (service.restarts - 1), MAX_BACKOFF);
    service.state = "restarting";
    service.timer = setTimeout(() => ctx.fns.services.spawn({ name: service.name }), delay * 1000);
    ctx.fns.log.warn({
        event: "service.crash", msg: `${service.name} exited (${code}), restarting in ${delay}s`,
        service: service.name, code, delay, restarts: service.restarts,
    });
    ctx.fns.events.emit({ event: { type: "service", name: service.name } });
}

function settle(ctx: Context, service: types.services.Service, state: "idle" | "crashed") {
    service.state = state;
    const level = state === "crashed" ? "error" : "info";
    ctx.fns.log[level]({
        event: `service.${state === "crashed" ? "crashed" : "exit"}`,
        msg: `${service.name} exited (${service.exitCode ?? "unknown"})${service.error ? `: ${service.error}` : ""}`,
        service: service.name, code: service.exitCode ?? null,
    });
    ctx.fns.events.emit({ event: { type: "service", name: service.name } });
}
