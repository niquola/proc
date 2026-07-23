// The shell every plugin page starts with: the one element that carries
// `data-page`, the heading, and the sentence under it. Going through here is
// what makes a page addressable at all — the workspace looks for exactly one
// data-page to know what it is showing, and a page that forgets it cannot be
// pointed at, toured or reported by page.state.
export default function (ctx: Context, _session: Session | null, opts: { page: string; title?: string; lead?: string; main: string }): string {
    return `<section ${ctx.fns.ui.attr({ page: opts.page })}>
${opts.title ? `<h1 class="text-lg font-semibold">${esc(opts.title)}</h1>` : ""}
${opts.lead ? `<p class="mt-1 text-2xs text-text-tertiary">${opts.lead}</p>` : ""}
${opts.main}
</section>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
