// One chart by id or by file. A chart file is `{ id?, title?, dataSource?, spec }`
// — and a bare Vega-Lite spec is accepted as the whole file, because the smallest
// useful chart should not need a wrapper.
import { basename, resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { id?: string; file?: string }): Promise<any> {
    const workdir = ctx.fns.project.workdir({});
    const file = opts.file ?? (await ctx.fns.chart.local({})).find(c => c.id === opts.id)?.file;
    if (!file) throw new Error(`no chart "${opts.id}" in this project`);

    const path = resolve(workdir, file);
    if (path !== workdir && !path.startsWith(workdir + "/")) throw new Error(`outside the project: ${file}`);
    const raw: any = await Bun.file(path).json();
    const id = raw.id ?? basename(file).replace(/^\$chart_|\.json$/g, "");
    return { id, title: raw.title ?? id, file, dataSource: raw.dataSource, spec: raw.spec ?? raw };
}
