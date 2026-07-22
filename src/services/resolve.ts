// Turn workspace.json declarations into runnable specs. A declaration that says
// how to run (cmd/url) is used as-is; anything else is a *request* — like GitHub
// Actions `services:` — and the `service.<name>` hook, registered by whatever
// plugin can supply it, answers with cmd/ports/publish. The whole declaration
// (license, adminPassword, …) is handed to the hook untouched.
//
// This is the only place defaults live: sugar is normalised (string cmd → sh -lc,
// portEnv → array), every optional key gets its value, and a manifest that
// contradicts itself throws here rather than at spawn time.
const READY = { timeout: 60, period: 0.5 };

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Record<string, types.services.Spec>> {
    const { services } = await ctx.fns.services.manifest({});
    const specs: Record<string, types.services.Spec> = {};

    for (const [name, declared] of Object.entries(services ?? {})) {
        let spec: any = declared ?? {};
        if (!spec.cmd && !spec.url) {
            const provider = spec.provider ?? name;
            const provided: any = await ctx.fns.hooks.first({ name: `service.${provider}`, opts: { name, spec } });
            if (!provided) throw new Error(`nothing provides service "${name}" (looked for hook service.${provider})`);
            // The declaration wins over the provider, so a human's needs/ready/
            // restart on "aidbox": {…} survives; env and publish merge per key.
            spec = {
                ...provided, ...spec, provider,
                env: { ...provided.env, ...spec.env },
                publish: { ...provided.publish, ...spec.publish },
            };
        }
        specs[name] = fillDefaults(name, spec);
    }

    checkManifest(specs);
    return specs;
}

function fillDefaults(name: string, spec: any): types.services.Spec {
    // portEnv may name several variables (a service with side ports, like the
    // database next to it); the first one is the service's own port.
    const portEnv: string[] = spec.portEnv === undefined ? [] : [spec.portEnv].flat();
    // No probe at all means ready as soon as spawned; a service the workspace
    // gave a port to is ready when something is listening on it.
    const ready = spec.ready ?? (portEnv.length ? { tcp: true } : {});
    const probes = ["http", "tcp", "log"].filter((probe) => ready[probe] !== undefined);
    if (probes.length > 1) throw new Error(`service "${name}": ready has ${probes.join(" and ")} — pick one`);
    if (ready.http !== undefined && !portEnv.length && !spec.url) throw new Error(`service "${name}": ready.http needs a port (portEnv) or a url`);

    return {
        cmd: typeof spec.cmd === "string" ? ["/bin/sh", "-lc", spec.cmd] : spec.cmd,
        url: spec.url,
        provider: spec.provider,
        dir: spec.dir ?? ".",
        portEnv,
        urlEnv: spec.urlEnv,
        env: spec.env ?? {},
        publish: spec.publish ?? {},
        needs: spec.needs ?? [],
        ready: { ...ready, timeout: ready.timeout ?? READY.timeout, period: ready.period ?? READY.period },
        restart: spec.restart ?? "on-failure",
        backoff: spec.backoff ?? 1,
        maxRestarts: spec.maxRestarts ?? 5,
        autostart: spec.autostart ?? true,
    };
}

// Everything that would only surface as a hang or a mystery at runtime: a needs
// cycle (start recurses through needs, so it would never terminate), a needs on
// something nobody declares, and two services fighting over one published key.
function checkManifest(specs: Record<string, types.services.Spec>): void {
    const publishers: Record<string, string> = {};
    for (const [name, spec] of Object.entries(specs)) {
        for (const need of spec.needs) if (!specs[need]) throw new Error(`service "${name}" needs "${need}", which is not declared`);
        for (const key of Object.keys(spec.publish)) {
            if (publishers[key]) throw new Error(`"${key}" is published by both "${publishers[key]}" and "${name}"`);
            publishers[key] = name;
        }
    }

    const seen: Record<string, "walking" | "done"> = {};
    const walk = (name: string, path: string[]): void => {
        if (seen[name] === "done") return;
        if (seen[name] === "walking") throw new Error(`needs cycle: ${[...path, name].join(" → ")}`);
        seen[name] = "walking";
        for (const need of specs[name]!.needs) walk(need, [...path, name]);
        seen[name] = "done";
    };
    for (const name of Object.keys(specs)) walk(name, []);
}
