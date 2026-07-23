// What is mounted right now, with each plugin's faces (see $state_plugins.ts).
// loadFns builds these records; this is just the door the agent and the manager
// knock on, so there is one answer and no second scan.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return ctx.state.plugins ?? [];
}
