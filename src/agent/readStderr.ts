// Drain the agent's stderr, or a crash is silent: every line lands in
// ctx.state.agent.stderr (ring-capped, so a chatty agent cannot grow it without
// bound) and in the log. Claude announces a usage limit here rather than over
// ACP, so we sniff each line on its way past. Fire-and-forget: start() calls it
// without awaiting, and it ends when the process closes the pipe.
export default async function (ctx: Context, _session: Session | null, opts: { proc: any }) {
    const stream: ReadableStream<Uint8Array> | undefined = opts.proc?.stderr;
    if (!stream?.getReader) return;

    const config = ctx.fns.config.resolve({ module: "agent" }) as ConfigOf<typeof import("./$config").default>;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let pending = "";

    const note = (raw: string) => {
        const line = raw.replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, "").trim();
        const agent = ctx.state.agent;
        if (!line || !agent) return;
        agent.stderr.push(line);
        if (agent.stderr.length > config.stderrLines) agent.stderr.splice(0, agent.stderr.length - config.stderrLines);
        ctx.fns.log.info({ event: "agent.stderr", msg: line });
        if (!agent.usageLimit && ctx.fns.agent.classifyError({ error: line }).usageLimit) {
            agent.usageLimit = true;
            ctx.fns.events.emit({ event: { type: "agent" } });
        }
    };

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            const lines = pending.split(/\r?\n/);
            pending = lines.pop() ?? "";
            for (const line of lines) note(line);
        }
        note(pending + decoder.decode());
    } catch (error) {
        ctx.fns.log.warn({ event: "agent.stderr.failed", msg: ctx.fns.agent.classifyError({ error }).message });
    } finally {
        reader.releaseLock();
    }
}
