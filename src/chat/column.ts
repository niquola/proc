// The whole left column: the transcript scroller and the composer. There is no
// title bar — wmlet's belongs to a topic, and a workspace has one session.
// The layout embeds this once; after that only `#chat` is ever swapped
// (outerHTML on every `{type:"agent"}` event), so the wrapper around it and the
// composer below it are the stable parents the OOB islands swap into.
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return `<div class="min-w-0 flex-1 flex flex-col overflow-hidden">
  <div class="relative min-h-0 flex-1">
${ctx.fns.chat.transcript({})}
  </div>
${ctx.fns.chat.composer({})}
</div>`;
}
