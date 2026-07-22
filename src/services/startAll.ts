// Bring the workspace up: reconcile the records with workspace.json, then start
// every service that asks to come up with it.
//
// All at once, on purpose. `start` awaits the services it `needs` (and starts an
// idle one itself), so the ordering falls out of that recursion — which means
// independent services really do come up in parallel and only real dependencies
// serialise. A failure is isolated per service: one broken declaration must not
// leave the rest of the workspace unstarted.
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Record<string, types.services.Service>> {
    const services: Record<string, types.services.Service> = await ctx.fns.services.track({});
    await Promise.all(Object.values(services)
        .filter(service => service.spec.autostart)
        .map(service => ctx.fns.services.start({ name: service.name }).catch((err: any) => {
            service.error = String(err?.message ?? err);
            service.state = "crashed";
            ctx.fns.log.error({ event: "service.start.failed", msg: `${service.name}: ${service.error}`, service: service.name });
            ctx.fns.events.emit({ event: { type: "service", name: service.name } });
        })));
    return services;
}
