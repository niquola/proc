// Per-call context: created per HTTP request (req, params) or per REPL eval.
// Mutable — interceptors/handlers may attach user, locale, etc.
export type Session = {
    req?: Request;
    params?: Record<string, string>;
    kind?: string;
    [key: string]: any;
};
