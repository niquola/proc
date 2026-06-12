// Close + forget this ctx's connection (next db.* reopens lazily).
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const st = ctx.state as any;
    if (st.db) { st.db.close(); st.db = undefined; }
    return { ok: true };
}
