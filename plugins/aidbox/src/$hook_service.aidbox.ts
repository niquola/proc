// Provider for `"aidbox": {…}` in workspace.json. An external instance
// (AIDBOX_BASE_URL, or `url` in the declaration) is published as-is; otherwise
// Aidbox is brought up from the workdir's compose file on a free port.
//
// The credentials the *app* needs go in `publish` — they belong to the shared
// environment, which is how the app finds Aidbox without any glue. The license
// and the database password go in `env`: they are this container's business and
// nobody else's. Aidbox takes a while to boot, so it says so instead of letting
// a dependent give up at the default minute.
export default async function (ctx: Context, _session: Session | null, opts: { name: string; spec: any }) {
    const { spec } = opts;
    const url = spec.url ?? ctx.env.AIDBOX_BASE_URL;
    if (url) return { url, urlEnv: spec.urlEnv ?? "AIDBOX_BASE_URL" };

    return {
        cmd: ["docker", "compose", "up", spec.service ?? "aidbox"],
        // Aidbox brings its database with it (compose depends_on), so the
        // workspace hands out a port for that too.
        portEnv: spec.portEnv ?? ["AIDBOX_PORT", "AIDBOX_DB_PORT"],
        urlEnv: spec.urlEnv ?? "AIDBOX_BASE_URL",
        publish: {
            AIDBOX_ADMIN_PASSWORD: spec.adminPassword ?? "password",
            AIDBOX_CLIENT_ID: spec.clientId ?? "root",
            AIDBOX_CLIENT_SECRET: spec.clientSecret ?? "secret",
        },
        env: {
            AIDBOX_LICENSE: spec.license ?? ctx.env.AIDBOX_LICENSE ?? "",
            POSTGRES_PASSWORD: spec.dbPassword ?? "postgres",
        },
        ready: { http: "/health", timeout: 180 },
    };
}
