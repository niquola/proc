// One user message: the right-aligned bubble of the transcript. Plain text —
// `whitespace-pre-wrap` keeps the newlines the composer sent, no markdown, no
// mentions.
//
// A workspace can hold several people talking to one agent, so a bubble carries
// a name — but only when the transcript actually has more than one author.
// Labelling every message in a conversation with one person in it is noise.
export default function (ctx: Context, _session: Session | null, opts: { message: types.agent.Message; showAuthor?: boolean }): string {
    const at = opts.message.updatedAt || opts.message.at;
    const date = at ? new Date(at) : new Date();
    const safe = Number.isNaN(date.valueOf()) ? new Date() : date;
    const time = `${String(safe.getHours()).padStart(2, "0")}:${String(safe.getMinutes()).padStart(2, "0")}`;
    const author = opts.showAuthor && opts.message.author
        ? `<span class="text-[10px] font-medium text-text-tertiary" ${ctx.fns.ui.attr({ role: "author" })}>${ctx.fns.chat.escape({ text: opts.message.author.name })}</span>`
        : "";

    return `<div class="user-output flex items-end gap-2 max-w-[88%] w-fit ml-auto">
  <div class="flex flex-col gap-1 items-end">
    ${author}
    <div class="user-bubble whitespace-pre-wrap px-3 py-2 text-sm leading-[1.6] border border-border-subtle bg-bg-quaternary text-text-primary rounded-xl rounded-br-sm">${ctx.fns.chat.escape({ text: opts.message.text })}</div>
    <span class="text-[10px] tracking-normal text-text-tertiary"><time datetime="${ctx.fns.chat.escape({ text: at })}">${time}</time></span>
  </div>
</div>`;
}
