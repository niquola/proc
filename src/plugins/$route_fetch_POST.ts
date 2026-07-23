// POST /plugins/fetch — clone what workspace.json declared but the disk lacks,
// then mount it. This is the button on a plugin that travelled with the project
// but has never been checked out here.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const name = String((await opts.req.formData()).get("name") ?? "").trim();
    try {
        const { fetched } = await ctx.fns.plugins.fetch({ name });
        await ctx.fns.plugins.reload({});
        return { title: "plugins", main: await ctx.fns.plugins.panel({ message: fetched.length ? `Fetched ${fetched.join(", ")}` : `Nothing to fetch for ${name}` }) };
    } catch (error: any) {
        return { title: "plugins", main: await ctx.fns.plugins.panel({ error: String(error?.message ?? error) }) };
    }
}
