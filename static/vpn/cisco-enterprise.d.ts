import type { ENTERPRISE_FEATURES } from './enterprise.js';
import type { ToolValues } from './catalog.js';
export const CISCO_FEATURES:typeof ENTERPRISE_FEATURES;
export function generateCiscoFeature(id:string,data:ToolValues):{errors:string[];scripts:{title:string;code:string}[]};
