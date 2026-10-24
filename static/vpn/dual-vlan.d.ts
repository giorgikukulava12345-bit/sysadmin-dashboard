import type {LabSite} from './lab.js';
export function hasSecondVlan(site:LabSite):boolean;
export function validateSecondVlan(site:LabSite,peer?:LabSite):string[];
export function dualVlanRouterConfig(site:LabSite):string;
export function dualVlanSwitchConfig(site:LabSite):string;
export function routedSite(site:LabSite):LabSite;
