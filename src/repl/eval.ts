// Run TypeScript / JavaScript inside the server process.
// Contract — predictable, Jupyter-style:
//   - Code is the body of `async () => { CODE }`.
//   - In scope: `ctx` (request-scoped, with session), `session`, `console`
//     (captured), `print`. Calls like ctx.fns.x.y({...}) inject ctx/session.
//   - The last expression statement is returned as a JavaScript value.
//   - Errors propagate as exceptions.
const TS_TRANSPILER = new Bun.Transpiler({ loader: 'ts' });

type EvalResult = {
    output: string;
    return: any;
};

function formatArg(a: any): string {
    return typeof a === 'string' ? a : Bun.inspect(a);
}

export default async function (
    ctx: Context,
    session: Session | null,
    opts: { code: string; bindings?: Record<string, any> },
): Promise<EvalResult> {
    const code = opts.code;
    const bindings: Record<string, any> = opts.bindings ?? {};
    const buffer: string[] = [];
    const log = (...args: any[]) => {
        buffer.push(args.map(formatArg).join(' '));
    };

    const consoleProxy = {
        log,
        info: log,
        debug: log,
        warn: log,
        error: log,
    };

    // Eval ctx: inherits the caller's ctx; the session flows through.
    const rctx: Context = Object.create(ctx);
    (rctx as any).session = session ?? ctx.session ?? { kind: 'repl' };

    // Bun.Transpiler accepts JS as a subset of TS, so always transpile.
    let js: string;
    try {
        js = TS_TRANSPILER.transformSync(`async function __repl() {
${withLastExpressionReturn(code)}
}`);
    } catch (e: any) {
        throw new SyntaxError('eval: parse error: ' + (e?.message ?? String(e)));
    }

    const names = ['ctx', 'session', 'console', 'print', ...Object.keys(bindings)];
    const values: any[] = [rctx, (rctx as any).session, consoleProxy, log, ...Object.values(bindings)];

    const fn = new Function(...names, `${js}\nreturn __repl()`);
    const result = await fn(...values);

    return { output: buffer.join('\n'), return: result };
}

function withLastExpressionReturn(code: string): string {
    const range = lastStatementRange(code);
    if (!range) return code;

    const statement = code.slice(range.start, range.end).trim();
    if (!isExpressionStatement(statement)) return code;

    return `${code.slice(0, range.start)}return (${statement});${code.slice(range.end)}`;
}

function lastStatementRange(code: string): { start: number; end: number } | null {
    let end = code.length;
    while (end > 0 && /[\s;]/.test(code[end - 1]!)) end--;
    if (end === 0) return null;

    let start = 0;
    let parens = 0;
    let brackets = 0;
    let braces = 0;
    let state: 'normal' | 'single' | 'double' | 'template' | 'line-comment' | 'block-comment' = 'normal';

    for (let i = 0; i < end; i++) {
        const ch = code[i]!;
        const next = code[i + 1];

        if (state === 'line-comment') {
            if (ch === '\n') {
                state = 'normal';
                if (parens === 0 && brackets === 0 && braces === 0) start = i + 1;
            }
            continue;
        }
        if (state === 'block-comment') {
            if (ch === '*' && next === '/') {
                state = 'normal';
                i++;
            }
            continue;
        }
        if (state === 'single') {
            if (ch === '\\') i++;
            else if (ch === "'") state = 'normal';
            continue;
        }
        if (state === 'double') {
            if (ch === '\\') i++;
            else if (ch === '"') state = 'normal';
            continue;
        }
        if (state === 'template') {
            if (ch === '\\') i++;
            else if (ch === '`') state = 'normal';
            continue;
        }

        if (ch === '/' && next === '/') {
            state = 'line-comment';
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            state = 'block-comment';
            i++;
            continue;
        }
        if (ch === "'") {
            state = 'single';
            continue;
        }
        if (ch === '"') {
            state = 'double';
            continue;
        }
        if (ch === '`') {
            state = 'template';
            continue;
        }

        if (ch === '(') parens++;
        else if (ch === ')') parens = Math.max(0, parens - 1);
        else if (ch === '[') brackets++;
        else if (ch === ']') brackets = Math.max(0, brackets - 1);
        else if ((ch === ';' || ch === '\n') && parens === 0 && brackets === 0 && braces === 0) start = i + 1;
    }

    while (start < end && /\s/.test(code[start]!)) start++;
    return start === end ? null : { start, end };
}

function isExpressionStatement(statement: string): boolean {
    if (/^(async\s+function|const|let|var|if|for|while|do|switch|try|catch|finally|return|throw|break|continue|debugger|function|class|import|export|interface|type|enum|namespace|declare)\b/.test(statement)) {
        return false;
    }
    return true;
}
