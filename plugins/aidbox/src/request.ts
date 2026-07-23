// One call into the Aidbox this workspace supervises. The address and the
// client credentials are whatever the service published for this run, so
// nothing here is configured twice — see $hook_service.aidbox.ts.
export default async function (ctx: Context, _session: Session | null, opts: { path: string; method?: string; body?: any }) {
    const env = { ...(await ctx.fns.services.env({})), ...ctx.env };
    const base = env.AIDBOX_BASE_URL;
    if (!base) throw new Error("no AIDBOX_BASE_URL — is the aidbox service running?");

    const auth = btoa(`${env.AIDBOX_CLIENT_ID}:${env.AIDBOX_CLIENT_SECRET}`);
    const res = await fetch(base + opts.path, {
        method: opts.method ?? "GET",
        headers: { authorization: `Basic ${auth}`, "content-type": "application/json", accept: "application/json" },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        redirect: "manual",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`aidbox ${res.status} ${opts.path}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
}
