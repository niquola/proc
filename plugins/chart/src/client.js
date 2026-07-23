// The chart plugin's browser half — served at GET /chart/client.js and loaded by
// the layout (a plugin that ships a client.js gets it on every page).
//
// Vega is three big scripts and only this tab needs them, so they are fetched
// the first time a chart is drawn rather than on every page load. Everything
// after that is one call: the fragment hands the spec in as an argument
// (hx-on--load), because state must never be recovered out of the DOM.

(() => {
    if (window.charts) return;

    const CDN = [
        "https://cdn.jsdelivr.net/npm/vega@5",
        "https://cdn.jsdelivr.net/npm/vega-lite@5",
        "https://cdn.jsdelivr.net/npm/vega-embed@6",
    ];
    let loading;

    function vega() {
        if (window.vegaEmbed) return Promise.resolve();
        // In order: vega-lite and vega-embed both expect vega to be there already.
        loading ??= CDN.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
            const el = document.createElement("script");
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error("cannot load " + src));
            document.head.appendChild(el);
        })), Promise.resolve());
        return loading;
    }

    window.charts = {
        // `spec` arrives already themed and already carrying its rows — the server
        // resolved the SQL, so the browser only draws.
        async draw(el, spec) {
            if (el.dataset.drawn) return;                 // htmx:load fires again on re-swap
            el.dataset.drawn = "1";
            try {
                await vega();
                const view = await vegaEmbed(el, spec, { actions: false });
                // Vega measures the container before the pane has settled its width,
                // so a chart drawn during a swap comes out at its default size unless
                // it is told to look again.
                const resize = () => { try { view.view.resize().run(); } catch { /* view gone */ } };
                if (window.ResizeObserver) new ResizeObserver(resize).observe(el);
                addEventListener("resize", resize, { passive: true });
                el.closest("details")?.addEventListener("toggle", resize);
                requestAnimationFrame(resize);
                for (const delay of [50, 250, 600]) setTimeout(resize, delay);
            } catch (error) {
                el.textContent = "chart error: " + (error?.message ?? error);
            }
        },
    };
})();
