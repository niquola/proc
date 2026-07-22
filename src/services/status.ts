// The running services, as plain data.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const services = ctx.state.services ?? {};
    return Object.values(services).map((s: any) => ({
        name: s.name, provider: s.provider, port: s.port, url: s.url, pid: s.pid, cmd: s.cmd, cwd: s.cwd, env: s.env,
        startedAt: s.startedAt, external: !!s.external,
        running: s.external ? true : s.proc.exitCode === null,
        exitCode: s.external ? null : s.proc.exitCode,
    }));
}
