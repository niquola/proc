// Fill inputs inside [data-form="<name>"] by input name.
//   page.fill({ form: "newPatient", values: { name: "Ivan", gender: "male" } })
export default async function (ctx: Context, _session: Session | null, opts: { form: string; values: Record<string, string | number | boolean> }) {
    const arg = JSON.stringify(opts);
    const result = await ctx.fns.page.eval({
        code: `const { form, values } = ${arg};
               const root = document.querySelector('[data-form=' + JSON.stringify(form) + ']');
               if (!root) return { missing: Object.keys(values), filled: [], candidates: [] };
               const filled = [], missing = [];
               for (const [name, value] of Object.entries(values)) {
                 const el = root.querySelector('[name=' + JSON.stringify(name) + ']');
                 if (!el) { missing.push(name); continue; }
                 if (el.type === "checkbox") el.checked = !!value;
                 else el.value = String(value);
                 el.dispatchEvent(new Event("input", { bubbles: true }));
                 el.dispatchEvent(new Event("change", { bubbles: true }));
                 filled.push(name);
               }
               return { filled, missing, candidates: [...root.querySelectorAll('[name]')].map(e => e.name) }`,
    });
    if (result.missing?.length) throw new Error(`no such fields in "${opts.form}": ${result.missing.join(", ")} (have ${result.candidates.join(", ")})`);
    return result;
}
