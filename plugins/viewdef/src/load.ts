// One ViewDefinition by id, from the project. `resourceType`/`id` are filled in
// so a file that only carries { name, resource, select } is still a resource
// Aidbox will accept.
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { id?: string; file?: string }): Promise<any> {
    const workdir = ctx.fns.project.workdir({});
    const file = opts.file ?? (await ctx.fns.viewdef.local({})).find(v => v.id === opts.id)?.file;
    if (!file) throw new Error(`no ViewDefinition "${opts.id}" in this project`);

    const path = resolve(workdir, file);
    if (path !== workdir && !path.startsWith(workdir + "/")) throw new Error(`outside the project: ${file}`);
    const raw: any = await Bun.file(path).json();
    if (!raw?.select) throw new Error(`${file} has no select — not a ViewDefinition`);
    return { resourceType: "ViewDefinition", id: opts.id ?? raw.id, ...raw };
}
