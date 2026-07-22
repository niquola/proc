// One user message: the right-aligned bubble of the transcript. Plain text —
// `whitespace-pre-wrap` keeps the newlines the composer sent, no markdown, no
// mentions. Single-user workspace, so there is no avatar and no left variant.
export default function (ctx: Context, _session: Session | null, opts: { message: types.agent.Message }): string {
    const at = opts.message.updatedAt || opts.message.at;
    const date = at ? new Date(at) : new Date();
    const safe = Number.isNaN(date.valueOf()) ? new Date() : date;
    const time = `${String(safe.getHours()).padStart(2, "0")}:${String(safe.getMinutes()).padStart(2, "0")}`;
    return `<div class="user-output flex items-end gap-2 max-w-[88%] w-fit ml-auto">
  <div class="flex flex-col gap-1 items-end">
    <div class="user-bubble whitespace-pre-wrap px-3 py-2 text-sm leading-[1.6] border border-border-subtle bg-bg-quaternary text-text-primary rounded-xl rounded-br-sm">${ctx.fns.chat.escape({ text: opts.message.text })}</div>
    <span class="text-[10px] tracking-normal text-text-tertiary"><time datetime="${ctx.fns.chat.escape({ text: at })}">${time}</time></span>
  </div>
</div>`;
}
