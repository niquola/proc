// Every ACP call goes through here, so the timeout budget lives in one table
// instead of being repeated at six call sites. Turn-shaped calls (prompt,
// cancel, mode/config switches) get no timeout — they are as long as the agent
// takes, and racing them would abandon a live turn.
export default async function (ctx: Context, _session: Session | null, opts: { method: string; params: any; acp?: any; ms?: number }) {
    const acp = opts.acp ?? ctx.state.agent?.acp;
    if (!acp) throw new Error("agent is not running");

    const config = ctx.fns.config.resolve({ module: "agent" }) as ConfigOf<typeof import("./$config").default>;
    const budget: Record<string, number> = {
        initialize: config.initTimeoutMs,
        newSession: config.initTimeoutMs,
        loadSession: config.initTimeoutMs,
        closeSession: config.closeTimeoutMs,
    };
    const ms = opts.ms ?? budget[opts.method] ?? 0;
    const startedAt = Date.now();
    ctx.fns.log.debug({ event: "agent.acp", msg: opts.method, method: opts.method, ms });

    // The timer is cleared in finally — wmlet raced without clearing, so every
    // call left a live 30s timer behind and a timeout abandoned instead of ending.
    let timer: any;
    try {
        const call = acp[opts.method](opts.params);
        if (!ms) return await call;
        return await Promise.race([
            call,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`ACP ${opts.method} timed out after ${ms / 1000}s`)), ms);
            }),
        ]);
    } catch (error: any) {
        ctx.fns.log.warn({ event: "agent.acp.failed", msg: `${opts.method}: ${error?.message ?? error}`, method: opts.method, ms: Date.now() - startedAt });
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
