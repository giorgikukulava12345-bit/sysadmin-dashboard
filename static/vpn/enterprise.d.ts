import type { ToolField, ToolValues } from './catalog.js';
export const ENTERPRISE_FEATURES:Record<string,{title:string;role:string;roles?:string[];category:string;vendors:string[];note:string;fields:(vendor:string)=>ToolField[]}>;
export function enterpriseFields(id:string,vendor:string):ToolField[];
export function enterpriseDefaults(id:string,vendor:string):ToolValues;
export function enterpriseGenerate(id:string,data:ToolValues):{errors:string[];scripts:{title:string;code:string}[]};
export function ipv6(address:string):bigint;
