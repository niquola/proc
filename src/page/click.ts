// Click by data-* convention, never by a raw CSS selector:
//   page.click({ action: "submit" })
//   page.click({ action: "delete", entity: "Patient", id: "pt-1" })   // scoped to a row
//   page.click({ entity: "Patient", id: "pt-1" })                     // the row itself
export default async function (ctx: Context, _session: Session | null, opts: { action?: string; entity?: string; id?: string }) {
    const arg = JSON.stringify(opts);
    const hit = await ctx.fns.page.eval({
        code: `const { action, entity, id } = ${arg};
               const scope = entity ? document.querySelector('[data-entity=' + JSON.stringify(entity) + ']' + (id ? '[data-id=' + JSON.stringify(id) + ']' : '')) : document;
               if (!scope) return null;
               const el = action ? scope.querySelector('[data-action=' + JSON.stringify(action) + ']') : scope;
               if (!el) return null;
               el.click();
               return el.getAttribute('data-action') ?? el.getAttribute('data-id') ?? el.tagName.toLowerCase()`,
    });
    if (!hit) throw new Error(`nothing to click: ${arg}`);
    return { clicked: hit };
}
