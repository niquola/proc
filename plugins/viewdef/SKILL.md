---
name: viewdef
description: SQL-on-FHIR ViewDefinitions — write $viewdef_<id>.json, materialize it into the sof schema, and query the flat table with SQL instead of walking FHIR resources. Use when the user asks for a report, a table, a list across many resources, an export, or anything that is easier as SQL than as FHIR search.
---

# ViewDefinition

A **ViewDefinition** flattens one FHIR resource type into a table: `select` +
FHIRPath per column. Aidbox materializes it into the `sof` schema, and from then
on the question is SQL, not resource traversal. Reach for one when the answer
spans many resources or wants grouping, joining or counting — a FHIR search that
you then loop over in TypeScript is usually a view you have not written yet.

The project keeps them as `$viewdef_<id>.json` beside the code that queries the
table. They are data: nothing registers them, `viewdef.local` finds them.

## The shape

```jsonc
// src/reports/$viewdef_patient_demographics.json
{
  "name": "patient_demographics",          // becomes sof.patient_demographics
  "resource": "Patient",
  "select": [{
    "column": [
      { "name": "id",         "path": "getResourceKey()", "type": "string" },
      { "name": "gender",     "path": "gender",           "type": "code" },
      { "name": "birth_date", "path": "birthDate",        "type": "date" }
    ]
  }]
}
```

`name` must be `[a-z0-9_]+` — it is a table name. Nested `select` walks into
arrays (one row per element), `unionAll` stacks alternatives, `forEach` /
`forEachOrNull` control whether a missing branch drops the row.

## Working with them

```sh
.workspace/repl 'await ctx.fns.viewdef.local({})'                       # what the project has
.workspace/repl 'await ctx.fns.viewdef.load({ id: "patient_demographics" })'
.workspace/repl 'ctx.fns.viewdef.columns({ viewdef })'                  # the flat column list
.workspace/repl 'await ctx.fns.viewdef.materialize({ id: "patient_demographics" })'
.workspace/repl 'await ctx.fns.viewdef.rows({ name: "patient_demographics", limit: 10 })'
```

`materialize` PUTs the file into Aidbox and runs `$materialize`, so the file on
disk is the source of truth: edit it, materialize, look. Until you do, the table
is stale or missing — `rows` says so rather than throwing.

Then query it like any table:

```sh
.workspace/repl 'await ctx.fns.aidbox.sql({ sql: "select gender, count(*) from sof.patient_demographics group by 1" })'
```

## Showing the user

The **Views tab** (`/viewdef`) lists them; `/viewdef/view?id=<id>` is one view —
its columns, the first rows of the table, the definition, and a Materialize
button. Opening a `$viewdef_*.json` in the file manager shows the same thing
instead of the JSON. Prefer opening the page over pasting rows into the chat:
`page.open({ url: "/viewdef/view?id=patient_demographics" })`.

## Rules

- A view is a **projection, not a copy** — put the columns a question needs, not
  every field the resource has.
- Materialize after editing, or you are reading yesterday's table.
- `name` is the table; changing it leaves the old table behind in `sof`.
- Do not interpolate values into SQL — `aidbox.sql({ sql, params })` takes `?`
  placeholders.
