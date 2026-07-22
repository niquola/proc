// Lifecycle: put ctx.state.agent in place. Nothing to hydrate — the db IS the
// transcript, so `chat` renders history straight from sqlite and this only has
// to restore the durable slice (the ACP session id, which is what makes a
// restart resume instead of starting over, plus the title and the accumulated
// agent time). Deliberately does NOT spawn: the agent starts on the first
// prompt or an explicit start, so a boot costs nothing.
export default async function (ctx: Context, _session: Session | null, _config?: any) {
    // The state is meaningless without its tables; migrate runs before us in
    // proc.prod, so this is a no-op guard for a partially started system.
    await ctx.fns.migrate.up({});

    const config = ctx.fns.config.resolve({ module: "agent" }) as ConfigOf<typeof import("./$config").default>;
    const row: any = ctx.fns.db.query({ sql: "SELECT session, title, agent_ms FROM agent_session WHERE id = 1" })[0];

    ctx.state.agent = {
        id: config.id as "claude" | "codex",
        session: row?.session ?? undefined,
        title: row?.title ?? undefined,
        status: "offline",
        authRequired: false,
        usageLimit: false,
        promptFailed: false,
        stderr: [],
        queue: [],
        totals: { agentMs: row?.agent_ms ?? 0 },
        toolStartedAt: {},
    };

    // Assigned above rather than returned so saveState — which reads
    // ctx.state.agent — can write the row on a first-ever boot.
    if (!row) ctx.fns.agent.saveState({});

    ctx.fns.log.info({ event: "agent.ready", msg: row?.session ?? "no session to restore", session: row?.session });
}
