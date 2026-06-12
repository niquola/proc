// The module start order. package.json `proc.prod` is a map { module: config }
// — its keys are the system modules; we start them in key order with "http"
// last (so the server only accepts traffic after everything else initialized).
// If proc.prod is absent, every module that has a $start.ts (http last).
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string[]> {
    const projectRoot = ctx.fns.project.projectRoot({});
    let mods: string[];
    try {
        const prod = JSON.parse(await Bun.file(projectRoot + "/package.json").text()).proc?.prod;
        mods = prod ? Object.keys(prod) : await discover(ctx);
    } catch {
        mods = await discover(ctx);
    }
    return mods.sort((a, b) => (a === "http" ? 1 : 0) - (b === "http" ? 1 : 0));
}

async function discover(ctx: Context): Promise<string[]> {
    const entries = await ctx.fns.project.scan({});
    return [...new Set(entries
        .filter((e: any) => e.kind === "lifecycle" && e.hook === "start")
        .map((e: any) => e.moduleDir))];
}
