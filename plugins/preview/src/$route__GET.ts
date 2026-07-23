// GET /preview — the app under development, framed edge to edge. No shell bar:
// the workspace already knows the address (services.env) and the app draws its
// own chrome, so anything we add here is a second, competing one. ?url= still
// overrides what is framed.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url).searchParams.get("url") || ctx.fns.preview.url({});

    return {
        title: "preview",
        main: `<iframe id="preview-frame" src="${esc(url)}" class="block h-[calc(100vh-3rem)] w-[calc(100%+3rem)] -m-6 bg-bg-content"></iframe>`,
    };
}


function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
