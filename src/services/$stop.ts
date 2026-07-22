// Lifecycle: take every service down with the workspace.
export default async function (ctx: Context, _state: any) {
    for (const name of Object.keys(ctx.state.services ?? {})) await ctx.fns.services.stop({ name });
}
