// What the project asks for: WORKDIR/workspace.json "plugins". The key is the
// namespace and the value is always an object — `git`/`path` say where an
// external one comes from, everything else is that plugin's config (the same
// grammar services use, where a bare name is a request and `cmd`/`url` say how).
//
//   "plugins": {
//     "fhir-viewer": {},                             // platform: by name
//     "billing":     { "git": "https://…/billing" }, // external: a repo
//     "labs":        { "path": "./tools/labs" },     // external: in the project
//     "aidbox":      { "license": "…" }              // core, configured
//   }
//
// Read on the bootstrap path (project/roots imports it directly), so it takes
// the workdir rather than reaching for ctx.fns.
export default async function (_ctx: Context, _session: Session | null, opts: { workdir: string }): Promise<Record<string, Record<string, any>>> {
    const declared = await Bun.file(`${opts.workdir}/workspace.json`).json()
        .then((manifest: any) => manifest.plugins ?? {})
        .catch(() => ({}));
    // A value that is not an object is a typo, not a shape we support.
    return Object.fromEntries(Object.entries(declared).map(([name, spec]) => [name, spec && typeof spec === "object" ? spec as Record<string, any> : {}]));
}
