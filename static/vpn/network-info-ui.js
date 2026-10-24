import { loadNetworkInfo, renderNetworkInfo } from './network-info.js';

const root=document.querySelector('.noc-header-network');
if(root)loadNetworkInfo({includeLocation:false,onUpdate:result=>renderNetworkInfo(root,result)}).then(result=>renderNetworkInfo(root,result));
