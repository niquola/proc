// One agent text block: the rendered markdown of a `kind:"text"` message.
// The transcript groups consecutive agent messages into a turn and stamps the
// timestamp, so this is only the prose island — same classes wmlet's
// AssistantBlock carries, so the `md-preview` rules in $layout.ts and the
// typography plugin style it identically.
export default function (ctx: Context, _session: Session | null, opts: { message: types.agent.Message }): string {
    const html = ctx.fns.chat.markdown({ text: opts.message.text ?? "" });
    if (!html.trim()) return "";
    return `<div class="text-text-primary text-sm prose prose-sm max-w-none md-preview" data-assistant-block="message">${html}</div>`;
}
