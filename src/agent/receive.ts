// Fold one ACP session update into the transcript. Text and thinking arrive as
// chunks and are appended to the last message of the same kind; tool calls are
// their own entries, updated in place as they progress.
export default function (ctx: Context, _session: Session | null, opts: { update: any }) {
    const agent = ctx.state.agent;
    const u = opts.update;
    const kind = u.sessionUpdate;

    if (kind === "config_option_update") {
        agent.config = u.configOptions;
        ctx.fns.events.emit({ event: { type: "agent" } });
        return;
    }

    if (kind === "agent_message_chunk" || kind === "agent_thought_chunk") {
        append(agent, kind === "agent_thought_chunk" ? "thought" : "text", u.content?.text ?? "");
    } else if (kind === "tool_call" || kind === "tool_call_update") {
        const id = u.toolCallId ?? crypto.randomUUID();
        const existing = agent.messages.find(m => m.id === id);
        const text = (u.content ?? []).map((c: any) => c.content?.text ?? c.text ?? "").join("");
        if (existing) Object.assign(existing, { title: u.title ?? existing.title, status: u.status ?? existing.status, text: text || existing.text });
        else agent.messages.push({ id, role: "agent", kind: "tool", title: u.title ?? u.kind ?? "tool", status: u.status, text, at: new Date().toISOString() });
    } else {
        return;
    }

    agent.status = "running";
    ctx.fns.events.emit({ event: { type: "agent" } });
}

function append(agent: any, kind: string, text: string): void {
    const last = agent.messages[agent.messages.length - 1];
    if (last && last.role === "agent" && last.kind === kind) last.text += text;
    else agent.messages.push({ id: crypto.randomUUID(), role: "agent", kind, text, at: new Date().toISOString() });
}
