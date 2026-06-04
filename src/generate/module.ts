// Scaffold a whole module: a fn + an index route listing it.
//   ctx.fns.generate.module({ name: "todo" })
export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const name = opts.name;
    const fn = await ctx.fns.generate.fn({ module: name, name: "list" });
    const route = await ctx.fns.generate.route({
        module: name,
        method: "GET",
        body: `    const items = await ctx.fns.${name}.list({});\n    return { title: "${name}", main: \`<h1>${name}</h1><pre>\${JSON.stringify(items, null, 2)}</pre>\` };`,
    });
    return { module: name, fn, route };
}
