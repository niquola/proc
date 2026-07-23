// The people with an open event stream, by id, with how many tabs each has.
// events/$route__GET.ts adds on connect and removes on disconnect.
export type presence = Map<string, { id: string; name: string; tabs: number }>;
