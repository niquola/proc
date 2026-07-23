// The project's ViewDefinitions. Like a Questionnaire, a ViewDefinition is data
// the scanner never registered: a `$viewdef_<id>.json` next to the code that
// depends on the table it produces.
import { Glob } from "bun";
import { basename } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const workdir = ctx.fns.project.workdir({});
    const out: Array<{ id: string; name: string; resource: string; file: string; columns: number }> = [];
    for await (const file of new Glob("**/$viewdef_*.json").scan({ cwd: workdir, dot: false })) {
        if (file.split("/").some(seg => seg === "node_modules" || seg === ".git")) continue;
        const raw: any = await Bun.file(`${workdir}/${file}`).json().catch(() => null);
        if (!raw?.select) continue;
        const id = raw.id ?? basename(file).replace(/^\$viewdef_|\.json$/g, "");
        out.push({ id, name: raw.name ?? id, resource: raw.resource ?? "?", file, columns: ctx.fns.viewdef.columns({ viewdef: raw }).length });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
