export default function (ctx: Context, _session: Session | null, opts: { title: string }) {
    const { lastInsertRowid } = ctx.fns.db.run({ sql: "INSERT INTO todos (title) VALUES (?)", params: [opts.title] });
    return { id: lastInsertRowid, title: opts.title, done: 0 };
}
