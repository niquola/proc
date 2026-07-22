// The agent asks the user something with a real form: the form is stored, the
// right pane opens it, and the answer comes back into the chat on submit.
export default async function (ctx: Context, _session: Session | null, opts: { title: string; fields: types.form.Field[] }) {
    const forms = (ctx.state.forms ??= {});
    const id = String(Object.keys(forms).length + 1);
    forms[id] = { id, title: opts.title, fields: opts.fields, at: new Date().toISOString() };
    await ctx.fns.page.open({ url: `/form/${id}` }).catch(() => null);
    return { id, url: `/form/${id}` };
}
