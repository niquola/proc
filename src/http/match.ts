export default function (
    ctx: Context,
    _session: Session | null,
    opts: { method: string; pathname: string },
): { handler: Function; params: Record<string, string> } | null {
    const { method, pathname } = opts;
    const routes = ctx.routes;
    const exact = routes[pathname];
    if (exact && exact[method]) return { handler: exact[method], params: {} };

    const urlSegs = pathname.split("/").filter(Boolean);
    for (const [pattern, methods] of Object.entries(routes)) {
        const h = methods[method];
        if (!h) continue;
        const patSegs = pattern.split("/").filter(Boolean);
        if (patSegs.length !== urlSegs.length) continue;
        const params: Record<string, string> = {};
        let ok = true;
        for (let i = 0; i < patSegs.length; i++) {
            const p = patSegs[i]!;
            const u = urlSegs[i]!;
            if (p.startsWith(":")) {
                params[p.slice(1)] = u;
            } else if (p !== u) {
                ok = false;
                break;
            }
        }
        if (ok) return { handler: h, params };
    }
    return null;
}
