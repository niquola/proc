// GET /preview — show the running app in a frame. ?url= overrides the default.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url).searchParams.get("url") || ctx.fns.preview.url({});
    return {
        title: "preview",
        main: `<form data-form="preview" class="flex gap-2 mb-3" method="get" action="/preview">
  <input name="url" value="${esc(url)}" class="flex-1 rounded border border-gray-300 px-3 py-1 font-mono text-xs">
  <button data-action="open" class="rounded bg-gray-900 text-white px-3 py-1">Open</button>
</form>
<iframe src="${esc(url)}" class="w-full h-[calc(100vh-11rem)] border border-gray-200 rounded"></iframe>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
