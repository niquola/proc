// Start one service from workspace.json (or all of them) in WORKDIR, with the
// workspace-assigned ports in its environment. Replaces process-compose.
const LOG_LINES = 500;

export default async function (ctx: Context, _session: Session | null, opts: { name?: string }) {
    const specs = await ctx.fns.services.resolve({});
    if (!opts.name) {
        const started = [];
        for (const name of Object.keys(specs)) started.push(await ctx.fns.services.start({ name }));
        return started;
    }

    const name = opts.name;
    const spec = specs[name];
    if (!spec) throw new Error(`no such service in workspace.json: ${name}`);

    const services = (ctx.state.services ??= {});
    if (services[name]?.proc?.exitCode === null) return describe(services[name]);

    const env = await ctx.fns.services.env({});
    // External service: nothing to run, its address is already published.
    if (!spec.cmd) {
        const external = { name, cmd: [], cwd: null, url: spec.url, port: null, env, pid: null, startedAt: null, external: true, provider: spec.provider, logs: [] };
        services[name] = external;
        return describe(external);
    }
    const cwd = ctx.fns.project.workdir({});
    const logs: string[] = [];
    const proc = Bun.spawn(spec.cmd!, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
    const service = {
        name,
        provider: spec.provider,
        cmd: spec.cmd!,
        cwd,
        port: spec.portEnv ? Number(env[[spec.portEnv].flat()[0]]) : null,
        url: spec.urlEnv ? env[spec.urlEnv] : null,
        env,
        pid: proc.pid,
        startedAt: new Date().toISOString(),
        proc,
        logs,
    };
    services[name] = service;

    for (const stream of [proc.stdout, proc.stderr]) void collect(stream as ReadableStream, logs);
    ctx.fns.log.info({ event: "service.started", msg: `${name} pid ${proc.pid}`, name, port: service.port, pid: proc.pid });
    return describe(service);
}

async function collect(stream: ReadableStream, logs: string[]): Promise<void> {
    const decoder = new TextDecoder();
    for await (const chunk of stream as any) {
        for (const line of decoder.decode(chunk).split("\n")) {
            if (!line) continue;
            logs.push(line);
            if (logs.length > LOG_LINES) logs.shift();
        }
    }
}

function describe(s: any) {
    return {
        name: s.name, provider: s.provider, port: s.port, url: s.url, pid: s.pid, cmd: s.cmd, cwd: s.cwd, env: s.env,
        startedAt: s.startedAt, external: !!s.external, running: s.external ? true : s.proc.exitCode === null,
    };
}
