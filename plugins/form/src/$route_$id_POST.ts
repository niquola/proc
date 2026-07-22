// POST /form/:id — record the answer, show it, and feed it back to the agent
// as a user message so the conversation continues from the submitted data.
export default async function (ctx: Context, _session: Session, opts: { req: Request; params: { id: string } }) {
    const form = ctx.state.forms?.[opts.params.id];
    if (!form) return { status: 404, main: "no such form" };

    const data = await opts.req.formData();
    form.answer = Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)]));

    const lines = Object.entries(form.answer).map(([k, v]) => `${k}: ${v}`).join("\n");
    await ctx.fns.agent.prompt({ text: `Form "${form.title}" submitted:\n${lines}` });

    return { title: "form", main: ctx.fns.form.render({ id: form.id }) };
}
