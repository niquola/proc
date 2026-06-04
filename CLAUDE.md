# procs — file-based FP framework on Bun

Минимальный процедурный (FP-style) фреймворк: функции на диске → реестр `ctx.fns` в рантайме. Имя файла определяет, чем файл является (функция, роут, тип, скрипт). Никаких импортов между модулями — всё вызывается через `ctx`. Живой сервер правится через REPL и hot-reload без рестарта.

Извлечён из `~/workspaces-template` и `~/hyper-code2` (ядро: registry + web + REPL + генераторы, без доменных модулей).

## Запуск

```sh
bun src/$main.ts            # или: bun start; порт из env PORT (default 3000)
bun script/repl.ts '<code>' # выполнить код в живом процессе сервера
```

Порт работающего сервера пишется в `.runtime/port` — `script/repl.ts` находит сервер по нему.

## Ключевая идея: единая сигнатура + implicit-инжекция

**Каждая** функция проекта объявляется с одной и той же сигнатурой:

```ts
export default async function (ctx: Context, session: Session | null, opts: {...}) { ... }
```

а **вызывается** через `ctx.fns.*` только с opts — `ctx` и `session` инжектятся автоматически:

```ts
ctx.fns.notes.add({ text: "hi" })      // → rawAdd(ctx, ctx.session, { text: "hi" })
ctx.genTypes({})                        // корневые функции — так же
```

Механика (src/$main.ts `makeCtx`):
- сырые функции лежат в дереве `ctx.state.registry`
- `ctx.fns` — getter, возвращающий Proxy: доступ к функции даёт обёртку `(opts) => raw(ctx, ctx.session, opts)`; getter использует `this`, поэтому инжектится **тот** ctx, через который обратились
- корневые `$name.ts` — инжектящие getter-свойства прямо на ctx (`defineRootFn` в loadFns.ts)
- на каждый HTTP-запрос: `rctx = Object.create(rootCtx)` + `rctx.session = { kind:'http', req, params, url }` → всё, что хендлер зовёт через `rctx.fns.*`, получает эту сессию **по всей глубине цепочки** без ручной передачи
- REPL так же: `session.kind === 'http'` (запрос POST /repl) и далее по цепочке

```ts
// src/$type_Context.ts
type Context = RootFns & {
    env: Record<string, string | undefined>;  // env vars
    state: Record<string, any>;               // registry, runtime-синглтоны
    routes: Record<string, Record<string, Function>>; // path → method → handler
    session: Session | null;                  // текущая сессия (null на root ctx)
    fns: FnsRegistry;                          // инжектящий Proxy над state.registry
};
// src/$type_Session.ts
type Session = { req?: Request; params?: Record<string,string>; kind?: string; [k: string]: any };
```

Сигнатура HTTP-хендлера — та же: `(ctx, session, opts: { req, params })`. Сервер зовёт его явно с request-ctx; `session.req`/`session.params` дублируются в opts для удобства.

`Context`, `Session`, `FnsRegistry`, `RootFns` — глобальные типы, импортировать не нужно. Внутри функции вызывай соседей через `ctx.fns.x.y({...})` — session не передавай, она течёт сама. Явно передавать сырые аргументы нужно только при прямом импорте (bootstrap в loadFns/scan).

## Конвенции имён файлов (src/project/classify.ts)

| Файл | Что это | Регистрация |
|---|---|---|
| `module/name.ts` | функция | `ctx.fns.module.name` |
| `$name.ts` (в корне src/) | корневая функция | `ctx.name` (напр. `ctx.genTypes`, `ctx.layout`) |
| `$type_Name.ts` | TypeScript-тип | глобально `Name` (корень) или `types.module.Name` |
| `module/$route_<path>_<METHOD>.ts` | HTTP-роут | `METHOD /module/<path>` |
| `module/$script_name.js\|.css` | браузерный ассет | `GET /module/name.js` (бандлится Bun.build при запросе) |
| `*.test.ts`, `*.entry.ts`, `*.d.ts`, `$main.ts` | пропускаются | — |

Правила путей роутов: `_` в имени → `/` в пути; `$id` → `:id` (param). Примеры:
- `src/repl/$route__POST.ts` → `POST /repl`
- `src/$route__GET.ts` → `GET /`
- `src/todo/$route_$id_edit_GET.ts` → `GET /todo/:id/edit`

