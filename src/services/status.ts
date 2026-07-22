// Every declared service as plain data — the same picture the cards show, minus
// what cannot cross a wire: `proc`, `timer` and the log ring stay on the record
// (logs have their own function). This is what the REPL, the agent's context
// block and plugins/aidbox read, so it answers the questions a human asks about
// a service: is it up, is it ready, where do I reach it, how long has it been
// there, and how many times has it died.
//
// A record exists for a stopped service too, so the array is the manifest, not
// the process table: `state` says which of the two you are looking at.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return Object.values(ctx.state.services ?? {}).map((service) => ({
        name: service.name,
        state: service.state,
        ready: service.ready,
        wanted: service.wanted,
        // Nothing was started for it and nothing can be: it is someone else's.
        external: !service.spec.cmd,
        cmd: service.spec.cmd,
        needs: service.spec.needs,
        pid: service.pid ?? null,
        port: service.port ?? null,
        url: service.url ?? null,
        // Seconds since the current process was spawned — a restart resets it,
        // which is exactly what makes a flapping service visible.
        uptime: service.startedAt ? Math.round((Date.now() - service.startedAt) / 1000) : null,
        restarts: service.restarts,
        exitCode: service.exitCode ?? null,
        error: service.error ?? null,
    }));
}
