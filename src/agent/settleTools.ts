// A tool call that was still running when the process died never gets its
// closing update, so its row stays "pending" forever and the UI shows a
// spinner that never stops. After a restore we settle those rows: publish a
// normal tool_call_update so the fold, the save and the broadcast all happen
// the one way they always do. `incomplete` marks them as interrupted rather
// than genuinely failed, which is what the transcript should say.
// The message is one JSON column, so kind and status are read out of it.
export default function (ctx: Context, _session: Session | null, _opts?: {}): { settled: number } {
    const rows = ctx.fns.db.query({
        sql: `SELECT id FROM agent_messages
              WHERE json_extract(message, '$.kind') = 'tool'
                AND json_extract(message, '$.status') IN ('pending', 'in_progress', 'running')`,
    });
    for (const r of rows) {
        ctx.fns.agent.publish({
            update: { sessionUpdate: "tool_call_update", toolCallId: r.id, status: "failed", _meta: { incomplete: true } },
        });
    }
    return { settled: rows.length };
}
