// POST /processes/:name/stop
export default async function (ctx: Context, _session: Session, opts: { params: { name: string } }) {
    await ctx.fns.services.stop({ name: opts.params.name });
    return Response.redirect("/processes", 303);
}
