// Ask the OS for an unused port by binding to 0, then release it. Racy in
// theory, fine in practice: the child binds it a moment later.
export default function (_ctx: Context, _session: Session | null, _opts?: {}): number {
    const probe = Bun.serve({ port: 0, fetch: () => new Response("") });
    const port = probe.port!;
    probe.stop(true);
    return port;
}
