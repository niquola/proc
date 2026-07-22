// The transcript, read straight from sqlite — the db is the only copy, so this
// is what `chat.ts` renders and what any client sees after a restart.
export default function (ctx: Context, _session: Session | null, _opts?: {}): types.agent.Message[] {
    const rows = ctx.fns.db.query({ sql: `SELECT message FROM agent_messages ORDER BY seq` });
    return rows.map((r: any) => JSON.parse(r.message));
}
