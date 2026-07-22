// Bring the agent up: spawn the ACP process over WORKDIR, initialize, gate on
// credentials, restore the previous session or open a fresh one.
//
// The guard ladder in front of that is what keeps one connection: a live
// connection short-circuits; a connection whose signal aborted is a corpse and
// is reaped (the process may still be alive, so kill it) rather than reused;
// and a start already in flight is awaited instead of racing a second spawn —
// two spawns would leave one orphan child talking to nobody.
//
// Failure rethrows: the caller needs to distinguish "log in" from "broken", and
// the auth flag rides on the error.
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;

    if (agent.acp?.signal?.aborted) {
        try { agent.process?.kill(); } catch { }
        ctx.fns.agent.clearConnection({});
    } else if (agent.acp && agent.process && agent.session) {
        return { status: agent.status, session: agent.session };
    }

    if (!agent.starting) {
        agent.status = "starting";
        agent.error = undefined;
        ctx.fns.events.emit({ event: { type: "agent" } });
        agent.starting = connect(ctx)
            .catch((error: any) => {
                // Demote only from "starting": a later start may already own the
                // state, and stamping "offline" over it would hide a live agent.
                if (agent.status === "starting") agent.status = "offline";
                agent.error = String(error?.message ?? error);
                ctx.fns.events.emit({ event: { type: "agent" } });
                throw error;
            })
            .finally(() => { delete agent.starting; });
    }

    await agent.starting;
    return { status: agent.status, session: agent.session };
}

async function connect(ctx: Context): Promise<void> {
    const agent = ctx.state.agent;
    const cwd = ctx.fns.project.workdir({});
    agent.authRequired = false;
    agent.usageLimit = false;
    agent.promptFailed = false;

    // Both are regenerated on every start — that is how the agent learns this
    // run's ports, services and REPL recipes.
    await ctx.fns.agent.writeHelpers({});
    await ctx.fns.agent.injectContext({});

    const cmd = ctx.fns.agent.resolveCommand({});
    ctx.fns.log.info({ event: "agent.starting", msg: cmd.join(" "), cwd });
    const proc = Bun.spawn({ cmd, cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    agent.exited = false;
    agent.stderr = [];

    // Both handlers are registered before the connection exists: a process that
    // dies during initialize must still report a code and its stderr.
    void proc.exited.then((code) => ctx.fns.agent.handleExit({ proc, code }));
    void ctx.fns.agent.readStderr({ proc });

    const acp = new ClientSideConnection(
        () => ({
            async sessionUpdate(params: any) { ctx.fns.agent.receive({ update: params.update }); },
            async requestPermission(params: any) { return ctx.fns.agent.decidePermission(params); },
        }),
        ndJsonStream(stdinStream(ctx, proc), proc.stdout),
    );
    void acp.closed.then(() => ctx.fns.agent.handleClose({ acp, proc }));

    try {
        const initialized = await ctx.fns.agent.callAcp({
            method: "initialize",
            acp,
            params: {
                protocolVersion: PROTOCOL_VERSION,
                clientInfo: { name: "procs", version: "0.1.0" },
                // No fs, no terminal: the agent already reads, writes and runs
                // commands with its own tools, and advertising a capability we
                // do not implement makes the agent wait on a client that never
                // answers.
                clientCapabilities: {},
            },
        });

        // Without credentials the session opens and then every turn fails with a
        // protocol error. Gate here so the user is told to log in instead.
        if (!ctx.fns.agent.checkCredentials({})) {
            throw Object.assign(new Error(`Authentication required: ${agent.id} is not connected`), { authRequired: true });
        }

        if (agent.session) await ctx.fns.agent.restoreSession({ acp });
        if (!agent.session) await ctx.fns.agent.openSession({ acp });

        // Late commit: until the session exists this connection is half-built,
        // and anything in state looks live to the guard above and to callers.
        agent.acp = acp;
        agent.process = proc;
        agent.capabilities = initialized.agentCapabilities;
        agent.status = "idle";
        ctx.fns.log.info({ event: "agent.started", msg: agent.session, session: agent.session, cwd });
        ctx.fns.events.emit({ event: { type: "agent" } });
    } catch (error) {
        ctx.fns.log.error({ event: "agent.start.failed", msg: ctx.fns.agent.classifyError({ error }).message });
        try { proc.kill(); } catch { }
        throw error;
    }
}

// The agent's stdin as a WritableStream for ndJsonStream. close and abort log
// with a stack: a quietly closed pipe is indistinguishable from an agent that
// stopped answering, and the stack is the only way to learn who closed it.
function stdinStream(ctx: Context, proc: any): WritableStream<Uint8Array> {
    proc.stdin.start?.({ highWaterMark: 64 * 1024 });
    return new WritableStream<Uint8Array>({
        async write(chunk) {
            proc.stdin.write(chunk);
            await proc.stdin.flush?.();
        },
        async close() {
            ctx.fns.log.warn({ event: "agent.stdin.closed", msg: "agent stdin closed", stack: new Error().stack });
            await proc.stdin.end();
        },
        async abort(reason: any) {
            ctx.fns.log.warn({ event: "agent.stdin.aborted", msg: String(reason?.message ?? reason), stack: new Error().stack });
            try { proc.stdin.end(); } catch { }
        },
    });
}
