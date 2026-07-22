// Write one transcript row. The same call both creates a message and updates it
// in place — a tool call, a growing text chunk and a plan are all one row from
// first sighting to final state, so the fold never has to know which it is doing.
// The message travels as JSON: `id` and `seq` identify and order the row, the
// rest is the message itself and never needs a schema change.
export default function (ctx: Context, _session: Session | null, opts: { message: types.agent.Message }): void {
    const m = opts.message;
    ctx.fns.db.run({
        sql: `INSERT INTO agent_messages (id, seq, message, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                message    = excluded.message,
                updated_at = excluded.updated_at`,
        params: [m.id, m.seq, JSON.stringify(m), m.updatedAt],
    });
}
