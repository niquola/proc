// The path as GitHub writes it: the workdir name in bold, then every segment a
// link, `/` between them. It is the page title, not a line above it.
export default function (ctx: Context, _session: Session | null, opts: { path: string }): string {
    const workdir = ctx.fns.project.workdir({});
    const parts = opts.path.split("/").filter(part => part && part !== ".");
    const root = workdir.split("/").pop() ?? "/";

    const crumb = (label: string, to: string, last: boolean) => last
        ? `<span class="font-semibold text-text-primary">${esc(label)}</span>`
        : `<a class="text-text-link hover:underline" href="/filemanager?path=${encodeURIComponent(to)}"
      hx-get="/filemanager?path=${encodeURIComponent(to)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(label)}</a>`;

    let acc = "";
    const trail = parts.map((part, i) => {
        acc = acc ? `${acc}/${part}` : part;
        return crumb(part, acc, i === parts.length - 1);
    });

    return `<div class="flex items-center gap-1.5 text-base">
${crumb(root, ".", parts.length === 0)}
${trail.map(part => `<span class="text-text-tertiary">/</span>${part}`).join("")}
</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
