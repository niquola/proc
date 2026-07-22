// Submit the form rooted at [data-form="<name>"] — requestSubmit so validation
// and htmx run exactly as they do for a human click.
export default async function (ctx: Context, _session: Session | null, opts: { form: string; settleMs?: number }) {
    const name = JSON.stringify(opts.form);
    const ok = await ctx.fns.page.eval({
        code: `const root = document.querySelector('[data-form=' + JSON.stringify(${name}) + ']');
               if (!root) return false;
               const form = root.tagName === "FORM" ? root : root.closest("form") ?? root.querySelector("form");
               if (!form) return false;
               form.requestSubmit();
               return true`,
    });
    if (!ok) throw new Error(`no form: ${opts.form}`);
    await Bun.sleep(opts.settleMs ?? 600);
    return { submitted: opts.form };
}
