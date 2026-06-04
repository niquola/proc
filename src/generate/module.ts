// Scaffold a whole module: a fn + an index route listing it.
//   ctx.fns.generate.module(ctx, { name: "todo" })
export default async function (ctx: Context, opts: { name: string }) {
    const name = opts.name;
    const fn = await ctx.fns.generate.fn(ctx, { module: name, name: "list" });
    const route = await ctx.fns.generate.route(ctx, {
        module: name,
        method: "GET",
        body: `    const items = await ctx.fns.${name}.list(ctx, {});\n    return { title: "${name}", main: \`<h1>${name}</h1><pre>\${JSON.stringify(items, null, 2)}</pre>\` };`,
    });
    return { module: name, fn, route };
}
