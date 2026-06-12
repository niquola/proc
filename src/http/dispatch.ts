// In-process HTTP call — no socket. Matches a route by convention, builds a
// request ctx + session, runs the handler, wraps the result. Use it to test
// REST without starting a server, or for internal sub-requests:
//   const res = await ctx.fns.http.dispatch({ url: "/issues" });
//   expect(res.status).toBe(200); expect(await res.json()).toEqual([...]);
//   await ctx.fns.http.dispatch({ method: "POST", url: "/issues/add", body: { title: "x" } });
// body: object → JSON; string / FormData / URLSearchParams → sent as-is.
import { makeRequestCtx } from "../$main";

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { method?: string; url: string; body?: any; headers?: Record<string, string> },
): Promise<Response> {
    const method = (opts.method ?? "GET").toUpperCase();
    const abs = opts.url.startsWith("http") ? opts.url : "http://localhost" + (opts.url.startsWith("/") ? "" : "/") + opts.url;
    const u = new URL(abs);

    const m = ctx.fns.http.match({ method, pathname: u.pathname });
    if (!m) return new Response("Not Found", { status: 404 });

    const headers = new Headers(opts.headers ?? {});
    let body: any = opts.body;
    const plainObject = body && typeof body === "object"
        && !(body instanceof FormData) && !(body instanceof URLSearchParams) && !(body instanceof ArrayBuffer);
    if (plainObject) {
        body = JSON.stringify(body);
        if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
    const req = new Request(abs, { method, headers, body: method === "GET" || method === "HEAD" ? undefined : body });

    // Request ctx: inherits this env-ctx (so dispatch on a forked test ctx runs
    // against the test env), carries the session through the call chain.
    const rctx = makeRequestCtx(ctx, { kind: "dispatch", req, params: m.params, url: u });
    for (const mw of ctx.fns.http.middleware({ pathname: u.pathname })) {
        const short = await mw.handler(rctx, rctx.session, { req, params: m.params });
        if (short instanceof Response) return short;
    }
    const raw = await m.handler(rctx, rctx.session, { req, params: m.params });
    return ctx.fns.http.toResponse({ value: raw });
}
