// Make the process. This is the *only* place a child is created, so both paths
// that lead here — a human pressing start (through `start`, which waits for the
// dependencies) and the backoff timer of a crash loop — produce exactly the same
// child, with the same environment and the same wiring.
//
// `detached: true` makes the child a process-group leader, which is what lets
// `stop` signal the group and take `sh -lc "…"` down together with the bun or
// docker under it. Without it the shell dies and its children keep the port.
//
// A spawn that throws (a missing binary, a `dir` that is not there) goes
// straight to `crashed` with no retry: that does not fix itself by waiting.
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { name: string }): Promise<types.services.Service> {
    const service: types.services.Service = (ctx.state.services ?? {})[opts.name]!;
    if (!service) throw new Error(`no such service: ${opts.name}`);
    const spec = service.spec;
    if (!spec.cmd) return service;

    const env = await ctx.fns.services.env({ name: opts.name });
    const cwd = resolve(ctx.fns.project.workdir({}), spec.dir);

    let proc: any;
    try {
        proc = Bun.spawn(spec.cmd, {
            cwd,
            env: { ...process.env, ...env },
            detached: true,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
            onExit: (child: any, code: number | null) => ctx.fns.services.superviseExit({ name: opts.name, proc: child, code }),
        });
    } catch (err: any) {
        service.state = "crashed";
        service.error = String(err?.message ?? err);
        ctx.fns.log.error({ event: "service.spawn.failed", msg: `${opts.name}: ${service.error}`, service: opts.name });
        ctx.fns.events.emit({ event: { type: "service", name: opts.name } });
        return service;
    }

    service.proc = proc;
    service.pid = proc.pid;
    service.startedAt = Date.now();
    service.exitCode = undefined;
    service.ready = false;
    service.timer = undefined;
    // The process exists — `ready` is the separate question the probe answers.
    service.state = "running";

    void ctx.fns.services.captureLogs({ name: opts.name, proc });
    void ctx.fns.services.probeReady({ name: opts.name, proc });

    ctx.fns.log.info({ event: "service.started", msg: `${opts.name} pid ${proc.pid}`, service: opts.name, pid: proc.pid, port: service.port ?? null });
    ctx.fns.events.emit({ event: { type: "service", name: opts.name } });
    return service;
}
