// GET /processes/:name/logs — `#service-log` for one service, which is what a
// card asks for when it is clicked (hx-target="#service-log").
//
// The list rides along out of band: selecting a service moves the highlight and,
// more importantly, rewrites the URL the list polls itself with — otherwise the
// next five-second refresh would put the highlight back where it was.
export default function (ctx: Context, _session: Session, opts: { params: { name: string } }) {
    const name = opts.params.name;
    const body = ctx.fns.processes.logs({ name }) + ctx.fns.processes.list({ selected: name, oob: true });
    return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}
