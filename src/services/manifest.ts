// workspace.json in WORKDIR declares what the workspace needs, GitHub-Actions
// style — the name IS the service, whoever can supply it registers a
// `service.<name>` hook:
//   { "env": { "NODE_ENV": "development" },
//     "services": {
//       "aidbox": { "license": "…" },                 // a request, answered by the hook
//       "aidbox": { "url": "http://localhost:8765" }, // or point at an existing one
//       "app":    { "cmd": "bun run dev", "portEnv": "PORT", "needs": ["aidbox"] } } }
// This function only reads the file and checks its envelope; every default and
// every rule about a declaration lives in `services.resolve`. A declaration is a
// partial spec plus whatever the provider wants (`license`, `adminPassword`, …),
// so unknown keys inside a service are input for the hook and are kept as they
// are — only unknown keys at the top level are a typo worth stopping for.
// Missing file → just the dev server.
const KEYS = ["env", "services"];
const DEFAULT_SERVICES = { app: { cmd: "bun run dev", portEnv: "PORT" } };

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ env: Record<string, string>; services: Record<string, any> }> {
    const file = `${ctx.fns.project.workdir({})}/workspace.json`;
    const text = await Bun.file(file).text().catch(() => null);
    if (text === null) return { env: {}, services: DEFAULT_SERVICES };

    let manifest: any;
    try { manifest = JSON.parse(text); } catch (e: any) { throw new Error(`${file}: invalid JSON — ${e.message}`); }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error(`${file}: expected an object`);

    const unknown = Object.keys(manifest).filter((key) => !KEYS.includes(key));
    if (unknown.length) throw new Error(`${file}: unknown key ${unknown.join(", ")} — expected ${KEYS.join(", ")}`);
    if (manifest.services !== undefined && (typeof manifest.services !== "object" || !manifest.services || Array.isArray(manifest.services))) {
        throw new Error(`${file}: "services" must be an object of name → declaration`);
    }
    const services = manifest.services ?? DEFAULT_SERVICES;
    for (const [name, spec] of Object.entries(services)) {
        if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error(`${file}: service "${name}" must be an object (use {} to just ask for one)`);
    }
    return { env: manifest.env ?? {}, services };
}
