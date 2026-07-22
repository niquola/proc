// Spawn the Claude ACP agent over stdio and open a session in WORKDIR.
// Session updates land in ctx.state.agent.messages and are pushed to the UI.
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { join } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = (ctx.state.agent ??= { status: "offline", messages: [] });
    if (agent.acp) return { status: agent.status, session: agent.session };

    agent.status = "starting";
    agent.error = undefined;
    const cwd = ctx.fns.project.workdir({});
    // Refresh the managed CLAUDE.md block so the session sees this run's ports.
    await ctx.fns.agent.writeHelpers({});
    await ctx.fns.agent.injectContext({});
    const cmd = ["bun", join(process.cwd(), "node_modules", "@agentclientprotocol", "claude-agent-acp", "dist", "index.js")];
    const proc = Bun.spawn(cmd, { cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });

    const acp = new ClientSideConnection(
        () => ({
            async sessionUpdate({ update }: any) {
                ctx.fns.agent.receive({ update });
            },
            // Local dev agent: take the most permissive option so the loop does
            // not stall waiting for a human.
            async requestPermission({ options }: any) {
                const pick = options?.find((o: any) => o.kind === "allow_always") ?? options?.[0];
                return pick ? { outcome: { outcome: "selected", optionId: pick.optionId } } : { outcome: { outcome: "cancelled" } };
            },
        }),
        ndJsonStream(stdinStream(proc), proc.stdout),
    );

    try {
        await acp.initialize({
            protocolVersion: PROTOCOL_VERSION,
            clientInfo: { name: "procs", version: "0.1.0" },
            clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
        });
        const created = await acp.newSession({ cwd, mcpServers: [] });
        agent.acp = acp;
        agent.process = proc;
        agent.session = created.sessionId;
        agent.config = created.configOptions;
        agent.status = "idle";
        ctx.fns.log.info({ event: "agent.started", msg: created.sessionId, cwd });
    } catch (error: any) {
        agent.status = "offline";
        agent.error = String(error?.message ?? error);
        try { proc.kill(); } catch { }
        ctx.fns.log.error({ event: "agent.failed", msg: agent.error });
    }

    void proc.exited.then(() => {
        agent.acp = undefined;
        agent.session = undefined;
        agent.status = "offline";
        ctx.fns.events.emit({ event: { type: "agent" } });
    });

    ctx.fns.events.emit({ event: { type: "agent" } });
    return { status: agent.status, session: agent.session, error: agent.error };
}

function stdinStream(proc: any): WritableStream<Uint8Array> {
    proc.stdin.start?.({ highWaterMark: 64 * 1024 });
    return new WritableStream<Uint8Array>({
        async write(chunk) {
            proc.stdin.write(chunk);
            await proc.stdin.flush?.();
        },
        async close() { await proc.stdin.end(); },
    });
}
