// The gate for the web UI. It covers every path because that is what the web UI
// is: not only the pages, but the event stream that carries the workspace's
// state, the endpoint the injected code answers on, and the POSTs that install
// plugins, restart services and drive the agent. Leaving any of those open would
// make the login decorative.
//
// With `AUTH=off` — the default, and what a developer on their own machine
// wants — this returns immediately and the workspace behaves exactly as before.
//
// Everything that lets somebody in lives under `/auth` — the magic link, the
// screen, the logout — so there is one open door to reason about. `/repl` is not
// part of this at all: it is a local tool, gated by the run's secret and by
// loopback, so the agent's helpers keep working with or without a session.
const OPEN = ["/auth", "/repl"];

export default async function (ctx: Context, session: Session, opts: { req: Request }) {
    if (ctx.fns.config.resolve({ module: "auth" }).mode !== "on") return;

    const path = new URL(opts.req.url).pathname;
    if (OPEN.some(prefix => path === prefix || path.startsWith(prefix + "/"))) return;

    const user = await ctx.fns.auth.authenticate({ req: opts.req });
    if (user) { session.user = user; return; }

    // A page asks the person to log in; anything else says no in a way a fetch
    // can act on, rather than handing back a login page as if it were data.
    const wantsPage = opts.req.method === "GET" && (opts.req.headers.get("accept") ?? "").includes("text/html");
    if (!wantsPage) return new Response("unauthorized", { status: 401 });
    return new Response(null, { status: 302, headers: { location: `/auth/login?next=${encodeURIComponent(path + new URL(opts.req.url).search)}` } });
}
