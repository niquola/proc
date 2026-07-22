// GET /aidbox — the Aidbox console of this workspace, framed edge to edge. The
// console has its own navigation, so a path bar of ours would only compete with
// it; ?path= still picks what to frame.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const service = ctx.fns.services.status({}).find((s: any) => s.name === "aidbox");
    const base = service?.url ?? (await ctx.fns.services.env({})).AIDBOX_BASE_URL;
    if (!base) {
        return { title: "aidbox", main: `<div class="text-text-placeholder">No aidbox service — add <code>"aidbox": {}</code> to workspace.json.</div>` };
    }

    const path = new URL(opts.req.url).searchParams.get("path") ?? "/";
    const url = new URL(path, base).toString();

    return {
        title: "aidbox",
        main: `<iframe id="aidbox-frame" src="${esc(url)}" class="block h-[calc(100vh-6rem)] w-[calc(100%+3rem)] -m-6 bg-bg-content"></iframe>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
