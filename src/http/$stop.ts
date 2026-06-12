// http module teardown — stop the Bun server (closing active connections).
export default async function (ctx: Context, _session: Session | null, _state?: any) {
    const s = ctx.state.server as any;
    if (s?.server?.stop) { s.server.stop(true); console.log("[http] server stopped"); }
}
