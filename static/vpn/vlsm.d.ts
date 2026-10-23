export type Department = {name: string; hosts: string | number};
export type VlsmRow = {name: string; hosts: number; network: string; mask: string; first: string; last: string; broadcast: string; usable: number};
export function planVlsm(base: string, departments: Department[]): {errors: string[]; rows: VlsmRow[]; unused: number};
export function vlsmTsv(rows: VlsmRow[]): string;
