// Provider for `"provider": "aidbox"` in workspace.json. An external instance
// (AIDBOX_BASE_URL, or `url` in the declaration) is published as-is; otherwise
// Aidbox is brought up from the workdir's compose file on a free port.
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
        env: {
            AIDBOX_ADMIN_PASSWORD: spec.adminPassword ?? "password",
            AIDBOX_CLIENT_ID: spec.clientId ?? "root",
            AIDBOX_CLIENT_SECRET: spec.clientSecret ?? "secret",
            AIDBOX_LICENSE: spec.license ?? ctx.env.AIDBOX_LICENSE ?? "",
            POSTGRES_PASSWORD: spec.dbPassword ?? "postgres",
            ...(spec.env ?? {}),
        },
    };
}
