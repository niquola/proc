// Log module init — resolve config and initialize ctx.state.log.
// Listed first in package.json proc.prod so all other $start hooks can log.
const LEVELS: Record<string, number> = { off: -1, error: 0, warn: 1, info: 2, debug: 3 };

export default function (ctx: Context, _session: Session | null, _config?: any) {
    const config = ctx.fns.config.resolve({ module: "log" });
    ctx.state.log = {
        level: LEVELS[config.level] ?? 2,
        format: config.format ?? "pretty",
        service: config.service ?? "procs",
    };
}
