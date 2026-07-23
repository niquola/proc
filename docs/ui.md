# Driving the UI

The workspace has no browser. The runtime is the tab the user already has open,
and everything the workspace does to it goes down one wire: `page.eval` pushes
`{type:"eval", id, code}` over the event stream, the tab runs it as the body of
an async function and posts the result back to `POST /page/result`, where a
pending promise resolves. A few dozen lines, no CDP, no headless Chrome — and in
the cluster there will be no browser to automate either, so this is not a
shortcut, it is the design.

On top of that wire sits one browser-side object, `window.page`
(`src/page/client.js`), and a thin server function per verb (`src/page/*`). The
verbs never touch a CSS selector. They address the screen through the `data-*`
markers a page emits, which is what makes this survive a restyle.

## The convention

`ctx.fns.ui.attr({...})` emits the markers. Seven keys, and each one is a
promise about what the element is:

| key | on what | means |
|---|---|---|
| `page` | the page's root, exactly one | what is on screen — `views`, `questionnaires` |
| `entity` | a row, a card, a tab, a result | a thing, always with an `id` |
| `id` | with `entity`, or on an action | which one. A slug, a path, an id — never an index |
| `status` | an entity that has a state | `running`, `crashed`, `draft` |
| `role` | a cell inside an entity | the value worth reading — `name`, `size`, `state` |
| `form` | a form, or what contains one | addressable by `fill` / `submit` |
| `action` | a control that does something | the **verb**, not the label — `materialize` |

```ts
`<section ${ctx.fns.ui.attr({ page: "views" })}>`
`<a ${ctx.fns.ui.attr({ entity: "viewdef", id: v.id })} href="/viewdef/view?id=${v.id}">`
`<span ${ctx.fns.ui.attr({ role: "columns" })}>${v.columns}</span>`
`<button ${ctx.fns.ui.attr({ action: "materialize", id })}>Materialize</button>`
```

An element without markers is invisible to the workspace, and a marker whose
value wobbles between renders is worse than none — an id must be the same thing
tomorrow. Put the `id` on the action too when it acts on one row, or nest the
action inside that row's element; both let `{action, entity, id}` find it.

## The components

Marking markup by hand works, and it is also how a page ends up half-marked: the
row is an entity but its cells have no roles, the button forgot its verb, the new
page forgot to name itself. So the markers live inside the pieces every page is
made of (`src/ui/`), and a page built from them cannot forget them.

| | renders | carries |
|---|---|---|
| `ui.page({ page, title, lead, main })` | the page shell | `data-page` — one per page |
| `ui.box({ title, right, body, empty })` | a bordered box with a grey strip | — |
| `ui.row({ entity, id, status, href, cells })` | one row of a box | `entity`+`id`+`status`, and a `role` per cell |
| `ui.button({ action, label, entity, id, post, tone })` | a control | `action` (+ what it acts on) |
| `ui.field({ name, value, options, placeholder })` | an input or a select | `field`, and the `name` fill uses |
| `ui.form({ form, body, post, target })` | a form | `form` |
| `ui.notice({ text, tone })` | what went wrong or worked | `role=error` / `role=notice` |
| `ui.badge({ text, tone })` | a small fact | — |

```ts
main: ctx.fns.ui.page({
    page: "views",
    title: "Views",
    lead: `A <span class="font-mono">ViewDefinition</span> flattens resources into a table.`,
    main: ctx.fns.ui.box({
        title: `${views.length} in this project`,
        empty: "none yet",
        body: views.map(v => ctx.fns.ui.row({
            entity: "viewdef", id: v.id, href: `/viewdef/view?id=${v.id}`,
            cells: [
                { role: "name", text: v.name },
                { role: "resource", text: v.resource, class: "w-40 shrink-0 text-2xs text-text-tertiary" },
            ],
        })).join(""),
    }),
})
```

Use them where the thing is the same thing. A rendered Questionnaire, an iframe,
a `<table>` of query results, a `<details>` of raw JSON — those are their own
markup; pass them as `body` or `main` and mark them with `ui.attr` directly.

## Ask before you act

```sh
.workspace/repl 'await ctx.fns.page.state({})'
```

