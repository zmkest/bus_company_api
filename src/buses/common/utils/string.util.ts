export const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
