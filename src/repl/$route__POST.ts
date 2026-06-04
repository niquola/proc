// POST /repl — server-side eval. ANYTHING posted here runs with ctx in scope:
// arbitrary FS / network / DB access. This is the dev tool script/repl.ts
// targets. To prevent network-reachable RCE we hard-gate to loopback.
//
//   NODE_ENV=production → endpoint returns 403 even from localhost
export default async function (ctx: Context, session: Session, opts: { req: Request }) {
    const env = ctx.env ?? {};
    if (env.NODE_ENV === "production") return new Response("repl disabled", { status: 403 });

    const ip = ctx.state?.server?.server?.requestIP?.(opts.req)?.address;
    if (ip && !isLoopback(ip)) {
        return new Response("repl is loopback-only", { status: 403 });
    }

    const code = await opts.req.text();
    // Watcher's per-file error board: if any watched file failed to load,
    // every REPL response carries it — a stale fn can't silently pass for fresh.
    const errs: Map<string, string> | undefined = (ctx.state as any).dev?.errors;
    const watchErrors = errs && errs.size > 0 ? Object.fromEntries(errs) : undefined;
    try {
        const result = await ctx.fns.repl.eval({ code });
        return new Response(JSON.stringify({ success: true, output: result.output, return: result.return, ...(watchErrors && { watchErrors }) }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message, stack: error.stack, ...(watchErrors && { watchErrors }) }), { status: 500 });
    }
}

function isLoopback(addr: string): boolean {
    return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1" || addr === "localhost";
}
