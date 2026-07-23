// The Set-Cookie for a session, and for ending one. HttpOnly so a page script
// cannot read it, SameSite=Lax so a link from elsewhere still works but a form
// posted from elsewhere does not, Secure whenever this is not localhost.
export default function (_ctx: Context, _session: Session | null, opts: { token?: string; url: string; days?: number }): string {
    const cookies = new Bun.CookieMap();
    cookies.set({
        name: "workspace_session",
        value: opts.token ?? "",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(opts.url),
        maxAge: opts.token ? (opts.days ?? 30) * 86400 : 0,
    });
    return cookies.toSetCookieHeaders()[0]!;
}
