// The browser half of driving the workspace — served at GET /page/client.js and
// loaded by the layout, so `window.page` exists on every page.
//
// Everything the workspace does to the open tab resolves an element the same
// way: by the data-* markers ui/attr.ts emits, never by a CSS selector. One
// resolver here means a restyle cannot break the agent, and the catalogue
// `state()` returns is built by that same resolver — so anything it reports is
// something the workspace can actually act on. That is the whole contract: ask
// what is on screen, act on what came back.
//
// The cursor is not decoration. When the workspace clicks something on the
// user's behalf, a pointer flies there and the target lights up, so a person
// watching sees what happened instead of the page changing under them.

(() => {
    if (window.page) return;

    const sel = (name, value) => "[data-" + name + "=" + JSON.stringify(String(value)) + "]";
    const textOf = el => (el?.innerText ?? el?.textContent ?? "").trim().replace(/\s+/g, " ");

    // ── resolving a descriptor ────────────────────────────────────────────────
    // Precedence, most specific first. `entity` narrows an action to one row;
    // `form` narrows a field to one form. A miss throws with the selector it
    // tried, which is the only useful thing to say.
    function find(d) {
        if (d.form && d.field) {
            const scope = one(sel("form", d.form), "form");
            const control = controlsFor(scope, d.field)[0];
            if (!control) throw new Error("no field " + JSON.stringify(d.field) + " in form " + JSON.stringify(d.form));
            return control;
        }
        if (d.form && d.action) return within(one(sel("form", d.form), "form"), sel("action", d.action), "action");
        if (d.form) return one(sel("form", d.form), "form");
        if (d.action) {
            const scope = d.entity ? entity(d) : document;
            return within(scope, sel("action", d.action) + (d.id && !d.entity ? sel("id", d.id) : ""), "action");
        }
        if (d.entity) return entity(d);
        if (d.role) return one(sel("role", d.role), "role");
        throw new Error("need {entity} | {action} | {form} | {role}, got " + JSON.stringify(d));
    }

    function entity(d) {
        return one(sel("entity", d.entity) + (d.id ? sel("id", d.id) : ""), "entity");
    }

    function one(selector, what) {
        const el = document.querySelector(selector);
        if (!el) throw new Error("no " + what + ": " + selector);
        return el;
    }

    function within(scope, selector, what) {
        const el = (scope === document ? document : scope).querySelector(selector) ?? (scope !== document && scope.matches?.(selector) ? scope : null);
        if (!el) throw new Error("no " + what + ": " + selector);
        return el;
    }

    // Fields resolve by native name first, then by the `data-field` marker, then
    // by a formbox question container (a rendered Questionnaire names its inputs
    // `fb[answer][<linkId>][value]`, which nobody wants to type).
    function controlsFor(scope, name) {
        const byName = [...scope.querySelectorAll("[name=" + JSON.stringify(name) + "], [name=" + JSON.stringify(name + "[]") + "]")];
        if (byName.length) return byName;
        const marked = [...scope.querySelectorAll(sel("field", name))];
        if (marked.length) return marked;
        const question = scope.querySelector("[data-fb-question=" + JSON.stringify(name) + "], [data-linkid=" + JSON.stringify(name) + "]");
        if (question) return [...question.querySelectorAll("select, textarea, input:not([type=hidden])")];
        return [];
    }

    function fieldNames(scope) {
        const names = new Set();
        for (const el of scope.querySelectorAll("[name]")) if (el.name && !/^fb\[/.test(el.name) && el.type !== "hidden") names.add(el.name);
        for (const el of scope.querySelectorAll("[data-field]")) names.add(el.dataset.field);
        for (const el of scope.querySelectorAll("[data-fb-question], [data-linkid]")) names.add(el.dataset.fbQuestion ?? el.dataset.linkid);
        return [...names];
    }

    // ── what is on the screen ────────────────────────────────────────────────
    // Only the right pane is reported. The chat is the other half of the window
    // and it is full of its own markers; an agent asking what is on screen means
    // the page it is driving, not the transcript of its own conversation.
    function state() {
        const pane = document.querySelector("#main") ?? document;
        return {
            url: location.pathname + location.search,
            title: document.title,
            page: pane.querySelector?.("[data-page]")?.dataset.page ?? pane.querySelector?.("h1")?.textContent?.trim() ?? null,
            tabs: [...document.querySelectorAll("#tabs .ui-tab")].map(t => ({ tab: t.getAttribute("href")?.slice(1), label: textOf(t), active: t.classList.contains("is-active") })),
            entities: [...pane.querySelectorAll("[data-entity]")].map(el => ({
                entity: el.dataset.entity,
                id: el.dataset.id ?? null,
                status: el.dataset.status ?? null,
                text: textOf(el).slice(0, 120),
                fields: Object.fromEntries([...el.querySelectorAll("[data-role]")].map(r => [r.dataset.role, textOf(r).slice(0, 120)])),
                href: el.tagName === "A" ? el.getAttribute("href") : el.querySelector("a[href]")?.getAttribute("href") ?? null,
            })),
            actions: [...pane.querySelectorAll("[data-action]")].map(el => ({
                action: el.dataset.action,
                id: el.dataset.id ?? el.closest("[data-entity]")?.dataset.id ?? null,
                entity: el.closest("[data-entity]")?.dataset.entity ?? null,
                text: textOf(el).slice(0, 60),
            })),
            forms: [...pane.querySelectorAll("[data-form]")].map(el => ({ form: el.dataset.form, fields: fieldNames(el) })),
        };
    }

    // ── the cursor, the highlight and the caption ────────────────────────────
    let pointer, ring, caption, fade;

    function chrome() {
        if (pointer) return;
        pointer = document.createElement("div");
        pointer.id = "page-pointer";
        pointer.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6 1.5L10 19z" fill="#1c1917" stroke="#fff" stroke-width="1.2"/></svg>`;
        ring = document.createElement("div");
        ring.id = "page-ring";
        caption = document.createElement("div");
        caption.id = "page-caption";
        for (const el of [pointer, ring, caption]) { el.style.opacity = "0"; document.body.appendChild(el); }
    }

    // Fly the pointer to an element, light it up, and leave both visible long
    // enough to be seen. Off-screen targets are scrolled to first — pointing at
    // something nobody can see is worse than not pointing.
    async function moveTo(el, opts = {}) {
        chrome();
        const box = () => el.getBoundingClientRect();
        if (box().top < 8 || box().bottom > innerHeight - 8) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            await new Promise(r => setTimeout(r, 320));
        }
        const r = box();
        pointer.style.left = Math.round(r.left + Math.min(r.width * 0.5, 40)) + "px";
        pointer.style.top = Math.round(r.top + Math.min(r.height * 0.5, 18)) + "px";
        Object.assign(ring.style, { left: Math.round(r.left - 4) + "px", top: Math.round(r.top - 4) + "px", width: Math.round(r.width + 8) + "px", height: Math.round(r.height + 8) + "px" });
        pointer.style.opacity = "1";
        ring.style.opacity = "1";
        clearTimeout(fade);
        fade = setTimeout(hide, opts.holdMs ?? 2600);
        await new Promise(r => setTimeout(r, opts.delay ?? 550));
        return r;
    }

    function hide() {
        for (const el of [pointer, ring, caption]) if (el) el.style.opacity = "0";
    }

    function pulse() {
        if (!ring) return;
        ring.animate([{ transform: "scale(1)" }, { transform: "scale(0.96)" }, { transform: "scale(1)" }], { duration: 260 });
    }

    // A caption anchored under whatever is being pointed at: the narration half
    // of a tour. Without it the pointer moves and the user has to guess why.
    async function say(opts) {
        chrome();
        const el = opts.entity || opts.action || opts.form || opts.role ? find(opts) : null;
        if (el) await moveTo(el, { delay: 0, holdMs: opts.ms ?? 4000 });
        const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 160, bottom: 80, width: 320 };
        caption.textContent = opts.text;
        caption.style.opacity = "1";
        caption.style.left = Math.round(Math.max(12, Math.min(r.left, innerWidth - 380))) + "px";
        caption.style.top = Math.round(Math.min(r.bottom + 10, innerHeight - 80)) + "px";
        clearTimeout(fade);
        fade = setTimeout(hide, opts.ms ?? 4000);
        return { said: opts.text };
    }

    // ── the verbs ────────────────────────────────────────────────────────────
    window.page = {
        state,
        find: d => { const el = find(d); return { tag: el.tagName.toLowerCase(), text: textOf(el).slice(0, 120) }; },

        async point(d) {
            const el = find(d);
            await moveTo(el, d);
            return { pointed: d, tag: el.tagName.toLowerCase(), text: textOf(el).slice(0, 120) };
        },

        say,

        async click(d) {
            const el = find(d);
            if (d.show !== false) { await moveTo(el, d); pulse(); }
            el.click();
            return { clicked: d, tag: el.tagName.toLowerCase(), href: el.getAttribute?.("href") ?? null };
        },

        // Follow an entity's own link rather than clicking it, so a row that is a
        // link and a row that merely contains one behave the same.
        async open(d) {
            const row = entity(d);
            const link = row.tagName === "A" ? row : row.querySelector("a[href]");
            if (!link) throw new Error("no link inside " + JSON.stringify(d));
            if (d.show !== false) { await moveTo(link, d); pulse(); }
            link.click();
            return { opened: link.getAttribute("href") };
        },

        async fill(d) {
            const scope = one(sel("form", d.form), "form");
            const filled = [], missing = [];
            for (const [name, value] of Object.entries(d.values)) {
                const controls = controlsFor(scope, name);
                if (!controls.length) { missing.push(name); continue; }
                const control = controls.length > 1 && controls[0].type === "radio"
                    ? controls.find(c => c.value === String(value)) ?? controls[0]
                    : controls[0];
                if (d.show !== false) await moveTo(control, { delay: 220, holdMs: 1600 });
                if (control.type === "checkbox" || control.type === "radio") control.checked = control.type === "radio" ? true : !!value;
                else control.value = String(value);
                control.dispatchEvent(new Event("input", { bubbles: true }));
                control.dispatchEvent(new Event("change", { bubbles: true }));
                filled.push(name);
            }
            return { form: d.form, filled, missing, fields: missing.length ? fieldNames(scope) : undefined };
        },

        async submit(d) {
            const anchor = one(sel("form", d.form), "form");
            const form = anchor.tagName === "FORM" ? anchor : anchor.closest("form") ?? anchor.querySelector("form");
            if (!form) throw new Error("no <form> at " + sel("form", d.form));
            const button = form.querySelector("button[type=submit], [type=submit], button:not([type])");
            if (d.show !== false) { await moveTo(button ?? form, d); pulse(); }
            if (button) button.click(); else form.requestSubmit();
            return { submitted: d.form };
        },

        // Navigation stays partial: htmx swaps the pane and the URL changes, so
        // the chat, the event stream and this bridge survive. A full load would
        // drop all three.
        async go(d) {
            if (!window.htmx) { location.assign(d.url); return { opened: d.url }; }
            htmx.ajax("GET", d.url, { target: "#main", swap: "innerHTML" });
            history.pushState(null, "", d.url);
            return { opened: d.url };
        },
    };
})();
