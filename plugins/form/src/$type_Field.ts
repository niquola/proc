// One input in an agent-generated form.
export type Field = {
    name: string;
    label?: string;
    type?: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
    options?: string[];
    value?: string;
    required?: boolean;
};
