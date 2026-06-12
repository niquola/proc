// Build-time equivalent of loadFns/loadRoutes. proc's dev mode discovers the
// registry at runtime via scan() + dynamic import(abs+'?t=...') — un-bundleable
// by design (that's what powers hot-reload). This freezes that discovered
// namespace into an EXPLICIT static import graph the bundler can follow, so
// Bun.build can collapse every module into one file.
//   ctx.fns.dev.manifest({ out: ".runtime/build/manifest.ts" })
export default async function (ctx: Context, _session: Session | null, opts?: { out?: string }) {
    const entries = await ctx.fns.project.scan({});
    const out = opts?.out ?? ".runtime/build/manifest.ts";
    // generated file lives at .runtime/build/manifest.ts → source is ../../src/<rel>
    const rel = (r: string) => "../../src/" + r.replace(/\.ts$/, "");

    const imports: string[] = [];
    const fnTree: Record<string, string> = {};   // 'issues.add' -> localName
    const rootFns: Record<string, string> = {};
    const routeDefs: string[] = [];
    let n = 0;

    for (const e of entries) {
        if (e.kind === "fn") {
            const local = "f" + (n++);
            imports.push(`import ${local} from "${rel(e.rel)}";`);
            if (e.moduleDir === ".") rootFns[e.runtimeName] = local;
            else fnTree[e.moduleDir.replaceAll("/", ".") + "." + e.runtimeName] = local;
        } else if (e.kind === "route") {
            const local = "r" + (n++);
            imports.push(`import ${local} from "${rel(e.rel)}";`);
            routeDefs.push(`  { method: ${JSON.stringify(e.method)}, path: ${JSON.stringify(e.routePath)}, handler: ${local} },`);
        }
        // $type_ → types only, irrelevant at runtime; $script_ → Later (pre-bundle assets)
    }

    // nested registry literal from dotted keys
    const reg: any = {};
    for (const [dotted, local] of Object.entries(fnTree)) {
        const segs = dotted.split(".");
        let t = reg;
        for (let i = 0; i < segs.length - 1; i++) t = (t[segs[i]!] ??= {});
        t[segs.at(-1)!] = { __local: local };
    }
    const emit = (o: any, ind = "  "): string =>
        Object.entries(o).map(([k, v]: any) =>
            v.__local ? `${ind}${JSON.stringify(k)}: ${v.__local},`
                : `${ind}${JSON.stringify(k)}: {\n${emit(v, ind + "  ")}\n${ind}},`
        ).join("\n");
    const emitRoot = Object.entries(rootFns).map(([k, l]) => `  ${JSON.stringify(k)}: ${l},`).join("\n");

    const src = `// AUTO-GENERATED build manifest — do not edit
${imports.join("\n")}

export const registry: any = {
${emit(reg)}
};
export const rootFns: any = {
${emitRoot}
};
export const routeDefs: any[] = [
${routeDefs.join("\n")}
];
`;
    await Bun.write(out, src);
    return { out, fns: Object.keys(fnTree).length, rootFns: Object.keys(rootFns).length, routes: routeDefs.length };
}
