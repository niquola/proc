---
name: questionnaire
description: Search the public FHIR Questionnaire library, preview and compare candidates, generate the chosen one into the project as $qr_<slug>.json with its routes, and render a Questionnaire as a real form. Use when the user asks for a form, intake, screener, survey, check-in or patient questionnaire.
---

# Questionnaire

Every user-fillable surface in a project here is a **FHIR Questionnaire**, kept
as `$qr_<id>.json` beside the code that renders it, and rendered server-side
through `@formbox/htmx`. The browser runtime is htmx only — never mount a React
renderer for a patient form.

The human side of all this is the **Questionnaires tab** (`/questionnaire`): the
project's own forms on top, the library search below. Open it rather than
narrating results — `page.open({ url: "/questionnaire?q=depression" })`.

## Search before you write

Someone has almost certainly written this form already, and a LOINC panel
carries codes you would otherwise invent. Search the library first:

```sh
.workspace/repl 'await ctx.fns.questionnaire.search({ query: "depression" })'            # by what it asks
.workspace/repl 'await ctx.fns.questionnaire.search({ query: "PHQ-9", by: "title" })'    # by name
.workspace/repl 'await ctx.fns.questionnaire.search({ query: "44249-1", by: "code" })'   # by LOINC code
```

`by: "item"` (the default) reaches into nested question text, codes and answer
labels — it finds forms whose title says nothing useful. `search` returns
`{ total, results: [{ id, title, publisher, status }] }`.

## The user picks, not you

**If two or more candidates could fit, you must show them and ask.** A result
list is not enough: two forms with near-identical titles ask very different
things. Open the previews and let the user look.

```sh
.workspace/repl 'await ctx.fns.page.open({ url: "/questionnaire/preview?id=44249-1" })'
.workspace/repl 'await ctx.fns.page.open({ url: "/questionnaire/compare?ids=44249-1,48542-5" })'
```

Preview fetches the candidate on the fly and saves nothing — no file, no Aidbox
write. Only after the user names one should anything be written.

How to choose, once you are looking at them: prefer a form whose content *is*
the task over one where it is a small section of a huge panel; prefer
LOINC/Regenstrief over openEHR (openEHR carries `openehr`/`template` extensions
you would have to strip); prefer narrow, predictable forms over demo ones; and
read the actual items — `type`, `required`, codes — before committing.

## Reading and rendering

```sh
# the project's own forms: { id, title, file, status, items }
.workspace/repl 'await ctx.fns.questionnaire.local({})'

# one Questionnaire, by id — the project answers first, the library second
.workspace/repl 'await ctx.fns.questionnaire.load({ id: "phq9" })'
.workspace/repl 'await ctx.fns.questionnaire.load({ id: "44249-1" })'
.workspace/repl 'await ctx.fns.questionnaire.load({ url: "https://…/Questionnaire/x" })'

# render it: { main, form, response, processResult }
.workspace/repl 'const q = await ctx.fns.questionnaire.load({ id: "44249-1" });
                 (await ctx.fns.questionnaire.render({ questionnaire: q, readOnly: true })).form.length'
```

An id means the project's form when the project has one by that name, so
`/questionnaire/preview?id=<id>` is the link for both a local form and a library
candidate. `file` stays for pointing at an exact path.

`render({ questionnaire, submitUrl, response?, readOnly?, formName?, formData? })`
is the one render path. Pass `formData` from a POST to run the answers back
through the renderer: `response` comes back as a QuestionnaireResponse and
validation errors come back attached to the fields that caused them. Pass
`response` to prefill. The markup carries `data-form="<formName>"`, so
`page.fill`/`page.submit` can drive it.

## Showing it to the user

The tab is drivable, so show rather than describe. The search page keeps its
whole state in the URL, and every result is addressable:

```sh
.workspace/repl 'await ctx.fns.page.open({ url: "/questionnaire?q=depression" })'
.workspace/repl 'await ctx.fns.page.state({})'                       # what is on screen now
.workspace/repl 'await ctx.fns.page.say({ text: "11 questions, LOINC-coded", entity: "questionnaire", id: "44249-1" })'
.workspace/repl 'await ctx.fns.page.open({ entity: "questionnaire", id: "44249-1" })'
```

Markers this plugin emits: pages `questionnaires` / `questionnaire` / `compare`;
entity `questionnaire` + the form's id on every project form and every search
hit; actions `search`, `compare`, `generate`; forms `qr-search` (fields `q`,
`by`), `qr-compare`, `qr-generate` (field `slug`). A rendered form is
`data-form="<formName>"` and its items fill by `linkId`. See `docs/ui.md`.

## Adding a form to a project

Once the user has chosen, the generator writes it — never hand-write the routes:

```sh
.workspace/repl 'await ctx.fns.questionnaire.generate({ slug: "phq9", id: "44249-1" })'
```

Three files land next to the app's code and the routes are live immediately, no
restart:

| file | is |
|---|---|
| `src/patients/$qr_phq9.json` | the definition — edit this, not the routes |
| `src/patients/$route_$id_phq9_GET.ts` | `GET /app/patients/:id/phq9` — renders it |
| `src/patients/$route_$id_phq9_POST.ts` | the same url — validates, then stores a QuestionnaireResponse against the patient |

`generate({ slug, id | url | file, module? })`. `module` defaults to `patients`,
which is what keys the route on `/:id`. The button on a preview page does the
same thing.

Invalid answers come back as the same form with the errors attached; a valid
submission is PUT to Aidbox and redirects back to the form. Nothing is extracted
into Observations — which items are clinically meaningful is a judgement call,
so decide it deliberately rather than letting a generator guess.

If only part of a library form fits, edit the generated `$qr_*.json` down to the
items you want rather than keeping a 200-question panel.
