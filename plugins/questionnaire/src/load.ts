// One Questionnaire — by id, or from anywhere by url. One door, so every caller
// downstream (preview, compare, render) treats a project form and a library
// candidate the same way, and every link is `?id=<id>` rather than a file path.
//
// An id is looked for in the project first: the project's own forms are what a
// developer means when they name one, and a library id only wins when nothing
// local answers to it. `file` stays for the generator, which knows the path.
//
// Nothing is written: a library candidate is fetched per request and held only
// long enough to render it, so looking at a form never changes the project.
import { resolve } from "node:path";

const LIBRARY = "https://form-builder.aidbox.app/fhir/Questionnaire";

export default async function (ctx: Context, _session: Session | null, opts: { file?: string; id?: string; url?: string }): Promise<any> {
    const mine = opts.id && !opts.file && !opts.url
        ? (await ctx.fns.questionnaire.local({})).find(q => q.id === opts.id)
        : undefined;
    if (mine) opts = { ...opts, file: mine.file };

    if (opts.file) {
        const workdir = ctx.fns.project.workdir({});
        const path = resolve(workdir, opts.file);
        if (path !== workdir && !path.startsWith(workdir + "/")) throw new Error(`outside the project: ${opts.file}`);
        const resource: any = await Bun.file(path).json();
        if (resource?.resourceType !== "Questionnaire") throw new Error(`${opts.file} is a ${resource?.resourceType ?? "non-FHIR document"}, not a Questionnaire`);
        return resource;
    }
    const url = opts.url ?? `${LIBRARY}/${encodeURIComponent(opts.id ?? "")}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    const resource: any = await res.json();
    if (resource?.resourceType !== "Questionnaire") throw new Error(`${url} is a ${resource?.resourceType ?? "non-FHIR document"}, not a Questionnaire`);
    return resource;
}
