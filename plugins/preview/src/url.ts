// The app being previewed: the supervised service's port, unless PREVIEW_URL
// names something else.
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    if (ctx.env.PREVIEW_URL) return ctx.env.PREVIEW_URL;
    const app = (ctx.state.services ?? {}).app;
    return app ? `http://localhost:${app.port}` : "about:blank";
}
