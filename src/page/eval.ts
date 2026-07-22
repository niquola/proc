// Inject JS into the open workspace page and wait for its result. The code is
// the body of an async function in the tab; the last expression is returned.
export default async function (ctx: Context, _session: Session | null, opts: { code: string; timeoutMs?: number }) {
    const page = (ctx.state.page ??= { nextId: 1, pending: new Map() });
    const id = page.nextId++;

    const answer = new Promise((resolve, reject) => {
        page.pending.set(id, { resolve, reject });
        setTimeout(() => {
            if (!page.pending.delete(id)) return;
            reject(new Error("no page answered — is the workspace UI open in a browser?"));
        }, opts.timeoutMs ?? 10_000);
    });

    ctx.fns.events.emit({ event: { type: "eval", id, code: opts.code } });
    return answer;
}