Каждый файл-функция — это `export default async function (ctx: Context, session: Session | null, opts) {...}`. Один файл = одна функция. Никаких side-effect-импортов.

Директории `_runtime`, `_test_*`, `_tmp_*`, `tmp_*` игнорируются сканером.

## Ядро (boot-последовательность, src/$main.ts)

1. `makeCtx()` ($main.ts) — ctx с `state.registry` и инжектящим Proxy-getter `fns`
2. `loadFns` — `project/scan` обходит `src/` глобом, `classify` парсит имена, все `kind: fn` кладутся в `ctx.state.registry` (корневые — getter-ами на ctx)
3. `ctx.genTypes({})` — регенерирует `src/ctx_ns.d.ts`: `FnsRegistry`/`RootFns`, каждая запись обёрнута в `Injected<typeof import(...).default>` — тип без (ctx, session), как и реальный вызов
4. `ctx.fns.http.loadRoutes({})` — регистрирует `$route_*` и `$script_*` в `ctx.routes`
5. `ctx.fns.http.start({})` — `Bun.serve`, пишет порт в `.runtime/port`, лог запросов в `.runtime/http.log`
6. `ctx.fns.dev.watch({})` — file-watcher на `src/` (opt-in `WATCH=1`, см. ниже)

`ctx_ns.d.ts` — автогенерируемый, не редактировать руками.

## HTTP (src/http/)

- `match.ts` — матчер путей: точное совпадение, потом по-сегментно с `:param` (params попадают в `(req as any).params`)
- Сигнатура хендлера: `(ctx, session, opts: { req, params }) => ...`
- Автообёртка ответа (http/$start.ts → toResponse):
  - `Response` → как есть
  - `string` → HTML через `ctx.layout({ main })`
  - `{ main, title?, status? }` → HTML через layout
  - всё остальное → JSON
- `$layout.ts` — HTML-shell (Tailwind CDN + htmx + `/events/client.js`)

## REPL (src/repl/)

Jupyter-style eval внутри живого процесса сервера:

- `eval.ts` — код = тело `async () => {...}`; TS транспилируется `Bun.Transpiler`; в скоупе: `ctx` (request-scoped, с сессией), `session`, `console` (перехвачен в буфер), `print`. **Последнее выражение возвращается как значение** (`withLastExpressionReturn`). Результат: `{ output, return }`
- `$route__POST.ts` — `POST /repl`, body = код. **Только loopback**; `NODE_ENV=production` → 403
- `load.ts` — hot-reload: `ctx.fns.repl.load({ name: "module.fn" })` (одна функция) или `{ name: "module" }` (весь модуль). Реимпорт с cache-bust `?t=Date.now()`, замена в `ctx.fns` на месте
- `script/repl.ts` — CLI-клиент: аргумент / `-f file` / stdin

## dev.def — главный способ добавлять код (src/dev/def.ts)

Синхронно: записать файл + загрузить + genTypes **одним вызовом**. Ошибка кода → немедленный throw, битый файл даже не пишется на диск (валидация транспилятором до записи). Никаких гонок и sleep:

```ts
await ctx.fns.dev.def({ name: "math.fib", code: "export default async function (ctx: Context, session: Session | null, opts: {n: number}) {...}" });
await ctx.fns.dev.def({ rel: "math/$route__GET.ts", code: "..." });  // роут/скрипт — по rel-пути
```

Паттерн для агента — **def + проверка в одном REPL round-trip**:
```sh
bun script/repl.ts -f /dev/stdin <<'EOF'
await ctx.fns.dev.def({ name: "math.fib", code: `...` });
ctx.fns.math.fib({ n: 30 })
EOF
```
Ответ: либо `return` с результатом проверки (всё загрузилось), либо `error` (ничего не зарегистрировано). Третьего нет.

## Watcher (src/dev/watch.ts) — opt-in, для правок в редакторе

`WATCH=1 bun src/$main.ts` — сервер следит за `src/`: **сохранил файл → он живой**. По умолчанию выключен (для агента основной путь — `dev.def`; watcher асинхронен — между записью и загрузкой есть гонка):

- `fn` → hot-load в `ctx.fns` + genTypes + reload вкладок
- `$route_*` / `$script_*` → loadRoutes + reload вкладок
- `$type_*` → genTypes
- новая директория с файлами → пересканируется (FSEvents схлопывает такие события)
- `.d.ts` игнорируется (вывод genTypes — был бы цикл)

