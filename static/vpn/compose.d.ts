import type { LabState } from './lab.js';
import type { ToolValues } from './catalog.js';
export function composeDevice(options:{
  lab:LabState;side:'a'|'b';role:'router'|'switch'|'host';
  selected?:Record<string,boolean>;values?:Record<string,ToolValues>;bindings?:boolean;
  vpnConfig?:Record<string,unknown>;vpnType?:string;remote?:ToolValues;linkedEnterprise?:ToolValues|null;
}):{errors:string[];code:string;empty:boolean};
