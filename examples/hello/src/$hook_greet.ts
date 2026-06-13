// $hook_<name>.ts auto-registers under the hook name (id = this plugin). Anyone
// can run it: ctx.fns.hooks.run({ name: "greet", opts: { name } }).
export default function (ctx: Context, _session: Session | null, opts: { name?: string }) {
    return `${opts.name ?? "world"} greeted by the hello plugin (${ctx.fns.env.mode()})`;
}
