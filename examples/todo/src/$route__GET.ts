// GET /todo — the htmx + Tailwind UI (the host layout provides both via CDN).
export default function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return {
        title: "todo",
        main: `<div class="max-w-md mx-auto mt-10">
  <h1 class="text-2xl font-semibold mb-5">todo</h1>
  <form hx-post="/todo/add" hx-target="#list" hx-swap="innerHTML"
        hx-on::after-request="this.reset()" class="flex gap-2 mb-5">
    <input name="title" placeholder="What needs doing?" autocomplete="off" required
           class="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
    <button class="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700">Add</button>
  </form>
  <div id="list">${ctx.fns.todo.render({})}</div>
</div>`,
    };
}
