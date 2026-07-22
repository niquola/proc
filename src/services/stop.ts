// Stop a service (SIGTERM) and forget it.
export default async function (ctx: Context, _session: Session | null, opts: { name?: string }) {
    const name = opts.name ?? "app";
    const service = (ctx.state.services ?? {})[name];
    if (!service) return { name, running: false };
    if (!service.external) {
        service.proc.kill();
        await service.proc.exited;
    }
    delete ctx.state.services[name];
    ctx.fns.log.info({ event: "service.stopped", msg: name, name });
    return { name, running: false };
}
