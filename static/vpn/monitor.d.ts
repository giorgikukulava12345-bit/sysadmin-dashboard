export const SIMULATED_EVENTS: ReadonlyArray<readonly ['INFO' | 'WARNING' | 'CRITICAL' | 'ERROR', string, string, string]>;
export function mountMonitor(container: HTMLElement): () => void;
