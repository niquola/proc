// The composer below the transcript — wmlet's `TopicComposer`: the queue bar
// welded to the top of the compose box (`-mb-px`), the textarea, and the control
// row (plan toggle + model + usage ring on the left, send on the right).
//
// `#composer` is never swapped. Everything inside it that the server owns lives
// in its own island (`#queue`, `#chat-controls`, `#send`) and comes back with
// `hx-swap-oob="true"` on every response, so the textarea keeps its text, its
// height and the caret across a swap.
//
// wmlet's CodeMirror editor is gone with the mentions it existed for, so this is
// the plain `<textarea>` from wmlet's own pending-topic composer; `window.chat.compose`
// grows it (6rem→12rem), makes Enter send and Shift+Enter a newline.
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return `<div id="composer" class="shrink-0 px-3 py-3">
${ctx.fns.chat.queue({})}
  <form data-form="chat" method="post" action="/agent/prompt"
    hx-post="/agent/prompt" hx-target="#chat" hx-swap="outerHTML" hx-sync="this:drop"
    hx-on--load="if (event.target === this) window.chat.compose(this)"
    class="ui-compose-box relative">
    <textarea name="text" rows="3" placeholder="Ask anything" autocomplete="off"
      class="block max-h-48 min-h-24 w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-placeholder"></textarea>
    <div class="flex items-center gap-3 px-2 pb-2 min-w-0">
${ctx.fns.chat.controls({})}
${ctx.fns.chat.send({})}
    </div>
  </form>
</div>`;
}
