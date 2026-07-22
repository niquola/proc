// ctx.state.page — the browser tabs connected to the workspace UI and the
// evaluations they have not answered yet. There is no browser here: code is
// injected into whatever page has the workspace open.
export type page = {
    nextId: number;
    pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>;
};
