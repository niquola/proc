// A plugin function — mounts at ctx.fns.hello.world (namespace "hello" from
// this plugin's package.json). It can call core fns through ctx, just like
// first-party code. (ctx: Context, session, opts) is the same everywhere.
export default function (ctx: Context, _session: Session | null, opts: { name?: string }) {
    return { hello: opts.name ?? "world", from: "plugin", mode: ctx.fns.env.mode() };
}
