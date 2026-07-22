// GET /aidbox — the Aidbox console of this workspace, in a frame.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const service = ctx.fns.services.status({}).find((s: any) => s.name === "aidbox");
    const base = service?.url ?? (await ctx.fns.services.env({})).AIDBOX_BASE_URL;
    if (!base) {
        return { title: "aidbox", main: `<div class="text-gray-500">No aidbox service — add <code>"aidbox": {}</code> to workspace.json.</div>` };
    }

    const path = new URL(opts.req.url).searchParams.get("path") ?? "/";
    const url = new URL(path, base).toString();
    const creds = await ctx.fns.services.env({});

    return {
        title: "aidbox",
        main: `<form data-form="aidbox" class="flex gap-2 mb-3" method="get" action="/aidbox">
  <input name="path" value="${esc(path)}" class="flex-1 rounded border border-gray-300 px-3 py-1 font-mono text-xs">
  <button data-action="open" class="rounded bg-gray-900 text-white px-3 py-1">Open</button>
</form>
<div class="text-xs text-gray-500 mb-3">${esc(base)} · <a data-entity="aidbox" data-id="console" class="text-blue-700 hover:underline" href="${esc(base)}" target="_blank">open in a tab</a>
 · sign in as <code>${esc(creds.AIDBOX_CLIENT_ID ?? "root")}</code> / <code>${esc(creds.AIDBOX_CLIENT_SECRET ?? "")}</code></div>
<iframe src="${esc(url)}" class="w-full h-[calc(100vh-11rem)] border border-gray-200 rounded"></iframe>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
