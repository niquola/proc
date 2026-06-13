// Run a DSL query (compile via db.sql, then query). Returns rows.
//   ctx.fns.db.q({ select: "*", from: "todos", where: { done: 0 } })
export default function (ctx: Context, _session: Session | null, query: types.db.Query) {
    const { sql, params } = ctx.fns.db.sql(query);
    return ctx.fns.db.query({ sql, params });
}
