// Wrap a handler's return value into a Response (shared by the server and by
// http.dispatch):
//   Response              → passthrough
//   string                → HTML via ctx.layout({ main })
//   { main, title?, ... } → HTML via ctx.layout(opts)   (status honored)
//   other                 → JSON
// An htmx request gets the page fragment instead of the whole document: only
// #main is swapped, and the tab strip rides along out of band.
export default function (ctx: Context, session: Session | null, opts: { value: any }): Response {
    const v = opts.value;
    if (v instanceof Response) return v;
    if (typeof v === "string" && (ctx as any).layout) {
        return page(ctx, session, { main: v });
    }
    if (v && typeof v === "object" && typeof v.main === "string" && (ctx as any).layout) {
        const { status, ...rest } = v;
        return page(ctx, session, rest, status ?? 200);
    }
    return new Response(JSON.stringify(v ?? null), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

function page(ctx: Context, session: Session | null, opts: any, status = 200): Response {
    const partial = session?.req?.headers.get("hx-request") === "true";
    const body = partial
        ? opts.main + ctx.fns.ui.tabs({ path: session?.url?.pathname ?? "/", oob: true })
        : ctx.layout(opts);
    return new Response(body, { status, headers: html() });
}

function html() {
    return { "content-type": "text/html; charset=utf-8" };
}
