// A control that does something, and therefore one that carries `data-action` —
// the verb, not the label, so `page.click({ action: "materialize" })` keeps
// working when the wording changes. Give it the `entity`/`id` it acts on and the
// same descriptor addresses it from anywhere on the page.
//
// `post`/`get` wire it to htmx; without either it is a plain button for a form
// to submit or for client.js to handle.
export default function (ctx: Context, _session: Session | null, opts: {
    action: string; label: string; entity?: string; id?: string;
    post?: string; get?: string; vals?: Record<string, any>; target?: string;
    tone?: "default" | "primary" | "danger"; title?: string;
}): string {
    const tone = opts.tone ?? "default";
    const cls = tone === "primary" ? "rounded-md bg-brand px-3 py-1.5 text-ui text-text-inverse hover:bg-brand-hover"
        : tone === "danger" ? "rounded-md border border-border-input px-2 py-1 text-2xs hover:border-state-danger-border hover:bg-state-danger-bg hover:text-state-danger-fg"
            : "rounded-md border border-border-input px-2 py-1 text-2xs hover:bg-bg-tertiary";
    const hx = opts.post ? `hx-post="${esc(opts.post)}"` : opts.get ? `hx-get="${esc(opts.get)}"` : "";
    const vals = opts.vals ? ` hx-vals='${JSON.stringify(opts.vals)}'` : "";
    const target = hx ? ` hx-target="${esc(opts.target ?? "#main")}" hx-swap="innerHTML"` : "";

    return `<button class="shrink-0 ${cls}" ${ctx.fns.ui.attr({ action: opts.action, entity: opts.entity, id: opts.id })}${opts.title ? ` title="${esc(opts.title)}"` : ""} ${hx}${vals}${target}>${esc(opts.label)}</button>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
