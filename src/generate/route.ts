// Scaffold a new route file, register it, broadcast reload.
//   ctx.fns.generate.route(ctx, { module: "todo", method: "GET" })            → GET /todo
//   ctx.fns.generate.route(ctx, { module: "todo", path: "$id", method: "GET" }) → GET /todo/:id
export default async function (ctx: Context, opts: { module: string; path?: string; method: string; body?: string }) {
    const { module: mod, path = "", method } = opts;
    const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);
    if (!METHODS.has(method)) throw new Error(`bad method: ${method}`);
    if (!/^[a-zA-Z_][\w/]*$/.test(mod)) throw new Error(`bad module: ${mod}`);

    const roots = await ctx.fns.project.roots(ctx);
    const rel = `${mod}/$route_${path}_${method}.ts`;
    const abs = `${roots[0]!.dir}/${rel}`;
    if (await Bun.file(abs).exists()) throw new Error(`already exists: src/${rel}`);

    const routePath = '/' + [...mod.split('/'), ...path.split('_')].filter(Boolean)
        .map(s => s.startsWith('$') ? ':' + s.slice(1) : s).join('/');
    const body = opts.body ?? `    return { title: "${routePath}", main: \`<h1>${routePath}</h1>\` };`;
    const src = `export default async function (ctx: Context, _session: any, req: Request) {\n${body}\n}\n`;
    await Bun.write(abs, src);
    console.log(`[generate] route src/${rel} → ${method} ${routePath}`);

    await ctx.fns.http.loadRoutes(ctx);
    ctx.fns.events.reload(ctx);
    return { created: `src/${rel}`, route: `${method} ${routePath}` };
}
