// Open a URL in the right pane of the open workspace page: htmx swaps #main and
// pushes the URL, so the chat, the SSE stream and this bridge stay alive.
// Falls back to a full navigation if htmx has not loaded yet.
export default async function (ctx: Context, _session: Session | null, opts: { url: string }) {
    const url = JSON.stringify(opts.url);
    return ctx.fns.page.eval({
        code: `if (!window.htmx) { location.assign(${url}); return ${url}; }
               htmx.ajax("GET", ${url}, { target: "#main", swap: "innerHTML" });
               history.pushState(null, "", ${url});
               return location.pathname + location.search`,
    });
}
