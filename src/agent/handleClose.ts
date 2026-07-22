// acp.closed — the transport died; the process may still be alive.
// Ownership is captured BEFORE clearConnection: clearing drops `process`, so a
// check made afterwards can never be true and the grace kill never fires
// (wmlet's live bug). The session id is kept, so the next start restores.
export default async function (ctx: Context, _session: Session | null, opts: { acp: any; proc: any }) {
    const agent = ctx.state.agent;
    if (!agent || agent.acp !== opts.acp) return;

    const owned = agent.process === opts.proc;
    ctx.fns.log.warn({ event: "agent.closed", msg: `ACP connection closed: ${opts.acp?.signal?.reason ?? "no reason"}` });
    ctx.fns.agent.clearConnection({});
    agent.status = "offline";
    ctx.fns.events.emit({ event: { type: "agent" } });

    await Promise.race([opts.proc?.exited?.catch(() => undefined), Bun.sleep(2000)]);
    // Ask this process whether it is still alive. `agent.exited` is one flag for
    // whichever process last exited, so a slow-dying predecessor would tell us a
    // live child is already gone.
    if (owned && opts.proc?.exitCode === null) {
        try { opts.proc.kill(); } catch {}
    }
}
