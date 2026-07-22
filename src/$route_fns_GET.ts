// GET / — home page: list registered functions and routes.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const fnRows: string[] = [];
    walk((ctx.state as any).registry, [], fnRows);
    const routeRows = Object.entries(ctx.routes).flatMap(([path, methods]) =>
        Object.keys(methods).map(m => `<tr><td class="pr-4 font-mono text-xs">${m}</td><td class="font-mono text-xs">${path}</td></tr>`));
    return {
        title: "home",
        main: `<h1 class="text-xl font-semibold mb-4">procs</h1>
<h2 class="font-semibold mt-6 mb-2">routes</h2>
<table>${routeRows.join("")}</table>
<h2 class="font-semibold mt-6 mb-2">functions (ctx.fns)</h2>
<div class="font-mono text-xs leading-5">${fnRows.join("<br>")}</div>`,
    };
}

function walk(obj: any, path: string[], out: string[]) {
    for (const k of Object.keys(obj).sort()) {
        const v = obj[k];
        if (typeof v === "function") out.push(["ctx.fns", ...path, k].join("."));
        else if (v && typeof v === "object") walk(v, [...path, k], out);
    }
}
