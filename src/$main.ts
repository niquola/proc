export default async function main() {
    const ctx = {
        env: { ...process.env },
        state: { serverStart: Date.now() },
        fns: {} as FnsRegistry,
        routes: {},
    } as unknown as Context;

    const { default: loadFns } = await import("./loadFns");
    await loadFns(ctx);
    await ctx.genTypes(ctx);
    await ctx.fns.http.loadRoutes(ctx);
    await ctx.fns.http.start(ctx);
    if (ctx.env.WATCH) await ctx.fns.dev.watch(ctx); // opt-in: WATCH=1 (для агента основной путь — ctx.fns.dev.def)

    return ctx;
}

if (import.meta.main) {
    const ctx = await main();
    (globalThis as any).ctx = ctx;
}
