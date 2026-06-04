// Scaffold a new function file, hot-load it, regenerate types.
//   ctx.fns.generate.fn(ctx, { module: "todo", name: "list" })
//   → src/todo/list.ts registered as ctx.fns.todo.list
export default async function (ctx: Context, opts: { module: string; name: string; body?: string }) {
    const { module: mod, name } = opts;
    if (!/^[a-zA-Z_][\w/]*$/.test(mod) || !/^[a-zA-Z_]\w*$/.test(name)) {
        throw new Error(`bad module/name: ${mod}/${name}`);
    }
    const roots = await ctx.fns.project.roots(ctx);
    const rel = `${mod}/${name}.ts`;
    const abs = `${roots[0]!.dir}/${rel}`;
    if (await Bun.file(abs).exists()) throw new Error(`already exists: src/${rel}`);

    const body = opts.body ?? `    return { ok: true };`;
    const src = `export default async function (ctx: Context, opts: any) {\n${body}\n}\n`;
    await Bun.write(abs, src);
    console.log(`[generate] fn src/${rel} → ctx.fns.${mod.replaceAll('/', '.')}.${name}`);

    await ctx.fns.repl.load(ctx, { name: `${mod.replaceAll('/', '.')}.${name}` });
    await ctx.genTypes(ctx);
    return { created: `src/${rel}`, fn: `ctx.fns.${mod.replaceAll('/', '.')}.${name}` };
}
