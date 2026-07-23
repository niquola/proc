// Search the public FHIR Questionnaire library — the Aidbox Form Builder. It is
// the knowledge base this plugin exists for: before authoring a form, look for
// one that already says the right thing.
//
// Three ways to ask, because they answer different questions: `item` reaches
// into the questions themselves (nested item text, codes, answer labels — the
// best default), `title` matches the form's name, `code` finds the LOINC panel
// whose code you already know.
const LIBRARY = "https://form-builder.aidbox.app/fhir/Questionnaire";

export default async function (_ctx: Context, _session: Session | null, opts: { query: string; by?: "item" | "title" | "code"; count?: number }) {
    const query = opts.query?.trim();
    if (!query) return { total: 0, results: [] };

    const params = new URLSearchParams({ _count: String(opts.count ?? 30), _elements: "id,title,publisher,status" });
    if (opts.by === "title") params.set("title", query);
    else if (opts.by === "code") params.set("code", query.includes("|") ? query : `http://loinc.org|${query}`);
    else params.set(".item$contains", query);

    const res = await fetch(`${LIBRARY}?${params}`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`form library answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const bundle: any = await res.json();

    return {
        total: bundle.total ?? null,
        results: (bundle.entry ?? []).map((entry: any) => ({
            id: entry.resource?.id as string,
            title: (entry.resource?.title ?? entry.resource?.name ?? entry.resource?.id) as string,
            publisher: entry.resource?.publisher as string | undefined,
            status: entry.resource?.status as string | undefined,
        })).filter((r: any) => r.id),
    };
}
