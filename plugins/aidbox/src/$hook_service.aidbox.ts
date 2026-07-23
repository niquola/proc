// Provider for `"aidbox": {…}` in workspace.json. An external instance
// (AIDBOX_BASE_URL, or `url` in the declaration) is published as-is; otherwise
// the workspace writes its own compose file and runs Aidbox from that, so a
// project that merely asks for Aidbox needs no compose file, no .env and no port
// numbers of its own.
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

    const { file } = await ctx.fns.aidbox.writeCompose({});

    return {
        // `up` without a service name so the database comes along; --remove-orphans
        // clears containers left by an earlier shape of this file.
        cmd: ["docker", "compose", "-f", file, "up", "--remove-orphans"],
        // Aidbox brings its database with it, so the workspace hands out a port
        // for that too.
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
            AIDBOX_IMAGE_TAG: spec.tag ?? "edge",
            AIDBOX_FHIR_PACKAGES: spec.packages ?? "hl7.fhir.r4.core#4.0.1",
        },
        ready: { http: "/health", timeout: 180 },
    };
}