Семантика ошибок: битый файл (синтаксис и т.п.) → `[watch] <file>: <error>` в лог, **старая версия продолжает работать**; исправил → подхватился. Ошибка в хендлере → 500 со стеком (dev), сервер живёт. Ошибка в REPL → `{ error, stack }` в ответе.

**watchErrors в REPL**: пока хоть один файл не загружается watcher-ом, КАЖДЫЙ ответ `/repl` содержит поле `watchErrors: { "<rel>": "<error>" }` (доска ошибок в `ctx.state.dev.errors`; чистится при успешной загрузке/удалении файла). Защита от тихого провала при работе через watcher: функция отвечает старой версией, но `watchErrors` кричит, что новый код не загрузился.

Ручной reload (`ctx.fns.repl.load`, `ctx.fns.http.loadRoutes`) остаётся как fallback. Правка самого `dev/watch.ts`, `http/$start.ts` или `$main.ts` требует рестарта процесса (живут как запущенные замыкания).

Типовой dev-цикл (и для агента тоже):
```sh
# создал/поправил любой файл в src/ → watcher всё сделал; сразу проверяем:
bun script/repl.ts 'ctx.fns.foo.bar({...})'
```

## Events / SSE (src/events/)

In-process pub/sub + поток в браузер:

- `subscribe.ts` / `emit.ts` — `Set` подписчиков в `ctx.state.events`; событие = `{ type: string, ... }`
- `$route__GET.ts` — `GET /events`, SSE-стрим (hello c `serverStart`, keepalive ping 25s)
- `client.js` — браузерный клиент (грузится из layout): реконнект с backoff, `type: "reload"` → `location.reload()`, рестарт сервера (по `serverStart`) → reload, остальные события → DOM `CustomEvent('hyper-events')`
- `reload.ts` — `ctx.fns.events.reload(ctx)` перезагружает все открытые вкладки

## Генераторы (src/generate/)

Скаффолдинг с немедленной регистрацией (без рестарта):

- `fn.ts` — `ctx.fns.generate.fn({ module, name, body? })` → пишет `src/<module>/<name>.ts`, hot-load, genTypes
- `route.ts` — `ctx.fns.generate.route({ module, path?, method, body? })` → пишет `$route_*`, loadRoutes, broadcast reload
- `module.ts` — `ctx.fns.generate.module({ name })` → fn `list` + index-роут

## Как добавлять код (workflow для агента)

Два пути, выбирай по размеру кода:

**1. Существенный код (есть Write-инструмент)** — предпочтительно:
```sh
# Write src/<module>/<file>.ts (обычный файл, без экранирования), затем:
bun script/repl.ts 'await ctx.fns.dev.sync({ rel: "<module>/<file>.ts" }); ctx.fns.<module>.<fn>({...})'
```
`dev.sync(rel)` сам понимает по classify, что это (fn → repl.load + genTypes, роут → loadRoutes, тип → genTypes). Плюсы: никакого экранирования, стек ошибок указывает в реальный файл:строку.

**2. Маленькие функции / итерации** — `dev.def` + проверка в одном round-trip (см. секцию dev.def). Минус: внутри `code: \`...\`` приходится экранировать вложенные \` и \${ — для кода с HTML-шаблонами быстро становится больно, бери путь 1.

Проверено на практике: state-функции через `ctx.state` живут между вызовами; формы (`req.formData()` + `Response.redirect`) работают; `def`/`sync` можно определять через сами себя.

Правила:
- Не импортируй функции проекта друг из друга — только вызовы через `ctx.fns`. Внешние либы и `node:`-модули импортировать можно
- Удалил файл — функция остаётся в памяти до рестарта (но из типов уходит)
- Правка `dev/watch.ts`, `http/$start.ts`, `$main.ts` требует рестарта процесса
- Сервер не запущен? `bun src/$main.ts` (порт смотри/задавай через `PORT`, найдёшь в `.runtime/port`)

## Bun

Рантайм — Bun (не Node): `bun <file>`, `bun test`, `bun install`, `Bun.serve`, `Bun.file`, `bun:sqlite`, `Bun.sql`, `Bun.$`. `.env` грузится автоматически. WebSocket встроен. Не использовать express/vite/jest/pg/ws — у Bun всё встроено.
