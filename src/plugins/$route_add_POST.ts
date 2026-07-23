// POST /plugins/add — declare a plugin in workspace.json and mount it. A name
// that resolves to nothing, a repo that will not clone: the reason comes back on
// the page rather than as a 500, so the pane keeps whatever was typed.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const name = String(form.get("name") ?? "").trim();
    const git = String(form.get("git") ?? "").trim();
    try {
        const added = await ctx.fns.plugins.add({ name, ...(git ? { git } : {}) });
        return { title: "plugins", main: await ctx.fns.plugins.panel({ message: `Mounted ${added.namespace} — ${added.fns.length} fns${added.tab ? ", one tab" : ""}${added.skill ? ", a skill" : ""}` }) };
    } catch (error: any) {
        return { title: "plugins", main: await ctx.fns.plugins.panel({ error: String(error?.message ?? error) }) };
    }
}
