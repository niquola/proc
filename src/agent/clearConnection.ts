// Forget the connection, keep the session. The ACP session id outlives the
// process it was created in, so the next start restores instead of starting over.
// `exited` is left alone on purpose — handleClose reads it after handleExit set it.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (!agent) return;
    delete agent.acp;
    delete agent.process;
    delete agent.capabilities;
    delete agent.loading;
    delete agent.starting;
}
