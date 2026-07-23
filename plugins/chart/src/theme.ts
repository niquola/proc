// The Vega-Lite config every chart gets, built from the workspace's own tokens,
// so a bare `{ mark, encoding }` already looks like it belongs here: quiet axes,
// dashed gridlines, no box around the plot, the brand colour for a single
// series and a readable palette for several. A spec's own `config` wins — this
// is the floor, not the ceiling.
const BRAND = "#3461a8";
const TEXT = "#1c1917";
const MUTED = "#57534e";
const TERTIARY = "#78716c";
const BORDER = "#e7e5e4";

export default function (_ctx: Context, _session: Session | null, _opts?: {}): Record<string, unknown> {
    return {
        font: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        background: "transparent",
        view: { stroke: null },
        padding: 8,
        title: { color: TEXT, fontSize: 13, fontWeight: 600, anchor: "start", dy: -4 },
        axis: {
            labelColor: MUTED, titleColor: TERTIARY, labelFontSize: 11, titleFontSize: 11,
            titleFontWeight: 500, tickColor: BORDER, domainColor: BORDER,
            gridColor: BORDER, gridDash: [2, 3], labelPadding: 6,
        },
        legend: { labelColor: MUTED, titleColor: TERTIARY, labelFontSize: 11, titleFontSize: 11, symbolType: "circle" },
        line: { color: BRAND, strokeWidth: 2 },
        point: { color: BRAND, filled: true, size: 50 },
        bar: { color: BRAND },
        area: { color: BRAND, opacity: 0.15, line: { color: BRAND, strokeWidth: 2 } },
        arc: { stroke: "#ffffff", strokeWidth: 1 },
        rule: { color: TERTIARY },
        range: { category: [BRAND, "#4b9a68", "#b7791f", "#7c5cbf", "#0e7490", "#cd3131", "#78716c"] },
    };
}
