// Set a session config option — this is the model picker. The response carries
// the authoritative option list, so we assign that instead of the value we
// asked for: the agent may normalise it, reject it, or change other options.
export default async function (ctx: Context, _session: Session | null, opts: { configId: string; value: string | boolean }) {
    const agent = ctx.state.agent;
    if (!agent?.acp || !agent.session) throw new Error("agent is not running");

    const response = await ctx.fns.agent.callAcp({
        method: "setSessionConfigOption",
        params: {
            sessionId: agent.session,
            configId: opts.configId,
            // the `boolean` discriminator is only valid for boolean options
            ...(typeof opts.value === "boolean" ? { type: "boolean" as const, value: opts.value } : { value: opts.value }),
        },
    });

    agent.config = response?.configOptions ?? agent.config;
    ctx.fns.events.emit({ event: { type: "agent" } });
    return { config: agent.config };
}
