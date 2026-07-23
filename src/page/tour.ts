// Walk the user through something: a list of steps, run in order against the
// page they are looking at. Narration is a step like any other, because a tour
// where the pointer moves and nothing explains why is just a page twitching.
//
//   await ctx.fns.page.tour({ steps: [
//     { open: "/questionnaire", say: "Every form here is a FHIR Questionnaire" },
//     { open: "/questionnaire?q=depression", say: "Search the public library first" },
//     { say: "This one is the PHQ-9", entity: "questionnaire", id: "44249-1" },
//     { click: { entity: "questionnaire", id: "44249-1" }, say: "Open it to see the real form" },
//     { say: "Nothing is saved until you press Add to project", action: "generate" },
//   ]})
//
// A step may combine an act and a sentence: the act happens, then the sentence
// lands on what it produced. `wait` holds; `fill`/`submit` drive a form. A step
// that fails stops the tour and says which one — a half-run tour is a lie.
export default async function (ctx: Context, _session: Session | null, opts: { steps: Step[]; pauseMs?: number }) {
    const ran: any[] = [];
    for (const [index, step] of opts.steps.entries()) {
        try {
            if (step.wait) await Bun.sleep(step.wait);
            if (step.open) await ctx.fns.page.open(typeof step.open === "string" ? { url: step.open } : step.open);
            if (step.fill) await ctx.fns.page.fill(step.fill);
            if (step.submit) await ctx.fns.page.submit({ form: step.submit });
            if (step.click) await ctx.fns.page.click(step.click);
            if (step.point) await ctx.fns.page.point(step.point);
            if (step.say) await ctx.fns.page.say({ text: step.say, ...anchorOf(step), ms: step.ms });
            ran.push({ step: index, ...step });
        } catch (error: any) {
            throw new Error(`tour stopped at step ${index} (${JSON.stringify(step).slice(0, 120)}): ${error?.message ?? error}`);
        }
        await Bun.sleep(step.ms ?? opts.pauseMs ?? 2200);   // long enough to read the caption
    }
    return { ran: ran.length, steps: ran };
}

// A sentence is anchored by the descriptor written on the step itself, or by
// whatever the step just acted on — saying something about a button you have
// just pressed should not require naming it twice.
function anchorOf(step: Step): types.page.Descriptor {
    const own = { entity: step.entity, id: step.id, action: step.action, form: step.form, field: step.field, role: step.role };
    if (Object.values(own).some(Boolean)) return own;
    if (step.point) return step.point;
    if (step.click && typeof step.click === "object") return step.click;
    if (step.fill) return { form: step.fill.form };
    if (step.submit) return { form: step.submit };
    return {};
}

type Step = types.page.Descriptor & {
    say?: string;
    open?: string | ({ url?: string } & types.page.Descriptor);
    click?: types.page.Descriptor;
    point?: types.page.Descriptor;
    fill?: { form: string; values: Record<string, string | number | boolean> };
    submit?: string;
    wait?: number;
    ms?: number;
};
