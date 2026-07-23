// The project's own forms. A Questionnaire lives next to the code that uses it
// as `$qr_<id>.json` — the convention the old workspace template and its
// generator established — so finding them is a glob over WORKDIR, not a
// registry: they are data, and the scanner never registered them.
import { Glob } from "bun";
import { basename } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const workdir = ctx.fns.project.workdir({});
    const out: Array<{ id: string; title: string; file: string; status?: string; items: number }> = [];
    for await (const file of new Glob("**/$qr_*.json").scan({ cwd: workdir, dot: false })) {
        if (file.split("/").some(seg => seg === "node_modules" || seg === ".git")) continue;
        const resource: any = await Bun.file(`${workdir}/${file}`).json().catch(() => null);
        if (resource?.resourceType !== "Questionnaire") continue;
        out.push({
            id: resource.id ?? basename(file).replace(/^\$qr_|\.json$/g, ""),
            title: resource.title ?? resource.name ?? basename(file),
            file,
            status: resource.status,
            items: count(resource.item),
        });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
}

// Questions, not groups: a form's size is how much the user has to answer.
function count(items: any[] = []): number {
    return items.reduce((n, item) => n + (item.type === "group" ? count(item.item) : 1), 0);
}
