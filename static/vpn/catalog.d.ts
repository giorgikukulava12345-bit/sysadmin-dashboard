export type ToolValues = Record<string, string | boolean>;
export type ToolField = {
  key: string; label: string; value: string | boolean;
  type: 'text' | 'number' | 'password' | 'checkbox' | 'select' | 'textarea';
  options?: Record<string, string>; when?: (values: ToolValues) => boolean;
};
export const TOOLS: Record<string, {title: string; note: string; fields: ToolField[]}>;
export function defaultsFor(key: string): ToolValues;
export function generateTool(key: string, data: ToolValues): {
  errors: string[]; scripts: {title: string; code: string}[];
};
