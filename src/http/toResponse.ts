// Wrap a handler's return value into a Response (shared by the server and by
// http.dispatch):
//   Response              → passthrough
//   string                → HTML via ctx.layout({ main })
//   { main, title?, ... } → HTML via ctx.layout(opts)   (status honored)
//   other                 → JSON
export default function (ctx: Context, _session: Session | null, opts: { value: any }): Response {
    const v = opts.value;
    if (v instanceof Response) return v;
    if (typeof v === "string" && (ctx as any).layout) {
        return new Response(ctx.layout({ main: v }), { headers: html() });
    }
    if (v && typeof v === "object" && typeof v.main === "string" && (ctx as any).layout) {
        const { status, ...rest } = v;
        return new Response(ctx.layout(rest), { status: status ?? 200, headers: html() });
    }
    return new Response(JSON.stringify(v ?? null), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

function html() {
    return { "content-type": "text/html; charset=utf-8" };
}
