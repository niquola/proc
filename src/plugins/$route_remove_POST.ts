// POST /plugins/remove — un-ask for a plugin and remount.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const name = String((await opts.req.formData()).get("name") ?? "").trim();
    try {
        await ctx.fns.plugins.remove({ name });
        return { title: "plugins", main: await ctx.fns.plugins.panel({ message: `Removed ${name}` }) };
    } catch (error: any) {
        return { title: "plugins", main: await ctx.fns.plugins.panel({ error: String(error?.message ?? error) }) };
    }
}
