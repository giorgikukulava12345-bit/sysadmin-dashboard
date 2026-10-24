export type LabSite = Record<string,string>;
export type LabState = {a: LabSite; b: LabSite};
export function createLab(): LabState;
export function labScripts(state: LabState): {errors: string[]; scripts: {title: string; code: string; unsupported?: boolean}[]};
export function mountLab(root: HTMLElement, options?: {onChange?: (state: LabState) => void; showDeviceOutputs?: boolean}): {set(state: Partial<LabState>): void; destroy(): void};
