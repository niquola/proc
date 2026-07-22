// Visible text of the page or one element.
export default function (ctx: Context, _session: Session | null, opts: { selector?: string }) {
    const sel = JSON.stringify(opts.selector ?? "body");
    return ctx.fns.page.eval({ code: `return document.querySelector(${sel})?.innerText ?? null` });
}
