// Bring one service up. This is the human/boot entry: it resets the restart
// counter (clicking start on a crashed service always buys a fresh set of
// attempts), waits for the services it `needs`, and hands over to spawn. The
// backoff loop in superviseExit calls spawn directly, so neither the reset nor
// the dependency wait ever runs on a retry.
//
// There is no topological sort: a dependency that is idle is started here and
// then awaited, so the order falls out of the recursion and independent
// services still come up in parallel (the needs are awaited together, and
// startAll starts every service at once). resolve's cycle check is what keeps
// the recursion finite.
//
// `state = "starting"` is set before the first await and is also the guard, so
// two callers — startAll and a dependent, or a double-click — cannot reach
// spawn twice, and the card says "starting" while the service waits for aidbox.
//
// A dependency that does not turn ready in time does not block us: we record
// the reason on the card and start anyway. A dev workspace printing a
// connection error beats one that silently never starts.
export default async function (ctx: Context, _session: Session | null, opts: { name: string }): Promise<types.services.Service> {
    const name = opts.name;
    // A service added to workspace.json after boot has no record yet.
    if (!ctx.state.services?.[name]) await ctx.fns.services.track({});
    const service: types.services.Service | undefined = ctx.state.services?.[name];
    if (!service) throw new Error(`no such service in workspace.json: ${name}`);
    if (service.state === "starting" || service.state === "running") return service;

    // An armed backoff timer belongs to the crash loop we are overruling.
    clearTimeout(service.timer);
    service.timer = undefined;
    service.wanted = "up";
    service.restarts = 0;
    service.error = undefined;
    service.state = "starting";
    ctx.fns.events.emit({ event: { type: "service", name } });

    // In-process: the app is this code. Its directory joins the scan roots under
    // its own namespace and loadFns brings it into ctx.fns — a plugin in
    // everything but where it lives. Nothing is spawned, so there is no port to
    // wait for and no process to supervise; a syntax error surfaces here rather
    // than in a log nobody is reading.
    if (service.spec.runtime === "in-process") {
        const dir = `${ctx.fns.project.workdir({})}/src`;
        // A spawned child is handed the shared environment; an in-process app has
        // no child to hand it to, so the workspace adopts it. That is what lets
        // the app read AIDBOX_BASE_URL from ctx.env like any other service.
        const shared = await ctx.fns.services.env({});
        Object.assign(process.env, shared);
        Object.assign(ctx.env, shared);
        (ctx.state.appRoots ??= {})[name] = dir;
        try {
            await ctx.loadFns({});
            await ctx.fns.http.loadRoutes({});
        } catch (error: any) {
            delete ctx.state.appRoots[name];
            service.state = "crashed";
            service.error = String(error?.message ?? error);
            ctx.fns.events.emit({ event: { type: "service", name } });
            throw error;
        }
        service.ready = true;
        service.state = "running";
        service.startedAt = Date.now();
        ctx.fns.log.info({ event: "service.mounted", msg: `${name} mounted from ${dir}`, service: name });
        ctx.fns.events.emit({ event: { type: "service", name } });
        return service;
    }

    // External: nothing to run, the address is already published. Marking it
    // ready is what lets dependents through waitReady.
    if (!service.spec.cmd) {
        service.ready = true;
        service.state = "running";
        service.url ??= service.spec.url;
        ctx.fns.events.emit({ event: { type: "service", name } });
        return service;
    }

    await Promise.all(service.spec.needs.map(async (need: string) => {
        if (ctx.state.services?.[need]?.state === "idle") await ctx.fns.services.start({ name: need });
        if (await ctx.fns.services.waitReady({ name: need })) return;
        service.error = `started before ${need} was ready`;
        ctx.fns.log.warn({ event: "service.needs.timeout", msg: `${name} ${service.error}`, service: name, needs: need });
    }));

    // A stop while we were waiting for the dependencies wins — read it back off
    // the record rather than off the local, which is stale by a minute by now.
    if (ctx.state.services?.[name]?.wanted === "down") return service;
    return ctx.fns.services.spawn({ name });
}
