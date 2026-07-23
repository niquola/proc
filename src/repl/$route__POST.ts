import { timingSafeEqual } from "node:crypto";
// POST /repl — server-side eval. ANYTHING posted here runs with ctx in scope:
// arbitrary FS / network / DB access. Two gates, because either alone is thin:
//
//   the secret    minted per run, readable only from this machine's filesystem
//                 (.runtime/repl-secret, 0600) — the generated .workspace/repl
//                 and script/repl.ts send it. A proxy in front of the workspace
//                 makes every request look like loopback; it cannot read a file.
//   loopback      the socket peer must be local, so nothing reaches this from
//                 the network even with a leaked secret.
//
//   NODE_ENV=production → endpoint returns 403 even from localhost
export default async function (ctx: Context, session: Session, opts: { req: Request }) {
    const env = ctx.env ?? {};
    if (env.NODE_ENV === "production") return new Response("repl disabled", { status: 403 });

    const ip = ctx.state?.server?.server?.requestIP?.(opts.req)?.address;
    if (ip && !isLoopback(ip)) {
        return new Response("repl is loopback-only", { status: 403 });
    }

    const secret = await ctx.fns.repl.secret({});
    const given = opts.req.headers.get("x-repl-secret") ?? new URL(opts.req.url).searchParams.get("secret") ?? "";
    if (!same(given, secret)) {
        return new Response("repl needs the run's secret — use .workspace/repl (it carries it) or bun script/repl.ts", { status: 403 });
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

// Compared in constant time: a local attacker with a fast loop should not be
// able to read the secret one byte at a time from how long the answer takes.
function same(given: string, secret: string): boolean {
    const a = Buffer.from(given), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

function isLoopback(addr: string): boolean {
    return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1" || addr === "localhost";
}
