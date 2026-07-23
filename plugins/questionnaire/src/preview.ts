// A `$qr_*.json` is not a JSON file to a person — it is a form. The manifest
// points the file manager here (`"preview": { "files": "$qr_*.json", "fn":
// "preview" }`), and this renders the file the way it will actually look, with
// a way through to the full page.
//
// Returning null hands the file back: a malformed one is more useful as JSON
// with its syntax highlighted than as a blank frame.
import { basename } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { path: string }): Promise<string | null> {
    const name = basename(opts.path);
    const questionnaire: any = await ctx.fns.questionnaire.load({ file: opts.path }).catch(() => null);
    if (!questionnaire) return null;                                  // malformed — let the JSON view show why

    const id = questionnaire.id ?? name.slice("$qr_".length, -".json".length);
    const rendered = await ctx.fns.questionnaire.render({ questionnaire, readOnly: true, formName: `qr-${id}-file` });
    return `<div class="flex items-baseline justify-between gap-4 border-b border-border-subtle bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">
  <span>FHIR Questionnaire · ${count(questionnaire.item)} questions · read-only</span>
  <a class="shrink-0 text-text-link hover:underline" href="/questionnaire/preview?id=${encodeURIComponent(id)}"
    hx-get="/questionnaire/preview?id=${encodeURIComponent(id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">open in Questionnaires</a>
</div>
<div class="px-4 py-5">${rendered.main}</div>`;
}

function count(items: any[] = []): number {
    return items.reduce((n, item) => n + (item.type === "group" ? count(item.item) : 1), 0);
}
