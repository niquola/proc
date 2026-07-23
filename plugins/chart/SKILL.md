---
name: chart
description: Vega-Lite charts declared as $chart_<id>.json — a small SELECT over a materialized SQL-on-FHIR view plus a spec. Use when the user asks for a chart, a graph, a trend, a distribution, a dashboard tile, or "show me the numbers".
---

# Chart

A chart in this project is a file: `$chart_<id>.json`, holding a **Vega-Lite
spec** and the query that feeds it. Nothing registers it — `chart.local` finds
it, the Charts tab draws it, and opening the file in the file manager shows the
chart rather than the JSON.

```jsonc
// src/reports/$chart_patients_by_gender.json
{
  "title": "Patients by gender",
  "dataSource": {
    "sql": "select gender, count(*)::int as patients from sof.patient_demographics group by 1 order by 2 desc"
  },
  "spec": {
    "mark": "bar",
    "encoding": {
      "y": { "field": "gender", "type": "nominal", "sort": "-x", "title": null },
      "x": { "field": "patients", "type": "quantitative" }
    }
  }
}
```

## The shape: a view, then a chart

**Put the FHIR extraction in a ViewDefinition, not in the chart.** The right
shape is two files: `$viewdef_<id>.json` flattens the resources into typed
columns and Aidbox materializes it into `sof.<name>`; `$chart_<id>.json` runs a
small `SELECT` over that table. Never paste
`resource#>>'{value,Quantity,value}'` into a chart's SQL — written there it is
invisible, untyped and used once, and the next chart pastes it again. See the
`viewdef` skill.

A spec may also carry its own `data.values` and no `dataSource` at all, which is
the right thing for a fixed reference line or a hand-made example.

## Parameters

`dataSource.paramNames` names the query-string keys that fill the `?`
placeholders, in order, so one spec serves many pages:

```jsonc
"dataSource": {
  "sql": "select taken_at, value from sof.vitals where patient_id = ? and code = ? order by 1",
  "paramNames": ["patient", "code"]
}
```

`/chart/view?id=vitals&patient=pt-1&code=29463-7`. From code, pass them
directly: `ctx.fns.chart.render({ chart, params: [id, "29463-7"], height: 240 })`
— that is how a chart is embedded in an app page rather than shown in the tab.

## Working with them

```sh
.workspace/repl 'await ctx.fns.chart.local({})'                                  # what the project has
.workspace/repl 'await ctx.fns.chart.load({ id: "patients_by_gender" })'
.workspace/repl 'const c = await ctx.fns.chart.load({ id: "patients_by_gender" });
                 await ctx.fns.chart.data({ chart: c })'                          # the rows, before drawing
```

Check the rows first when a chart looks wrong: `chart.data` returns
`{ rows, error }` and never throws, so an empty chart and a broken query are
distinguishable. A missing `sof.<name>` means the view was never materialized —
`viewdef.materialize` first.

## Showing it

```sh
.workspace/repl 'await ctx.fns.page.open({ url: "/chart" })'                      # all of them, drawn small
.workspace/repl 'await ctx.fns.page.open({ url: "/chart/view?id=patients_by_gender" })'
.workspace/repl 'await ctx.fns.page.say({ text: "one bar per gender", entity: "chart", id: "patients_by_gender" })'
```

Markers: pages `charts` / `chart`; entity `chart` + its id on every drawn chart
and on the "open" link. `docs/ui.md` has the rest.

## Rules

- The theme is applied for you — a bare `{ mark, encoding }` already looks right.
  Override it in the spec's own `config` only when there is a reason.
- Width is `"container"` unless the spec sets one: the chart fills the pane.
- Vega is fetched the first time a chart is drawn, not on every page.
- A chart is a projection, like a view: put the columns the question needs in the
  `SELECT`, not everything the table has.
