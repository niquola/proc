// The ACP ingress: every session update the agent pushes lands here. It splits
// in two — updates that carry session state (config, mode, usage, title,
// commands) are folded into ctx.state.agent, updates that carry transcript
// (chunks, tool calls, plans) go to publish, which owns the rows.
//
// Two orderings matter: trackTiming runs BEFORE publish, because it stamps the
// elapsed bounds onto the update that publish then persists; and publish runs
// even when the state fold threw, so a bad field can never swallow a message.
export default function (ctx: Context, _session: Session | null, opts: { update: any }): void {
    const agent = ctx.state.agent;
    const u = opts.update;
    const kind = u?.sessionUpdate;

    ctx.fns.log.debug({ event: "agent.update", msg: kind, status: u?.status });

    // loadSession replays the entire transcript on restore. The rows are already
    // in sqlite, so the replay is dropped rather than duplicated.
    if (agent?.loading) return;

    try {
        ctx.fns.agent.trackTiming({ update: u });

        let changed = true;
        if (kind === "config_option_update") agent.config = u.configOptions;
        else if (kind === "current_mode_update") agent.currentModeId = u.currentModeId;
        else if (kind === "available_commands_update") agent.commands = u.availableCommands;
        else if (kind === "usage_update") agent.usage = { used: u.used, size: u.size };
        else if (kind === "session_info_update") {
            // An empty title means cleared; anything but a title is not ours.
            const title = (typeof u.title === "string" ? u.title.trim() : "") || undefined;
            if ("title" in u && title !== agent.title) {
                agent.title = title;
                ctx.fns.agent.saveState({});
            }
        } else changed = false;

        if (changed) ctx.fns.events.emit({ event: { type: "agent" } });
    } catch (error) {
        ctx.fns.log.error({ event: "agent.update.failed", msg: String(error), kind });
    }

    try {
        ctx.fns.agent.publish({ update: u, source: "agent" });
    } catch (error) {
        ctx.fns.log.error({ event: "agent.publish.failed", msg: String(error), kind });
    }
}
