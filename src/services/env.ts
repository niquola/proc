// The environment every service is started with: a free port per service that
// asks for one, the resulting URL for whoever needs the address, and each
// service's own env with ${NAME} references resolved. Computed once and kept on
// ctx.state.serviceEnv, so restarts keep the same ports.
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Record<string, string>> {
    if (ctx.state.serviceEnv) return ctx.state.serviceEnv;

    const services = await ctx.fns.services.resolve({});
    const env: Record<string, string> = { WORKDIR: ctx.fns.project.workdir({}) };
    for (const spec of Object.values(services)) {
        // portEnv may name several variables (a service with side ports, like a
        // database next to it); the first one is the service's own port.
        for (const name of [spec.portEnv ?? []].flat()) env[name] = String(ctx.fns.services.freePort({}));
        // External services publish their address as given; started ones publish
        // the port the workspace just handed them.
        if (spec.urlEnv) env[spec.urlEnv] = spec.url ?? `http://localhost:${env[[spec.portEnv].flat()[0]] ?? ""}`;
    }
    for (const spec of Object.values(services)) {
        for (const [key, value] of Object.entries(spec.env ?? {})) {
            env[key] = value.replace(/\$\{(\w+)\}/g, (_m, name) => env[name] ?? process.env[name] ?? "");
        }
    }
    ctx.state.serviceEnv = env;
    return env;
}
