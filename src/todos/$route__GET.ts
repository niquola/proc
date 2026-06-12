// GET /todos — JSON list.
export default function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return ctx.fns.todos.list({});
}
