// ctx.state.forms — forms the agent asked for, by id, with their answers.
export type forms = Record<string, {
    id: string;
    title: string;
    fields: types.form.Field[];
    answer?: Record<string, string>;
    at: string;
}>;
