// GET /form — the forms the agent has asked for.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const forms = Object.values(ctx.state.forms ?? {});
    if (!forms.length) return { title: "form", main: `<div class="text-gray-400">no forms yet — the agent creates them with <code>ctx.fns.form.ask({...})</code></div>` };
    return {
        title: "form",
        main: `<ul class="space-y-1">${forms.map((f: any) =>
            `<li><a class="text-blue-700 hover:underline" href="/form/${f.id}">${f.title}</a> <span class="text-xs text-gray-400">${f.answer ? "answered" : "waiting"}</span></li>`).join("")}</ul>`,
    };
}
