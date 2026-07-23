// The public way to send a message. Everything the user types comes through
// here; sendPrompt is the unconditional send underneath it.
//
// The order of the three checks is the policy. While the agent is starting we
// must not touch it, so the message waits. Otherwise a message is enough reason
// to spawn the agent — this is the only place that starts it on demand. After
// the start, a turn may already be in flight; `agent.prompt` is checked next to
// `status` because the promise is set before the status flip, and a message
// arriving in that window belongs in the queue too.
export default async function (ctx: Context, session: Session | null, opts: { text: string }) {
    const agent = ctx.state.agent;
    // Several people can share one workspace and one agent, so a message
    // carries who sent it. Without a session there is nobody to name and the
    // transcript stays as it was.
    const user = (session as any)?.user;
    const author = user ? { id: user.sub, name: user.name } : undefined;

    if (agent.status === "starting") {
        agent.queue.push({ id: crypto.randomUUID(), text: opts.text, author });
        ctx.fns.events.emit({ event: { type: "agent" } });
        return { status: agent.status, queued: true };
    }

    if (!agent.acp || !agent.process) await ctx.fns.agent.start({});

    if (agent.status === "running" || agent.prompt) {
        agent.queue.push({ id: crypto.randomUUID(), text: opts.text, author });
        ctx.fns.events.emit({ event: { type: "agent" } });
        return { status: agent.status, queued: true };
    }

    ctx.fns.agent.sendPrompt({ text: opts.text, author });
    return { status: agent.status };
}
