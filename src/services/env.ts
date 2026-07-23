// The shared environment every service is started with: WORKDIR, the manifest's
// own `env`, a free port per variable named in `portEnv`, the resulting address
// for `urlEnv`, and everything providers `publish`. Values may reference each
// other (and the process env) as ${NAME}.
//
// It lives on ctx.state.serviceEnv and only ever *fills in* what is missing, so
// a restart keeps its ports and a service added to workspace.json after boot
// gets one without moving anybody else's.
//
// With `name` the service's own `env` is overlaid on a copy — that block belongs
// to one child and is never merged into the shared environment.
// The environment the workspace booted with, kept apart from the one it
// computes. An in-process app is handed the shared env on ctx.env (it has no
// child process to inherit it), which means a later resolve would find
// AIDBOX_BASE_URL there and conclude somebody else runs Aidbox — and stop
// offering to start, stop or restart the container the workspace itself owns.
export default async function (ctx: Context, _session: Session | null, opts?: { name?: string }): Promise<Record<string, string>> {
    ctx.state.bootEnv ??= { ...ctx.env };
    const specs = await ctx.fns.services.resolve({});
    const manifest = await ctx.fns.services.manifest({});
    const env: Record<string, string> = (ctx.state.serviceEnv ??= { WORKDIR: ctx.fns.project.workdir({}) });

    // Ports first, because everything else may interpolate them. portEnv may
    // name several variables (a database next to the service); the first one is
    // the service's own port, and that is the one urlEnv points at.
    for (const spec of Object.values(specs) as any[]) {
        for (const key of [spec.portEnv ?? []].flat()) env[key] ??= String(ctx.fns.services.freePort({}));
        // External services publish their address as given; started ones publish
        // the port the workspace just handed them.
        if (spec.urlEnv) env[spec.urlEnv] ??= spec.url ?? `http://localhost:${env[[spec.portEnv ?? []].flat()[0]] ?? ""}`;
    }

    for (const [key, value] of Object.entries(manifest.env ?? {})) env[key] = expand(String(value), env);
    for (const spec of Object.values(specs) as any[]) {
        for (const [key, value] of Object.entries(spec.publish ?? {})) env[key] = expand(String(value), env);
    }

    if (!opts?.name) return env;
    const own = (specs as any)[opts.name]?.env ?? {};
    const merged = { ...env };
    for (const [key, value] of Object.entries(own)) merged[key] = expand(String(value), merged);
    return merged;
}

function expand(value: string, env: Record<string, string>): string {
    return value.replace(/\$\{(\w+)\}/g, (_m, name) => env[name] ?? process.env[name] ?? "");
}
