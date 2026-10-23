export const PLAYBOOKS:Record<string,{title:string;cause:string;steps:string[];commands:Record<string,string[]>;remedy:string;debug?:Record<string,string>}>;
export function mountPlaybook(root:HTMLElement,getVendor?:()=>string):()=>void;
