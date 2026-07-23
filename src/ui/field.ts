// One input. The name is what `page.fill({ form, values })` uses, and it is also
// written as `data-field` so a control that is not a native input (a menu, a
// custom widget) can still be found by the same name.
export default function (ctx: Context, _session: Session | null, opts: {
    name: string; value?: string; placeholder?: string; type?: string;
    options?: Array<string | { value: string; label: string }>; class?: string;
}): string {
    const marks = ctx.fns.ui.attr({ field: opts.name });
    const cls = opts.class ?? "flex-1";
    const base = "rounded-md border border-border-input px-3 py-1.5 text-ui outline-none focus:border-border-focus";

    if (opts.options) {
        const options = opts.options.map(o => typeof o === "string" ? { value: o, label: o } : o);
        return `<select name="${esc(opts.name)}" ${marks} class="${cls} ${base}">
  ${options.map(o => `<option value="${esc(o.value)}"${o.value === opts.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
</select>`;
    }
    return `<input name="${esc(opts.name)}" ${marks} type="${esc(opts.type ?? "text")}" value="${esc(opts.value ?? "")}"
  placeholder="${esc(opts.placeholder ?? "")}" class="${cls} ${base}">`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
