// Take a service down and *keep* it down. The record survives: a stopped
// service keeps its card, its logs, its port and its spec — only the process
// goes away.
//
// `wanted = "down"` is set before anything is signalled, because that flag is
// the whole difference between a crash and a chore: superviseExit reads it and
// settles instead of arming a backoff. An armed backoff timer is cleared for
// the same reason — a service stopped mid-restart must not wake up.
//
// The signal goes to the process *group* (children are spawned detached, so the
// pid is the group leader). That is what kills `sh -lc "…"` together with the
// bun or docker under it; signalling the shell alone is what used to leave
// orphans holding a port. SIGTERM, five seconds to shut down cleanly, then
// SIGKILL — no per-service stopCmd, no signal knob.
//
// Dependents are not touched: `needs` is a start gate, not a supervision link.
// Stopping aidbox should not kill the editor's app and the state in it; the
// card of a service whose dependency is down says so, which is all a human
// needs to read.
const GRACE_MS = 5_000;

export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const service: types.services.Service | undefined = ctx.state.services?.[opts.name];
    if (!service) return;

    service.wanted = "down";
    clearTimeout(service.timer);
    service.timer = undefined;

    const proc = service.proc;
    if (proc) {
        signal(proc, "SIGTERM");
        if (!(await exitedWithin(proc, GRACE_MS))) {
            ctx.fns.log.warn({ event: "service.kill", msg: `${service.name} ignored SIGTERM, killing`, service: service.name });
            signal(proc, "SIGKILL");
            await proc.exited;
        }
        service.exitCode = proc.exitCode ?? null;
    }

    // Settle here rather than leaving it to superviseExit, so that whoever
    // awaited stop (restart, the lifecycle hook) knows the process is gone.
    // superviseExit sees `service.proc` has moved on and stays out of the way.
    service.proc = undefined;
    service.pid = undefined;
    service.ready = false;
    service.state = "idle";
    ctx.fns.log.info({ event: "service.stopped", msg: service.name, service: service.name });
    ctx.fns.events.emit({ event: { type: "service", name: service.name } });
}

// The group first; ESRCH (the leader is already reaped) falls back to the
// process itself, which is also the case for anything not spawned detached.
function signal(proc: any, sig: "SIGTERM" | "SIGKILL"): void {
    try {
        process.kill(-proc.pid, sig);
    } catch {
        try {
            proc.kill(sig);
        } catch {}
    }
}

async function exitedWithin(proc: any, ms: number): Promise<boolean> {
    let timer: any;
    const grace = new Promise((resolve) => (timer = setTimeout(() => resolve(false), ms)));
    const stopped = await Promise.race([proc.exited.then(() => true), grace]);
    clearTimeout(timer);
    return stopped as boolean;
}
