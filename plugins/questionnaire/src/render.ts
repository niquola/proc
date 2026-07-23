// A FHIR Questionnaire → html, through @formbox/htmx. Ported from the old
// workspace template: the browser runtime stays htmx-only, so the whole form is
// server-rendered and nothing React-shaped is mounted for it.
//
// The old template vendored all 46 handlebars templates to tweak seven of them;
// the library ships the same set, so we take its defaults and keep no templates
// of our own. What those tweaks bought is either unnecessary here (the submit
// button's data-action — page.submit calls requestSubmit on the form itself) or
// belonged to that app (a morphdom swap strategy).
//
// `formData` runs the submitted values back through the renderer, which is how
// a QuestionnaireResponse is built and how validation errors come back attached
// to the fields that caused them.
import { loadDefaultTemplates, QuestionnaireRenderer, type RequiredTemplates } from "@formbox/htmx";

let templates: Promise<RequiredTemplates> | undefined;

export default async function (ctx: Context, _session: Session | null, opts: { questionnaire: any; submitUrl?: string; response?: any; readOnly?: boolean; formName?: string; formData?: FormData }) {
    const token = opts.formName ?? opts.questionnaire.id ?? "questionnaire";
    const renderer = new QuestionnaireRenderer<"r4">({
        token,
        templates: await (templates ??= loadDefaultTemplates()),
        questionnaire: opts.questionnaire as never,
        questionnaireResponse: (opts.response ?? undefined) as never,
        fhirVersion: "r4",
        action: opts.submitUrl ?? "",
        mode: opts.readOnly ? "display" : "capture",
    });

    try {
        const processResult = opts.formData ? await renderer.process(opts.formData) : { submitted: false as const };
        const form = await renderer.render();
        return {
            main: `<style>${ctx.fns.questionnaire.styles({})}</style><div id="formbox-root" data-form="${esc(token)}">${form}</div>`,
            form,
            response: renderer.getQuestionnaireResponse(),
            processResult,
        };
    } finally {
        renderer.dispose();
    }
}

function esc(s: string): string {
    return s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
