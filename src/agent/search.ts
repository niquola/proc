// Full-text search over the transcript. The FTS table is filled by triggers on
// agent_messages, so this is the whole feature.
export default function (ctx: Context, _session: Session | null, opts: { query: string; limit?: number }): types.agent.Message[] {
    const rows = ctx.fns.db.query({
        sql: `SELECT m.message FROM agent_messages_fts f
              JOIN agent_messages m ON m.id = f.id
              WHERE agent_messages_fts MATCH ?
              ORDER BY rank LIMIT ?`,
        params: [opts.query, opts.limit ?? 50],
    });
    return rows.map((r: any) => JSON.parse(r.message));
}
