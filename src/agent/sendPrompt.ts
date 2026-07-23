// Start one turn. This is the unconditional send: the queue check lives in
// prompt.ts, so finishPrompt can drain through here without re-enqueueing.
//
// The three flags are cleared before the turn, not after: they describe the
// last turn, and the user pressing send is the moment that judgement expires.
// A fresh `messageId` per send keeps two consecutive prompts from merging into
// one bubble in publish's chunk fold.
//
// The turn is stored, not awaited: the caller returns immediately and the
// answer arrives as session updates.
export default function (ctx: Context, _session: Session | null, opts: { text: string; author?: { id: string; name: string } }): void {
    const agent = ctx.state.agent;

    agent.status = "running";
    agent.authRequired = false;
    agent.usageLimit = false;
    agent.promptFailed = false;
    ctx.fns.events.emit({ event: { type: "agent" } });

    ctx.fns.agent.publish({
        update: {
            sessionUpdate: "user_message_chunk",
            content: { type: "text", text: opts.text },
            messageId: crypto.randomUUID(),
        },
        source: "user",
        author: opts.author,
    });

    // When more than one person is here the agent is told who spoke, because
    // "do it the way I said" means different things from different people.
    const others = ctx.fns.events.presence({}).length > 1;
    const text = others && opts.author ? `[${opts.author.name}]: ${opts.text}` : opts.text;
    agent.prompt = ctx.fns.agent.runPrompt({ text });
    agent.prompt.catch(() => undefined);
}
