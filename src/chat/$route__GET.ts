// GET /chat — one fetch refreshes the whole chat column. The transcript comes
// first because every caller targets `#chat` with `outerHTML`; the islands that
// live outside it (header, queue, controls, send) follow as `hx-swap-oob`, so
// they ride along in the same swap. This is also what the layout fetches on a
// `{type:"agent"}` event, without HX-Request — hence the explicit Response, a
// bare string would come back wrapped in the whole page.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return ctx.fns.chat.reply({});
}
