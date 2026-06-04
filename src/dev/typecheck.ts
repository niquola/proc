// Run tsc --noEmit over the project and return diagnostics. The runtime
// (Bun.Transpiler) only STRIPS types — def/sync catch syntax errors but not
// type errors. This is the missing half: call after defining typed code.
//   ctx.fns.dev.typecheck({})            → whole project
//   ctx.fns.dev.typecheck({ filter: "notes/" }) → only matching diagnostics
export default async function (_ctx: Context, _session: Session | null, opts?: { filter?: string }) {
    const proc = Bun.spawn(["bunx", "tsc", "--noEmit", "--pretty", "false"], {
        cwd: import.meta.dir + "/../..",
        stdout: "pipe",
        stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    let lines = out.split('\n').filter(l => l.trim());
    if (opts?.filter) lines = lines.filter(l => l.includes(opts.filter!));
    return { ok: lines.length === 0, errors: lines };
}
