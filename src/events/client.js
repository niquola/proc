(() => {
  if (window.__hyperEventsInstalled) return;
  window.__hyperEventsInstalled = true;

  let es;
  let retryMs = 1000;

  function emitDomEvent(data) {
    document.dispatchEvent(new CustomEvent('hyper-events', { detail: data }));
  }

  // Track the server's start timestamp so a reload broadcast that happens
  // before the page even fully wired up still triggers a refresh, and so
  // we ignore stale `hello` echoes when reconnecting to the same process.
  let serverStart = null;

  function handle(data) {
    emitDomEvent(data);
    if (data?.type === 'hello' && typeof data.serverStart === 'number') {
      if (serverStart !== null && serverStart !== data.serverStart) {
        // Server restarted under us — reload to pick up the new process.
        location.reload();
        return;
      }
      serverStart = data.serverStart;
    }
    if (data?.type === 'reload') {
      location.reload();
    }
  }

  function connect() {
    es = new EventSource('/events');
    es.onmessage = (e) => {
      try { handle(JSON.parse(e.data)); retryMs = 1000; } catch {}
    };
    es.onerror = () => {
      try { es.close(); } catch {}
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 10000);
    };
  }

  connect();
})();