```jsonc
{
  "url": "/questionnaire?q=depression",
  "page": "questionnaires",
  "tabs": [{ "tab": "preview", "label": "Preview", "active": false }, …],
  "entities": [{ "entity": "questionnaire", "id": "44249-1", "text": "PHQ-9 …",
                 "fields": { "publisher": "Regenstrief" }, "href": "/questionnaire/preview?id=44249-1" }],
  "actions": [{ "action": "compare", "text": "Compare selected" }],
  "forms":   [{ "form": "qr-search", "fields": ["q", "by"] }]
}
```

Only the right pane is reported — the chat is the other half of the window and
full of its own markers. The catalogue is built by the **same resolver the verbs
use**, so every name in it is one the workspace can act on, and a name that is
not in it will not work. That is the point: look, then act, instead of guessing
at selectors.

## The verbs

```sh
# navigate — a plugin page keeps its whole state in the URL, so this is usually enough
.workspace/repl 'await ctx.fns.page.open({ url: "/questionnaire?q=tobacco" })'
.workspace/repl 'await ctx.fns.page.open({ entity: "questionnaire", id: "44249-1" })'   # follow the row's own link
.workspace/repl 'await ctx.fns.page.openTab({ plugin: "viewdef" })'

# point at something without touching it, and say what it is
.workspace/repl 'await ctx.fns.page.point({ action: "materialize" })'
.workspace/repl 'await ctx.fns.page.say({ text: "this rebuilds the table", action: "materialize" })'

# act
.workspace/repl 'await ctx.fns.page.click({ action: "turn-off", entity: "plugin", id: "questionnaire" })'
.workspace/repl 'await ctx.fns.page.fill({ form: "qr-search", values: { q: "tobacco" } })'
.workspace/repl 'await ctx.fns.page.submit({ form: "qr-search" })'

# read
.workspace/repl 'await ctx.fns.page.text({ selector: "#qr-results" })'
```

Every acting verb moves a pointer to its target and lights it up first, so a
person watching sees what happened rather than a page changing by itself. Pass
`show: false` when that is noise — a fill of twenty fields, a click inside a
loop.

Fields resolve by input `name`, then by `data-field`, then — inside a rendered
Questionnaire — by the item's `linkId`, so nobody has to know that formbox names
its inputs `fb[answer][…][value]`. A name that resolves to nothing comes back in
`missing` along with the names that do exist.

## Tours

A tour is a list of steps run against the page the user is looking at. Narration
is a step like any other, because a pointer that moves while nothing explains
why is just a page twitching.

```sh
.workspace/repl <<'EOF'
await ctx.fns.page.tour({ steps: [
  { open: "/questionnaire", say: "Every form in this project is a FHIR Questionnaire" },
  { open: "/questionnaire?q=depression", say: "Search the public library before writing one" },
  { say: "This is the PHQ-9 — 11 questions", entity: "questionnaire", id: "44249-1" },
  { click: { entity: "questionnaire", id: "44249-1" }, say: "Opening it renders the real form" },
  { say: "Nothing is written until this", action: "generate" },
]})
EOF
```

A step may both act and narrate: the act happens, then the sentence lands on
what it produced. `wait` holds, `fill`/`submit` drive a form, `point` moves the
pointer without pressing anything. A step that fails stops the tour and says
which one — a half-run tour is a lie about what the user just saw.

## Rules

- **Never navigate with a full page load.** `page.open` swaps the pane through
  htmx and pushes the URL; a reload drops the chat, the event stream and this
  bridge at once.
- **Prefer a URL to a click.** Plugin pages carry their state in the URL —
  `/questionnaire?q=…`, `/viewdef/view?id=…`, `/filemanager?path=…` — so one
  `open` replaces filling a form and pressing a button, and the user can share
  or reload what they were shown.
- **Ask `page.state` when unsure**, rather than guessing an id from the source.
- **Fill a form yourself only when demonstrating.** A form put in front of a
  person is theirs to submit.
- Only the tab the user is looking at answers: a hidden tab waits, and a tab
  left over from an older version of the page keeps quiet entirely.
