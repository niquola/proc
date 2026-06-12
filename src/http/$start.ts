import { makeRequestCtx } from "../$main";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const port = (ctx.fns.config.resolve({ module: "http" }) as ConfigOf<typeof import("./$config").default>).port;
    await Bun.write(".runtime/.keep", "");
    const logFile = Bun.file(".runtime/http.log").writer();
    ctx.state.http = { logFile };

    const server = Bun.serve({
        port,
        hostname: "0.0.0.0",
        async fetch(req) {
            const t0 = performance.now();
            const url = new URL(req.url);
            const m = ctx.fns.http.match({ method: req.method, pathname: url.pathname });
            if (!m) {
                log(logFile, req.method, url.pathname + url.search, 404, performance.now() - t0);
                return new Response("Not Found", { status: 404 });
            }
            // Request ctx: inherits root ctx, carries the session. Everything
            // the handler calls via rctx.fns.* gets this session implicitly.
            const rctx = makeRequestCtx(ctx, { kind: 'http', req, params: m.params, url });
            try {
                // Middleware (by path prefix) run first; they may mutate the
                // session or short-circuit by returning a Response.
                for (const mw of ctx.fns.http.middleware({ pathname: url.pathname })) {
                    const short = await mw.handler(rctx, rctx.session, { req, params: m.params });
                    if (short instanceof Response) {
                        log(logFile, req.method, url.pathname + url.search, short.status, performance.now() - t0);
                        return short;
                    }
                }
                const raw = await m.handler(rctx, rctx.session, { req, params: m.params });
                const res = rctx.fns.http.toResponse({ value: raw });
                log(logFile, req.method, url.pathname + url.search, res.status, performance.now() - t0);
                return res;
            } catch (e: any) {
                log(logFile, req.method, url.pathname + url.search, 500, performance.now() - t0, e?.message);
                const dev = ctx.env.NODE_ENV !== 'production';
                const body = dev ? `${e?.message}\n\n${e?.stack ?? ''}` : 'Internal Server Error';
                return new Response(body, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
            }
        },
    });
    ctx.state.server = { server, port };
    await Bun.write(".runtime/port", String(port));
    console.log(`[server] listening on http://localhost:${port}  (written to .runtime/port)`);
}

// Response wrapping lives in http/toResponse.ts (shared with http.dispatch).

function log(sink: any, method: string, path: string, status: number, ms: number, err?: string) {
    const dur = ms < 1 ? `${ms.toFixed(2)}ms` : `${ms.toFixed(0)}ms`;
    const color = ms > 500 ? "\x1b[31m" : ms > 100 ? "\x1b[33m" : "\x1b[2m";
    const reset = "\x1b[0m";
    const ts = new Date().toISOString();
    console.log(`[http] ${method.padEnd(6)} ${String(status).padEnd(3)} ${color}${dur.padStart(7)}${reset}  ${path}${err ? `  ${err}` : ""}`);
    try {
        sink.write(`${ts} ${method.padEnd(6)} ${String(status).padEnd(3)} ${dur.padStart(7)}  ${path}${err ? `  ${err}` : ""}\n`);
        sink.flush();
    } catch { /* writer closed */ }
}
