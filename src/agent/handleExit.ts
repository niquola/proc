// The process died. `exited` is set before the identity guard because
// handleClose reads it for any process, not just the current one — it is the
// answer to "do I still need to SIGKILL?".
//
// The guard itself: a slow exit from a previous agent must not clobber the
// connection a newer start has already committed.
//
// The session id is deliberately untouched — it outlives the process, so the
// next start restores the transcript instead of beginning a new conversation.
export default function (ctx: Context, _session: Session | null, opts: { proc: any; code?: number | null }) {
    const agent = ctx.state.agent;
    agent.exited = true;
    if (agent.process !== opts.proc) return;

    // No stderr at all means the crash left no trace anywhere else; say so, or
    // the failure is silent.
    if (opts.code !== 0 && agent.stderr.length === 0) {
        ctx.fns.log.warn({ event: "agent.exit.silent", msg: "agent exited without stderr output", code: opts.code ?? null });
    }

    ctx.fns.agent.trackTiming({ close: true });
    ctx.fns.agent.clearConnection({});
    agent.status = "offline";
    ctx.fns.log.info({ event: "agent.exit", msg: `agent exited (${opts.code ?? "unknown"})`, code: opts.code ?? null });
    ctx.fns.events.emit({ event: { type: "agent" } });
}
