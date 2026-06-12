// Production build: freeze the runtime-discovered registry into a static
// import manifest, then Bun.build collapses every namespace + all deps into
// ONE self-contained file (dist/app.js). No src/ scan, no dynamic import, no
// genTypes/watch/repl at boot — just import the registry and serve.
//   ctx.fns.dev.build({})           → dist/app.js
//   bun dist/app.js                 → runs standalone, anywhere
const MAIN_TEMPLATE = `// AUTO-GENERATED prod entry — Bun.build bundles this + everything it imports.
import { makeCtx } from "../../src/$main";
import { defineRootFn } from "../../src/loadFns";
import { registry, rootFns, routeDefs } from "./manifest";

const ctx = makeCtx();
ctx.env.NODE_ENV = ctx.env.NODE_ENV ?? "production"; // disables /repl, error stacks
ctx.state.registry = registry;                        // static registry — no scan()
for (const k of Object.keys(rootFns)) defineRootFn(ctx, k, rootFns[k]);
ctx.routes = {};
for (const r of routeDefs) (ctx.routes[r.path] ??= {})[r.method] = r.handler;
await ctx.fns.http.start({});
console.log("[prod] booted from bundle — " + routeDefs.length + " routes, registry frozen, no src scan");
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
