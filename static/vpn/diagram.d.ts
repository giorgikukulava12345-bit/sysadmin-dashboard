import type { LabState } from './lab.js';
export const DIAGRAM_CSS:string;
export function mountDiagram(root:HTMLElement,onSelect?:(side:'a'|'b',role:'router'|'switch'|'host')=>void):{update(lab:LabState,active?:string,invalid?:boolean):void;destroy():void};
