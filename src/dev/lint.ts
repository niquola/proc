// Lint the project's namespace structure. proc maps directories to nested
// ctx.fns namespaces, so two rules must hold or runtime / types / build
// silently diverge:
//   1. Every namespace segment, function name and type name is a valid JS
//      identifier. Non-identifier names (dash, dot, space) emit unquoted into
//      ctx_ns.d.ts and break the WHOLE file, and dots corrupt the build
//      manifest's dotted-key tree.
//   2. A name is EITHER a function OR a namespace, never both. A file x.ts
//      beside a dir x/ makes ctx.fns.<…>.x ambiguous: at runtime the injecting
//      Proxy wraps the function and drops the nested fns; the build silently
//      loses them; genTypes emits a duplicate member. Callable-namespaces
//      can't work with the Proxy, so we forbid the collision outright.
//
//   ctx.fns.dev.lint({})  → { ok, errors }  (logs each error unless silent)
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export default async function (ctx: Context, _session: Session | null, opts?: { silent?: boolean }) {
    const entries = await ctx.fns.project.scan({});
    const errors: string[] = [];
    const fnPaths = new Set<string>();

    for (const e of entries) {
        if (e.kind !== 'fn' && e.kind !== 'type') continue;
        const segs = e.moduleDir === '.' ? [] : e.moduleDir.split('/');
        for (const s of segs) if (!IDENT.test(s)) errors.push(`invalid namespace segment "${s}"  (src/${e.rel}) — must be a valid identifier`);
        if (e.kind === 'fn') {
            if (!IDENT.test(e.runtimeName)) errors.push(`invalid function name "${e.runtimeName}"  (src/${e.rel}) — must be a valid identifier`);
            fnPaths.add([...segs, e.runtimeName].join('.'));
        } else if (!IDENT.test(e.typeName)) {
            errors.push(`invalid type name "${e.typeName}"  (src/${e.rel}) — must be a valid identifier`);
        }
    }

    // fn-vs-namespace collision: a fn whose dotted path is a prefix of another.
    for (const p of fnPaths) {
        for (const q of fnPaths) {
            if (p !== q && q.startsWith(p + '.')) {
                const f = p.replaceAll('.', '/');
                errors.push(`name collision: "${p}" is both a function and a namespace (src/${f}.ts vs src/${f}/…) — rename one`);
                break;
            }
        }
    }

    const uniq = [...new Set(errors)].sort();
    if (uniq.length && !opts?.silent) for (const e of uniq) console.error(`[lint] ✗ ${e}`);
    return { ok: uniq.length === 0, errors: uniq };
}
