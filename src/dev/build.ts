// Production build: freeze the runtime-discovered registry into a static
// import manifest, then Bun.build collapses every namespace + all deps into
// ONE self-contained file (dist/app.js). No src/ scan, no dynamic import, no
// genTypes/watch/repl at boot — just import the registry and serve.
//   ctx.fns.dev.build({})           → dist/app.js
//   bun dist/app.js                 → runs standalone, anywhere
const MAIN_TEMPLATE = `// AUTO-GENERATED prod entry — Bun.build bundles this + everything it imports.
import { makeCtx } from "../../src/$main";
import { defineRootFn } from "../../src/loadFns";
import { registry, rootFns, routeDefs, middlewareDefs, lifecycleDefs, startOrder, configSchemas } from "./manifest";

const ctx = makeCtx();
ctx.env.NODE_ENV = ctx.env.NODE_ENV ?? "production"; // disables /repl, error stacks
ctx.state.registry = registry;                        // static registry — no scan()
ctx.state.configSchemas = configSchemas;              // module config schemas (env-driven in prod)
for (const k of Object.keys(rootFns)) defineRootFn(ctx, k, rootFns[k]);
ctx.routes = {};
for (const r of routeDefs) (ctx.routes[r.path] ??= {})[r.method] = r.handler;
ctx.state.middleware = middlewareDefs
    .map((m) => ({ ...m, segs: m.prefix.split("/").filter(Boolean) }))
    .sort((a, b) => a.segs.length - b.segs.length);

// Run $start hooks in the baked order (db, http, …), $stop in reverse on exit.
ctx.state.lifecycle = { started: [] };
for (const mod of startOrder) {
    const e = lifecycleDefs.find((d) => d.module === mod && d.hook === "start");
    if (!e) continue;
    const st = await e.handler(ctx, null, {});
    if (st && typeof st === "object") Object.assign((ctx.state[mod] ??= {}), st);
    ctx.state.lifecycle.started.push(mod);
}
const stop = async () => {
    for (const mod of [...ctx.state.lifecycle.started].reverse()) {
        const e = lifecycleDefs.find((d) => d.module === mod && d.hook === "stop");
        if (e) try { await e.handler(ctx, null, ctx.state[mod]); } catch {}
    }
    process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log("[prod] booted from bundle — " + routeDefs.length + " routes, " + middlewareDefs.length + " middleware, " + ctx.state.lifecycle.started.length + " started, registry frozen");
`;

export default async function (ctx: Context, _session: Session | null, opts?: { outdir?: string }) {
    // Never ship a bundle with name collisions / invalid names.
    const lint = await ctx.fns.dev.lint({});
    if (!lint.ok) throw new Error(`build aborted — lint failed:\n` + lint.errors.map((e) => "  ✗ " + e).join("\n"));

    const m = await ctx.fns.dev.manifest({ out: ".runtime/build/manifest.ts" });
    await Bun.write(".runtime/build/main.ts", MAIN_TEMPLATE);

    const outdir = opts?.outdir ?? "dist";
    const built = await Bun.build({
        entrypoints: [".runtime/build/main.ts"],
        outdir,
        naming: "app.js",
        target: "bun",
        minify: true,
        sourcemap: "none",
    });
    if (!built.success) throw new Error(built.logs.map((l) => l.message).join("\n"));
    const bytes = Bun.file(outdir + "/app.js").size;
    return { ...m, bundle: outdir + "/app.js", kb: Math.round(bytes / 102.4) / 10, success: true };
}
