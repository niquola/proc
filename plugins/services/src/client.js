// The services tab's browser half — served at GET /processes/client.js.
//
// Three jobs htmx cannot do: streaming a service's log into the pane, the
// follow toggle, and turning a `{type:"service"}` event into a refresh of the
// live list. Everything else (selection, actions, polling) is htmx attributes.
//
// State arrives as explicit arguments from `hx-on--load` / `hx-on:click`;
// nothing is read back out of the DOM.

(() => {
  if (!window.processes) install();

  // This file is fetched; the markup that calls into it is not, so on the first
  // visit the tab can be on the page before `window.processes` exists and its
  // hx-on--load handlers fire against nothing. Replaying them here makes the
  // order irrelevant; both entry points are idempotent.
  for (const el of document.querySelectorAll("#service-list, #service-log [hx-on--load]")) {
    el.dispatchEvent(new CustomEvent("htmx:load"));
  }

  function install() {
    // The one open log stream: its EventSource, the scroller it writes into, and
    // the follow button that was last handed to `tail`. `#service-log` is
    // replaced whenever another card is selected, so this is replaced with it.
    let current = null;
    let tailing = true;
    const watched = new Set();

    function scrollToBottom(el) {
      el.scrollTop = el.scrollHeight;
    }

    // The follow button lives in the pane header; repaint it whenever tailing
    // changes, whether by click or by the user scrolling away.
    function paintTail() {
      const btn = current && current.btn;
      if (!btn || !btn.isConnected) return;
      const icon = btn.querySelector("i");
      if (icon) icon.className = tailing ? "ph ph-pause text-base" : "ph ph-arrow-down text-base";
      btn.setAttribute("aria-pressed", tailing ? "true" : "false");
    }

    // Streams `GET <url>?from=<seq>` into `el` — the scroller, already holding the
    // server-rendered tail. The ring is the transcript and the stream is a cursor
    // over it, so a reconnect (EventSource resends Last-Event-ID) resumes with no
    // replay buffer here.
    function logs(el, opts) {
      // Same scroller, same stream — a replayed load must not open a second one
      // and append the lines the first is already appending.
      if (current && current.el === el) return;
      if (current) {
        try { current.es.close(); } catch {}
      }
      tailing = true;
      const es = new EventSource(`${opts.url}?from=${opts.from ?? 0}`);
      current = { es, el, btn: null };
      scrollToBottom(el);

      es.onmessage = (event) => {
        let line;
        try { line = JSON.parse(event.data); } catch { return; }
        const div = document.createElement("div");
        div.className = line.stream === "err" ? "text-state-danger-fg" : "text-text-primary";
        div.textContent = line.text;
        el.appendChild(div);
        while (el.childElementCount > 5000) el.removeChild(el.firstElementChild);
        if (tailing) scrollToBottom(el);
      };

      // Scrolling away from the bottom is how you stop a busy log running out
      // from under you — it turns following off by itself.
      el.addEventListener("scroll", () => {
        if (!tailing) return;
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= 40) return;
        tailing = false;
        paintTail();
      });
    }

    // The follow toggle. Mutates only the button it was handed (plus the scroller
    // of the stream that button belongs to).
    function tail(btn) {
      if (current) current.btn = btn;
      tailing = !tailing;
      paintTail();
      if (tailing && current) scrollToBottom(current.el);
    }

    // `#service-list` registers itself on every swap; one document listener turns
    // `{type:"service"}` into a refresh of whichever copies are still on the page.
    function watch(el) {
      watched.add(el);
    }

    document.addEventListener("hyper-events", (event) => {
      if (event.detail?.type !== "service") return;
      for (const el of watched) {
        if (!el.isConnected) {
          watched.delete(el);
          continue;
        }
        htmx.trigger(el, "refresh");
      }
    });

    window.processes = { logs, tail, watch };
  }
})();
