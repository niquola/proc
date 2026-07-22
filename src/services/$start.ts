// Lifecycle: bring the workdir project up with the workspace.
export default async function (ctx: Context, _config: any) {
    await ctx.fns.services.start({});
}
