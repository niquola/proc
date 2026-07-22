// workspace.json in WORKDIR declares what the workspace needs, GitHub-Actions
// style — the name IS the service, whoever can supply it registers a
// `service.<name>` hook:
//   { "services": {
//       "aidbox": {},                                         // just ask for one
//       "aidbox": { "url": "http://localhost:8765" },         // or point at an existing one
//       "app":    { "cmd": ["bun","run","dev"], "portEnv": "PORT" } } }
// A service with `url` is external — nothing is started, the address is just
// published to the others. `portEnv` gets a free port, `urlEnv` gets the
// resulting http://localhost:<port>, and env values may reference either as
// ${NAME}. Missing file → just the dev server.
const DEFAULT = { services: { app: { cmd: ["bun", "run", "dev"], portEnv: "PORT" } } };

export type ServiceSpec = {
    provider?: string;              // resolved by the `service.<provider>` hook
    cmd?: string[]; url?: string; portEnv?: string; urlEnv?: string; env?: Record<string, string>;
    [option: string]: any;          // provider-specific options
};

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ services: Record<string, ServiceSpec> }> {
    const file = `${ctx.fns.project.workdir({})}/workspace.json`;
    return await Bun.file(file).json().catch(() => DEFAULT);
}
