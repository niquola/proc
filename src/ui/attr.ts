// The data-* markers that make a page drivable. Emit them with this rather than
// by hand, so every plugin spells them the same way and the agent's helpers can
// find anything on the screen.
//
//   `<section ${ctx.fns.ui.attr({ page: "questionnaire" })}>`
//   `<tr ${ctx.fns.ui.attr({ entity: "Patient", id: "pt-1", status: "active" })}>`
//   `<td ${ctx.fns.ui.attr({ role: "name" })}>`
//   `<button ${ctx.fns.ui.attr({ action: "delete", id: "pt-1" })}>`
//   `<form ${ctx.fns.ui.attr({ form: "search" })}>`
//
// The seven keys, and what each promises:
//   page    the root of a plugin's page — one per page, names what is on screen
//   entity  a thing: a row, a card, a tab. `id` identifies which one
//   id      the entity's identity, or the subject of an action
//   status  the entity's state, when it has one (running, draft, error)
//   role    a part of an entity — the cell the agent reads a value out of
//   form    a form (or the container of one), addressable by fill/submit
//   action  a control that does something. The verb, not the label
//
// Empty values are dropped, so optional fields can be passed straight through.
const KEYS = ["page", "entity", "id", "status", "role", "form", "action"] as const;

export default function (_ctx: Context, _session: Session | null, opts: Partial<Record<(typeof KEYS)[number], string | number | null | undefined>> & Record<string, any>): string {
    const out: string[] = [];
    for (const key of Object.keys(opts)) {
        const value = opts[key];
        if (value === null || value === undefined || value === "") continue;
        out.push(`data-${key}="${esc(String(value))}"`);
    }
    return out.join(" ");
}

function esc(s: string): string {
    return s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
