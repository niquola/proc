// Persist the durable slice of ctx.state.agent into the single agent_session
// row. Only what must survive a restart: which agent, its ACP session id (that
// is what makes restore possible), the title and the accumulated agent time.
// Status, the flags, the queue and the live connection are in-memory by design
// and come back reset at boot. Called at session create, restore-clear, title
// change and the end of a turn. Sync — bun:sqlite is.
export default function (ctx: Context, _session: Session | null, _opts?: {}): void {
    const agent = ctx.state.agent;
    if (!agent) return;
    ctx.fns.db.run({
        sql: `INSERT INTO agent_session (id, session, agent, title, agent_ms, at)
              VALUES (1, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                session  = excluded.session,
                agent    = excluded.agent,
                title    = excluded.title,
                agent_ms = excluded.agent_ms,
                at       = excluded.at`,
        params: [
            agent.session ?? null,
            agent.id,
            agent.title ?? null,
            Math.round(agent.totals?.agentMs ?? 0),
            new Date().toISOString(),
        ],
    });
}
