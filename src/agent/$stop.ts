// Lifecycle: take the agent down with the workspace.
export default async function (ctx: Context, _session: Session | null, _state?: any) {
    await ctx.fns.agent.stop({});
}
