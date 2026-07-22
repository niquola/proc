// GET /form/:id — show the form the agent asked for.
export default async function (ctx: Context, _session: Session, opts: { params: { id: string } }) {
    return { title: "form", main: ctx.fns.form.render({ id: opts.params.id }) };
}
