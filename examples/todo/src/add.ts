export default function (ctx: Context, _session: Session | null, opts: { title: string }) {
    ctx.migrate({});
    const { lastInsertRowid } = ctx.fns.db.run({ sql: "INSERT INTO todos (title) VALUES (?)", params: [opts.title] });
    return { id: lastInsertRowid, title: opts.title, done: 0 };
}
