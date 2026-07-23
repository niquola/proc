// Flatten the select tree into the columns the table will have. A
// ViewDefinition nests selects to walk into arrays, but the result is flat —
// this is the shape a person needs to read, and the header of the preview.
export default function (_ctx: Context, _session: Session | null, opts: { viewdef: any }): Array<{ name: string; path: string; type?: string }> {
    const out: Array<{ name: string; path: string; type?: string }> = [];
    const walk = (select?: any[]) => {
        for (const s of select ?? []) {
            for (const c of s.column ?? []) out.push({ name: c.name, path: c.path ?? c.expression ?? "", type: c.type });
            walk(s.select);
            for (const union of s.unionAll ?? []) walk([union]);
        }
    };
    walk(opts.viewdef?.select);
    return out;
}
