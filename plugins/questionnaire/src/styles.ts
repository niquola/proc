// Formbox questionnaire styling — the #formbox-root CSS layer, ported from the
// old workspace template. Every rendered form carries it inline (a page here can
// arrive as an htmx fragment, which never touches <head>), so this is THE place
// to adjust how Questionnaires look: control sizing, spacing, choice cards,
// collapsibles, tabs, tables and data states. The --fb-* custom properties at
// the top are the design tokens everything below derives from.
export default function (_ctx: Context, _session: Session | null, _opts?: {}): string {
    return `
  #formbox-root {
    --fb-brand: #005fb8;
    --fb-brand-hover: #0258a8;
    --fb-canvas: #f9fafb;
    --fb-content: #ffffff;
    --fb-muted: #f3f4f6;
    --fb-selected: #eff6ff;
    --fb-border: #e5e7eb;
    --fb-border-strong: #d1d5db;
    --fb-text: #111827;
    --fb-muted-text: #4b5563;
    --fb-tertiary-text: #6b7280;
    --fb-placeholder: #9ca3af;
    --fb-focus: #8ab8e6;
    --fb-brand-disabled: #a7c9f3;
    --fb-danger: #cd3131;
    --fb-danger-bg: oklch(96.2% 0.026 25);
    --fb-danger-border: oklch(87% 0.055 25);
    --fb-danger-fg: oklch(42% 0.12 25);
    --fb-inverse: #f9fafb;
    color: var(--fb-text);
  }

  /* ─────────────────────────────  Form shell & rhythm  ───────────────────────── */

  #formbox-root form {
    display: grid;
    gap: 24px;            /* between top-level sections (DESIGN xl) */
    max-width: 760px;
    margin-inline: auto;
  }

  #formbox-root form > h1 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
    color: var(--fb-text);
  }

  #formbox-root form > p {
    max-width: 68ch;
    margin: -12px 0 0;
    color: var(--fb-muted-text);
    line-height: 1.5;
  }

  #formbox-root [data-fb-question],
  #formbox-root [data-fb-group-list],
  #formbox-root form > fieldset {
    display: grid;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Within a section: a calm 20px rhythm between questions (8px section grid gap
     + 12px here). No divider lines — whitespace plus the tight 8px label-to-control
     gap keep each question grouped. */
  #formbox-root [data-fb-question] + [data-fb-question],
  #formbox-root fieldset + [data-fb-question],
  #formbox-root [data-fb-group-list] + [data-fb-group-list] {
    padding-top: 12px;
  }
  /* NOTE: a fieldset as the *second* element (a sub-group) is intentionally NOT
     here. padding-top on a fieldset doesn't push the fieldset down (the legend
     pins to the top) — it pushes the CONTENT below the legend down, which would
     make that group's eyebrow→first-field gap larger than the first sub-group's.
     Spacing ABOVE sibling sub-groups is handled by margin-top further down. */

  /* Top-level sections lean on the 24px form gap alone — no double spacing. */
  #formbox-root form > fieldset + fieldset {
    padding-top: 0;
  }

  /* ──────────────────────────  Labels, sections & help  ─────────────────────── */

  #formbox-root label,
  #formbox-root [data-short-text] {
    color: var(--fb-text);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
  }

  /* ── Group hierarchy by nesting depth ──
     Three distinct levels so the structure reads at a glance (size/weight/color,
     no display dramatics per DESIGN.md):
       • h1 form title    → Headline (set in the form-shell rules)
       • top-level group  → Title: sentence-case, bold (overridden below)
       • nested sub-group → eyebrow: small UPPERCASE, tracked, muted — a quiet
         category label, a clear step below a section header and visibly NOT a
         field label (those stay 0.875rem sentence-case).
     The base legend rule here is the nested/sub-group case; the top-level
     "form > fieldset > legend" override below promotes the outermost group. */
  #formbox-root legend {
    color: var(--fb-muted-text);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Top-level section / page headers (the outermost group's legend) read as
     Titles — the strongest group level, a clear step above both nested sub-group
     eyebrows and the field labels. Sentence-case, not the eyebrow uppercase. */
  #formbox-root form > fieldset > legend {
    color: var(--fb-text);
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: normal;
    text-transform: none;
  }
  /* Space before a section's first question. A <legend> renders specially: its
     own margin is ignored AND the grid row-gap doesn't apply below it (legend and
     the first item touch). So put the whole gap on the first item — and beat the
     [data-fb-question]{padding:0} rule with a matching-attribute selector. */
  #formbox-root form > fieldset > legend + [data-fb-question] {
    padding-top: 12px;
  }
  /* A nested sub-group carries its OWN legend, so a section/page title sitting
     right above it is two stacked headings — give them more air than a title→
     question gap so the page title reads as a clear level above its sub-groups.
     Use margin-top, NOT padding-top: a <fieldset>'s padding-top is ignored by its
     legend, so padding here renders as zero gap — margin moves the whole group. */
  #formbox-root form > fieldset > legend + [data-fb-group-list],
  #formbox-root form > fieldset > legend + fieldset {
    margin-top: 20px;
  }
  /* Nested sub-group eyebrow → its first field: a small gap so the uppercase
     label isn't glued to the input below it (matches nested groups only — two
     fieldset ancestors — so the top-level title keeps its larger 12px gap). */
  #formbox-root fieldset fieldset > legend + [data-fb-question] {
    padding-top: 6px;
  }
  /* Sibling sub-groups: a fieldset's padding-top is swallowed by its own legend,
     so adjacent groups fall back to just the grid gap — the next group's eyebrow
     ends up crowding the previous group's last input. Margin-top (outside the
     border) restores a real group break. Nested only — top-level sections rely on
     the 24px form gap and have no fieldset ancestor, so they're excluded. */
  #formbox-root fieldset [data-fb-question] + fieldset,
  #formbox-root fieldset fieldset + fieldset {
    margin-top: 16px;
  }

  /* Question-number prefix (e.g. "PHQ-9.1") reads as a quiet index, not part of the question. */
  #formbox-root [data-fb-question] > label > span:first-child:not([aria-hidden]),
  #formbox-root legend > span:first-child:not([aria-hidden]) {
    color: var(--fb-tertiary-text);
    font-weight: 500;
  }

  #formbox-root label span[aria-hidden="true"],
  #formbox-root legend span[aria-hidden="true"] {
    margin-left: 2px;
    color: var(--fb-danger);
  }

  #formbox-root label a,
  #formbox-root legend a,
  #formbox-root p a {
    color: var(--fb-brand);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  #formbox-root [data-short-text] > div {
    margin-top: 4px;
    color: var(--fb-tertiary-text);
    font-size: 0.8125rem;
    font-weight: 400;
  }

  /* ──────────────  Text / number / select / date / textarea controls  ────────── */

  #formbox-root input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  #formbox-root select,
  #formbox-root textarea {
    width: 100%;
    min-height: 40px;
    border: 1px solid var(--fb-border-strong);
    border-radius: 8px;
    background-color: var(--fb-content);
    color: var(--fb-text);
    font: inherit;
    line-height: 1.35;
    padding: 8px 12px;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
  }

  #formbox-root input::placeholder,
  #formbox-root textarea::placeholder {
    color: var(--fb-placeholder);
  }

  #formbox-root select {
    appearance: none;
    padding-right: 34px;
    background-image:
      linear-gradient(45deg, transparent 50%, var(--fb-tertiary-text) 50%),
      linear-gradient(135deg, var(--fb-tertiary-text) 50%, transparent 50%);
    background-position:
      calc(100% - 18px) 17px,
      calc(100% - 13px) 17px;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
  }

  #formbox-root textarea {
    min-height: 96px;
    resize: vertical;
  }

  /* Static Questionnaire units (questionnaire-unit extension) render as a label
     after the numeric input. Treat them as an in-field suffix so vitals like
     "120 mm[Hg]" stay on one control line instead of wrapping below. */
  #formbox-root div:has(> input[type="number"][data-fb-field="value"] + [data-fb-unit-label]) {
    position: relative;
  }
  #formbox-root div:has(> input[type="number"][data-fb-field="value"] + [data-fb-unit-label]) > input[data-fb-field="value"] {
    padding-right: 5.25rem;
  }
  #formbox-root div:has(> input[type="number"][data-fb-field="value"] + [data-fb-unit-label]) > [data-fb-unit-label] {
    position: absolute;
    inset-block: 1px;
    right: 12px;
    display: flex;
    max-width: 4.5rem;
    align-items: center;
    overflow: hidden;
    color: var(--fb-tertiary-text);
    font-size: 0.8125rem;
    line-height: 1;
    pointer-events: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Multi-part controls render their parts as siblings in a bare wrapper div —
     lay them on one row instead of stacking: quantity (value + unit select) and
     reference (value + display). Text parts share the width; a unit select sizes
     to content. */
  #formbox-root div:has(> [data-fb-field="unit"]),
  #formbox-root div:has(> [data-fb-field="display"]) {
    display: flex;
    flex-wrap: wrap;          /* lets the "specify other" mini-form drop to its own row */
    gap: 8px;
    align-items: start;
  }

  /* The "specify other" custom-option mini-form (unit / open-choice) is a full
     width row BELOW its control — not squeezed into the value+unit flex row. */
  #formbox-root fieldset:has(> button[value="submit-custom"]) {
    flex-basis: 100%;
    width: 100%;
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0 0;       /* gap above where it wraps onto its own row */
    padding: 0;
    border: 0;
  }
  #formbox-root fieldset:has(> button[value="submit-custom"]) > input {
    flex: 1 1 auto;
    min-width: 0;
  }
  #formbox-root fieldset:has(> button[value="submit-custom"]) > button {
    flex: 0 0 auto;
  }
  /* Scoped to the multi-part wrapper's own children only — never the choice
     checkboxes/radios that also carry data-fb-field="value". */
  #formbox-root div:has(> [data-fb-field="unit"]) > [data-fb-field="value"],
  #formbox-root div:has(> [data-fb-field="display"]) > [data-fb-field="value"],
  #formbox-root div:has(> [data-fb-field="display"]) > [data-fb-field="display"] {
    /* basis 0 (not auto) — the inputs carry width:100% from the base rule, so an
       auto basis would claim a whole line and force the unit to wrap. */
    flex: 1 1 0%;
    min-width: 0;
  }
  #formbox-root div:has(> [data-fb-field="unit"]) > select[data-fb-field="unit"] {
    flex: 0 0 auto;
    width: auto;
    min-width: 144px;
  }

  /* Repeating answer row: text input + its Remove button on one line (input
     grows, Remove sized to content), instead of the button dangling below. */
  #formbox-root div:has(> input[data-fb-field="value"]):has(> button[data-fb-field="remove-action"]) {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  #formbox-root div:has(> input[data-fb-field="value"]):has(> button[data-fb-field="remove-action"]) > input[data-fb-field="value"] {
    flex: 1 1 auto;
    min-width: 0;
  }
  #formbox-root div:has(> input[data-fb-field="value"]):has(> button[data-fb-field="remove-action"]) > button[data-fb-field="remove-action"] {
    flex: 0 0 auto;
  }

  #formbox-root input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):hover:not(:disabled):not([readonly]),
  #formbox-root select:hover:not(:disabled),
  #formbox-root textarea:hover:not([readonly]) {
    border-color: color-mix(in oklch, var(--fb-brand) 35%, var(--fb-border-strong));
  }

  #formbox-root input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):focus,
  #formbox-root select:focus,
  #formbox-root textarea:focus {
    border-color: var(--fb-brand);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--fb-brand) 15%, transparent);
  }

  #formbox-root input[readonly],
  #formbox-root textarea[readonly],
  #formbox-root select:disabled {
    background-color: var(--fb-muted);
    color: var(--fb-muted-text);
  }

  #formbox-root input:disabled,
  #formbox-root textarea:disabled,
  #formbox-root button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  /* ─────────────────  Choice controls — checkbox, radio, option cards  ────────── */

  #formbox-root input[type="checkbox"],
  #formbox-root input[type="radio"] {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--fb-brand);
    flex: 0 0 auto;
  }

  #formbox-root label:has(> input[type="checkbox"]),
  #formbox-root label:has(> input[type="radio"]),
  #formbox-root fieldset[data-orientation] label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 6px 12px;
    border: 1px solid var(--fb-border-strong);
    border-radius: 8px;
    background: var(--fb-content);
    font-weight: 400;
    color: var(--fb-text);
    cursor: pointer;
    transition: border-color 160ms ease, background-color 160ms ease;
  }

  #formbox-root label:has(> input[type="checkbox"]):hover,
  #formbox-root label:has(> input[type="radio"]):hover,
  #formbox-root fieldset[data-orientation] label:hover {
    border-color: color-mix(in oklch, var(--fb-brand) 35%, var(--fb-border-strong));
    background: var(--fb-muted);
  }

  #formbox-root label:has(> input:checked) {
    border-color: var(--fb-brand);
    background: var(--fb-selected);
  }

  /* Inside a matrix table (table/htable) the <td> already bounds the control, so
     the option label must NOT add its own choice-card border/padding/background —
     that would double the boundary. Strip the card and center the radio/checkbox
     in the cell. */
  #formbox-root td label:has(> input[type="radio"]),
  #formbox-root td label:has(> input[type="checkbox"]) {
    min-height: 0;
    padding: 0;
    border: 0;
    background: transparent;
    justify-content: center;
  }
  #formbox-root td label:has(> input[type="radio"]):hover,
  #formbox-root td label:has(> input[type="checkbox"]):hover,
  #formbox-root td label:has(> input:checked) {
    border-color: transparent;
    background: transparent;
  }

  /* Choice groups (radio / checkbox / multi-select) lay their option cards out
     with a gap so they never glue edge-to-edge. Keyed on :has() because the
     renderer doesn't always emit data-orientation (the multi-select fieldset has
     none). Vertical by default; data-orientation="horizontal" wraps to a row. */
  #formbox-root fieldset:has(> label > input[type="radio"]),
  #formbox-root fieldset:has(> label > input[type="checkbox"]),
  #formbox-root fieldset[data-orientation] {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  #formbox-root fieldset[data-orientation="horizontal"] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  #formbox-root input[type="range"] {
    width: 100%;
    accent-color: var(--fb-brand);
  }

  /* ───────────────────────────  Buttons & actions  ──────────────────────────── */

  #formbox-root button {
    min-height: 40px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--fb-brand);
    color: var(--fb-inverse);
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    padding: 8px 14px;
    transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
  }

  #formbox-root button:hover {
    background: var(--fb-brand-hover);
  }

  #formbox-root button:active {
    background: color-mix(in oklch, var(--fb-brand-hover) 88%, var(--fb-text));
  }

  #formbox-root button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--fb-focus) 40%, transparent);
  }

  /* Form footer: the pager (Previous · count) and the submit button share one
     horizontal track. The divider/spacing lives on the footer so the pager
     controls and the submit align on the same baseline. On a single-page form
     the footer holds only the submit, which stays right-aligned under the rule. */
  #formbox-root [data-fb-footer] {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--fb-border);
  }
  /* The pager nav fills the row but no longer owns the divider — the footer does. */
  #formbox-root [data-fb-footer] > nav {
    flex: 1;
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }
  #formbox-root [data-fb-footer] > button[type="submit"] {
    margin-left: auto;
    padding: 8px 20px;
  }

  #formbox-root button[type="submit"]:disabled {
    background: var(--fb-brand-disabled);
    opacity: 1;
  }

  #formbox-root button[data-fb-field="add-action"],
  #formbox-root details summary button {
    border-color: var(--fb-border-strong);
    background: var(--fb-content);
    color: var(--fb-text);
  }

  #formbox-root button[data-fb-field="add-action"]:hover,
  #formbox-root details summary button:hover {
    border-color: var(--fb-brand);
    background: var(--fb-selected);
    color: var(--fb-brand);
  }

  #formbox-root button[data-fb-field="remove-action"] {
    border-color: var(--fb-danger-border);
    background: var(--fb-danger-bg);
    color: var(--fb-danger-fg);
  }

  #formbox-root button[data-fb-field="remove-action"]:hover {
    border-color: var(--fb-danger);
    background: color-mix(in oklch, var(--fb-danger-bg), var(--fb-danger) 14%);
  }

  /* Help / info / legal toggles (the ? i ! markers) are quiet inline glyphs, not
     primary buttons — small neutral circles that brighten to brand on hover. */
  #formbox-root button[type="button"]:not([name]):not([data-fb-field]) {
    min-height: 0;
    width: 18px;
    height: 18px;
    margin-left: 6px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: var(--fb-muted);
    color: var(--fb-tertiary-text);
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 18px;
    vertical-align: middle;
  }
  #formbox-root button[type="button"]:not([name]):not([data-fb-field]):hover {
    background: var(--fb-selected);
    color: var(--fb-brand);
  }

  /* The supplementary text is a custom popover tooltip in the top layer (Popover
     API), shown on hover/focus by the interest-invoker "interestfor" on the
     trigger — fully declarative, no JS. The invoker is the popover's IMPLICIT
     anchor, so CSS Anchor Positioning places it with no anchor-name needed:
     position-area: top centers it above the icon; position-try flips it below
     when there's no room. inset:auto lets position-area override the UA's inset:0.
     The UA hides a closed popover; this is the open look. text-transform/
     letter-spacing reset since the marker often sits inside a legend (uppercase). */
  #formbox-root [data-fb-tip] + [popover] {
    position: fixed;
    position-area: top;
    position-try-fallbacks: flip-block;
    inset: auto;
    width: max-content;
    max-width: 280px;
    margin: 0 0 6px;
    padding: 8px 10px;
    border: 1px solid var(--fb-border);
    border-radius: 8px;
    background: var(--fb-content);
    color: var(--fb-text);
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.45;
    letter-spacing: normal;
    text-transform: none;
    box-shadow: 0 6px 16px -4px color-mix(in oklch, var(--fb-text) 18%, transparent);
  }

  /* File input: restyle the native picker button (no raw gray OS button). The
     field box itself is already covered by the generic input rule above. */
  #formbox-root input[type="file"] {
    padding: 6px 12px;
    color: var(--fb-muted-text);
  }
  #formbox-root input[type="file"]::file-selector-button {
    margin-right: 12px;
    padding: 6px 12px;
    border: 1px solid var(--fb-border-strong);
    border-radius: 6px;
    background: var(--fb-muted);
    color: var(--fb-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
  }
  #formbox-root input[type="file"]::file-selector-button:hover {
    border-color: var(--fb-brand);
    background: var(--fb-selected);
    color: var(--fb-brand);
  }

  /* ──────────────────  Collapsibles, tabs & matrix/grid tables  ──────────────── */

  #formbox-root details {
    border: 1px solid var(--fb-border);
    border-radius: 8px;
    background: var(--fb-content);
  }

  #formbox-root summary {
    cursor: pointer;
    padding: 10px 12px;
    color: var(--fb-muted-text);
    font-weight: 600;
  }

  #formbox-root details > :not(summary) {
    margin: 0 12px 12px;
  }

  /* The tab container is a <section> (not a fieldset/[data-fb-group-list]), so it
     misses the grid-gap rule — its legend, tab bar and panel would touch. Give it
     its own column rhythm so the label isn't glued to the tabs. */
  #formbox-root section:has(> [role="tablist"]) {
    display: grid;
    gap: 10px;
  }

  /* Full-width segmented control: the bar spans the width of the panel it governs,
     and the tabs share that width equally so it's clear they control the whole
     region below — not a stray strip floating over wider content. */
  #formbox-root [role="tablist"] {
    display: flex;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--fb-border);
    border-radius: 10px;
    background: var(--fb-muted);
  }

  /* Idle tabs are flat and quiet; only the active tab lifts to a white segment so
     the selected one is unmistakable (the old style bordered every tab alike). */
  #formbox-root [role="tab"] {
    flex: 1 1 0%;
    min-height: 32px;
    border-color: transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--fb-muted-text);
    font-weight: 500;
    padding: 6px 14px;
    text-align: center;
  }

  /* Idle hover: a soft lift — NOT the brand-blue base button:hover, which left a
     dark-blue background under black text. */
  #formbox-root [role="tab"]:hover {
    background: color-mix(in oklch, var(--fb-content) 55%, transparent);
    color: var(--fb-text);
  }

  #formbox-root [role="tab"][aria-selected="true"] {
    border-color: var(--fb-border);
    background: var(--fb-content);
    color: var(--fb-text);
    box-shadow: 0 1px 2px color-mix(in oklch, var(--fb-text) 12%, transparent);
  }

  /* Panel spacing now comes from the section grid gap above. */
  #formbox-root [role="tabpanel"] {
    margin-top: 0;
  }

  /* Paged questionnaire wizard nav: previous · indicator · next. Without this the
     "N / M" count sits glued to the Next button. */
  #formbox-root nav:has(button[value="page-prev"]),
  #formbox-root nav:has(button[value="page-next"]) {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  #formbox-root nav:has(button[value="page-prev"]) > span,
  #formbox-root nav:has(button[value="page-next"]) > span {
    color: var(--fb-tertiary-text);
    font-size: 0.875rem;
    font-weight: 500;
  }
  /* Previous reads as a quiet secondary action; Next stays the primary brand button. */
  #formbox-root button[value="page-prev"] {
    border-color: var(--fb-border-strong);
    background: var(--fb-content);
    color: var(--fb-text);
  }
  #formbox-root button[value="page-prev"]:hover {
    border-color: var(--fb-brand);
    background: var(--fb-selected);
    color: var(--fb-brand);
  }

  /* A group rendered as a table pins its legend to the top, so the legend and
     table touch — give it a gap below the eyebrow. Covers table/htable/grid
     (legend + table) and the repeating gtable, whose table is wrapped in a
     section[data-fb-group-list] (legend + section). Nested groups only; the
     top-level legend + [data-fb-group-list] rule (20px) still wins up top. */
  #formbox-root legend + table,
  #formbox-root legend + [data-fb-group-list] {
    margin-top: 8px;
  }

  #formbox-root table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    border: 1px solid var(--fb-border);
    border-radius: 8px;
    background: var(--fb-content);
    font-size: 0.875rem;
  }

  #formbox-root th,
  #formbox-root td {
    border-bottom: 1px solid var(--fb-border);
    padding: 10px 12px;
    vertical-align: middle;
  }

  /* Clean axis typography instead of solid gray header blocks: the top-axis labels
     read as quiet centered captions, the left-axis labels (the questions/rows) as
     primary text — separation comes from the row borders, not fills. */
  #formbox-root thead th {
    text-align: center;
    color: var(--fb-muted-text);
    font-size: 0.8125rem;
    font-weight: 500;
  }
  #formbox-root tbody th {
    text-align: left;
    color: var(--fb-text);
    font-weight: 500;
    white-space: nowrap;
  }
  #formbox-root tbody td {
    text-align: center;
  }

  /* The repeating-table Remove action is a trailing utility column — it should hug
     its button, not claim an equal share of the width. width:1% + nowrap shrinks
     the column to its content so the data columns absorb the rest. */
  #formbox-root td:has(> button[data-fb-field="remove-action"]) {
    width: 1%;
    white-space: nowrap;
  }

  /* Only the last BODY row drops its border — scoped to tbody so the header row
     (the single, therefore last, child of thead) keeps its divider above the body. */
  #formbox-root tbody tr:last-child > th,
  #formbox-root tbody tr:last-child > td {
    border-bottom: 0;
  }

  /* ─────────────────────────  Validation & data states  ─────────────────────── */

  #formbox-root .fb-errors {
    margin: 2px 0 0;
    padding: 8px 12px;
    border: 1px solid var(--fb-danger-border);
    border-radius: 8px;
    background: var(--fb-danger-bg);
    color: var(--fb-danger-fg);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.4;
  }

  /* DESIGN: an error is a red border on the field plus the message, not the message alone. */
  #formbox-root [data-fb-question]:has(.fb-errors) select,
  #formbox-root [data-fb-question]:has(.fb-errors) textarea,
  #formbox-root [data-fb-question]:has(.fb-errors) input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]) {
    border-color: var(--fb-danger);
  }

  #formbox-root form.htmx-request {
    opacity: 0.82;
  }

  /* ─────────────────────────────  Pagination nav  ───────────────────────────── */

  #formbox-root nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px solid var(--fb-border);
    margin-top: 8px;
  }

  #formbox-root nav span {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fb-tertiary-text);
    /* keep counter centered even when one side button is absent */
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  /* Previous — secondary/outline */
  #formbox-root button[value="page-prev"] {
    background: var(--fb-content);
    border-color: var(--fb-border-strong);
    color: var(--fb-text);
    font-weight: 500;
  }
  #formbox-root button[value="page-prev"]:hover {
    border-color: var(--fb-brand);
    background: var(--fb-selected);
    color: var(--fb-brand);
  }

  /* Next — primary (inherits brand button base) */
  #formbox-root button[value="page-next"] {
    margin-left: auto;
    padding: 8px 20px;
  }

  /* Hide Submit on non-last pages (page-next present → not last page) */
  #formbox-root nav:has(button[value="page-next"]) ~ button[value="submit"] {
    display: none;
  }

  #formbox-root form + section {
    max-width: 760px;
    margin: 24px auto 0;
    padding-top: 20px;
    border-top: 1px solid var(--fb-border);
  }

  #formbox-root form + section h2 {
    margin: 0 0 8px;
    color: var(--fb-text);
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.5rem;
  }

  #formbox-root pre {
    overflow: auto;
    max-height: 360px;
    margin: 0 0 16px;
    border: 1px solid var(--fb-border);
    border-radius: 8px;
    background: var(--fb-muted);
    color: var(--fb-text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.45;
    padding: 12px;
  }

  /* Wizard stepper (ctx.fns.ui.wizard): a hidden step. !important beats
     formbox's own fieldset display rule, which otherwise wins over [hidden].
     Unscoped so it also covers non-form wizards. */
  .wizard-hide { display: none !important; }
`;
}
