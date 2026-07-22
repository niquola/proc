// The chat column's browser half — served at GET /chat/client.js.
//
// Everything htmx can do, htmx does. This file is only what it cannot: pinning
// the transcript to the bottom after a swap, growing the textarea, turning
// Enter into a submit, toggling menus, copying a block, and pulling a queued
// prompt back into the composer.
//
// State arrives as explicit arguments from `hx-on--load` / `hx-on:click` — the
// composer registers itself here on load, so nothing ever reads state back out
// of the DOM.

(() => {
  // The one composer on the page. `compose(form)` fills it in; `edit(btn,{text})`
  // is the only other user, so the queued text never travels through the DOM.
  let composer = null;
  const composed = new WeakSet();
  const menus = new Set();

  // Pins the transcript to the bottom. `#chat` is replaced outerHTML on every
  // agent event, so this runs once per swap, on the fresh element.
  function scroll(el) {
    el.scrollTop = el.scrollHeight;
    // Late layout (fonts, highlighted code, images) moves the bottom; chase it
    // once on the next frame.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  // Wires the composer form: autosize 6rem→12rem, Enter sends, Shift+Enter
  // newlines, and the send button follows emptiness. `#composer` is never
  // swapped, so this runs once — the guard covers a stray second htmx:load.
  function compose(form) {
    if (composed.has(form)) return;
    const text = form.elements.namedItem("text");
    if (!text) return;
    composed.add(form);

    const resize = () => {
      text.style.height = "auto";
      text.style.height = `${Math.min(Math.max(text.scrollHeight, 96), 192)}px`;
    };

    // The send button lives in the `#send` island, which is swapped out-of-band
    // on every response — look it up per sync instead of holding a stale node.
    const sync = () => {
      resize();
      const send = form.querySelector('[data-action="send"]');
      if (!send) return;
      const hasText = text.value.trim().length > 0;
      send.disabled = !hasText;
      send.setAttribute("aria-disabled", hasText ? "false" : "true");
    };

    composer = { form, text, sync };

    text.addEventListener("input", sync);
    text.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      form.requestSubmit();
    });
    // htmx has posted the prompt; the transcript already shows it, so empty the
    // box and shrink it back down.
    form.addEventListener("htmx:afterRequest", (event) => {
      if (event.target !== form) return;
      if (event.detail && event.detail.successful === false) return;
      text.value = "";
      sync();
    });

    // The #send island is swapped out of band whenever the status changes, and
    // the fresh send button always renders disabled — re-apply emptiness when it
    // lands, so a box that was filled while the agent ran can still be sent.
    form.addEventListener("htmx:load", sync);

    sync();
    text.focus();
  }

  // A trigger plus a panel: click toggles this panel, closes the others, and a
  // click anywhere outside closes them all.
  function menu(el) {
    if (menus.has(el)) return;
    const trigger = el.firstElementChild;
    const panel = el.lastElementChild;
    if (!trigger || panel === trigger) return;
    menus.add(el);
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      closeMenus(el);
      panel.classList.toggle("hidden");
    });
  }

  function closeMenus(keep) {
    for (const el of menus) {
      if (!el.isConnected) {
        menus.delete(el);
        continue;
      }
      if (el === keep) continue;
      el.lastElementChild.classList.add("hidden");
    }
  }

  // Copies the text the server rendered. It arrives as an argument — the block
  // is not read back out of the DOM.
  function copy(btn, opts) {
    const text = opts && opts.text;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const icon = btn.querySelector("i");
      if (!icon) return;
      const previous = icon.className;
      icon.className = "ph ph-check";
      setTimeout(() => {
        icon.className = previous;
      }, 900);
    });
  }

  // Pull a queued prompt back into the composer. The row's own `hx-delete`
  // removes it from the queue right after this returns.
  function edit(opts) {
    if (!composer) return;
    composer.text.value = opts.text;
    composer.sync();
    composer.text.focus();
  }

  document.addEventListener("click", (event) => {
    for (const el of menus) {
      if (!el.isConnected) {
        menus.delete(el);
        continue;
      }
      if (el.contains(event.target)) continue;
      el.lastElementChild.classList.add("hidden");
    }
  });

  window.chat = { scroll, compose, toggleMenu: menu, menu, copy, edit };
})();
