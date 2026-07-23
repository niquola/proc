// The project's charts. Like a Questionnaire or a ViewDefinition, a chart is
// data the scanner never registered: a `$chart_<id>.json` next to the code that
// shows it.
import { Glob } from "bun";
import { basename } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const workdir = ctx.fns.project.workdir({});
    const out: Array<{ id: string; title: string; file: string; mark: string; sql: string | null }> = [];
    for await (const file of new Glob("**/$chart_*.json").scan({ cwd: workdir, dot: false })) {
        if (file.split("/").some(seg => seg === "node_modules" || seg === ".git")) continue;
        const raw: any = await Bun.file(`${workdir}/${file}`).json().catch(() => null);
        if (!raw) continue;
        const id = raw.id ?? basename(file).replace(/^\$chart_|\.json$/g, "");
        const spec = raw.spec ?? raw;
        out.push({
            id,
            title: raw.title ?? id,
            file,
            mark: typeof spec.mark === "string" ? spec.mark : spec.mark?.type ?? spec.layer ? "layered" : "?",
            sql: raw.dataSource?.sql ?? null,
        });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
}
