// The two session config options the composer exposes: model and reasoning
// effort. ACP advertises them as a flat `SessionConfigOption[]` where a select
// may nest its options in groups — this flattens the groups and picks the two
// options out by category/id/name, exactly as wmlet does.
//
// `current` is the display label of the selected item (the short variant for
// the model, which is what the composer button shows); `items[].selected`
// carries the selection itself, so nothing has to compare labels.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const config: any[] = ctx.state.agent?.config ?? [];

    const model = config.find((o) => {
        const name = String(o.name || o.id || "").toLowerCase();
        return o.type === "select" && (o.category === "model" || o.id === "model" || name === "model");
    });

    const effort = config.find((o) => {
        const name = String(o.name || o.id || "").toLowerCase();
        return (
            o.type === "select" &&
            (o.category === "thought_level" ||
                name.includes("thought") ||
                name.includes("reasoning") ||
                name.includes("intelligence"))
        );
    });

    // Canonical labels for the model ids the agents advertise without a decent
    // name; the ACP name wins whenever the id is unknown.
    const models: Record<string, { label: string; short: string }> = {
        "gpt-5.5": { label: "GPT 5.5", short: "5.5" },
        "gpt-5.4": { label: "GPT 5.4", short: "5.4" },
        "gpt-5.2-codex": { label: "GPT 5.2 Codex", short: "5.2 Codex" },
        "gpt-5.1-codex-max": { label: "GPT 5.1 Codex Max", short: "5.1 Max" },
        "gpt-5.4-mini": { label: "GPT 5.4 Mini", short: "5.4 Mini" },
        "gpt-5.3-codex": { label: "GPT 5.3 Codex", short: "5.3 Codex" },
        "gpt-5.3-codex-spark": { label: "GPT 5.3 Codex Spark", short: "5.3 Spark" },
        "gpt-5.2": { label: "GPT 5.2", short: "5.2" },
        "gpt-5.1-codex-mini": { label: "GPT 5.1 Codex Mini", short: "5.1 Mini" },
    };
    const efforts: Record<string, string> = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra High" };

    const modelLabel = (value: string, name: string, variant: "label" | "short" = "label") =>
        models[value]?.[variant] || name || value || "Model";
    const effortLabel = (value: string, name: string) => efforts[value] || name || value || "Reasoning";

    const flatten = (option: any) =>
        (option?.options ?? []).flatMap((item: any) => ("options" in item ? item.options : [item]));

    const modelCurrent = String(model?.currentValue ?? "");
    const modelItems = flatten(model).map((item: any) => ({
        value: String(item.value),
        name: modelLabel(String(item.value), String(item.name ?? "")),
        description: String(item.description ?? ""),
        selected: String(item.value) === modelCurrent,
    }));

    const effortCurrent = String(effort?.currentValue ?? "");
    const effortItems = flatten(effort).map((item: any) => ({
        value: String(item.value),
        name: effortLabel(String(item.value), String(item.name ?? "")),
        description: String(item.description ?? ""),
        selected: String(item.value).toLowerCase() === effortCurrent.toLowerCase(),
    }));

    return {
        model: {
            configId: String(model?.id ?? ""),
            current: model
                ? modelLabel(modelCurrent, modelItems.find((i: any) => i.selected)?.name ?? "", "short")
                : "Model",
            items: modelItems,
        },
        effort: {
            configId: String(effort?.id ?? ""),
            current: effort ? effortLabel(effortCurrent, effortItems.find((i: any) => i.selected)?.name ?? "") : "",
            items: effortItems,
        },
    };
}
