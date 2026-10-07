/**
 * Injected into every proxied HTML document as the first script in <head>.
 *
 * Must stay dependency-free and self-contained — it runs inside a sandboxed
 * (opaque-origin) iframe on the proxy origin. Responsibilities:
 *
 * 1. Storage shims — localStorage/sessionStorage/cookie accessors that would
 *    otherwise throw or read empty under an opaque origin.
 * 2. URL rewrites — fetch/XHR/history/programmatic clicks stay in the proxy.
 * 3. Navigation containment — user clicks and GET form submissions are
 *    rewritten so the frame never lands on the real origin (XFO blank frames).
 * 4. WebSocket failure flag — WS cannot be proxied serverless; remember a
 *    failed handshake so the scanner below can report it.
 * 5. Refusal scanner — postMessage the parent when the page visibly refuses
 *    to work embedded (client-rendered interstitials the server can't see).
 */

export const PROXY_RUNTIME_ATTRIBUTE = 'data-perry-proxy-runtime'
export const PROXY_ENDPOINT_PREFIX = '/api/proxy?url='

// Conservative client-side patterns: only phrases sites show when they
// explicitly refuse embedding. All reported issues are dismissible.
const REFUSAL_PATTERNS = [
  'open in (an? |the |our |your )?(external |another |a different )?browser',
  'web version (is )?(unavailable|not available)',
  'not available (in|on|for) (the )?(this )?browser',
  'download (our |the |its )?(mobile )?app\\s+to\\s+(continue|watch|view|read|listen|browse)',
]

// Only consulted after a WebSocket handshake failure — weaker signals are
// safe here because they only escalate alongside a real network failure.
const WS_FAILURE_PATTERNS = [
  'failed to (connect|load)',
  'connection (failed|lost|error|refused|terminated)',
  'reconnecting',
  'real-?time (unavailable|failed|disconnected)',
  'you are (currently )?offline',
]

export function buildProxyRuntimeScript(target: URL): string {
  // Escape "<" so a crafted URL/path can never close the script tag early.
  const targetUrl = JSON.stringify(target.toString()).replace(/</g, '\\u003c')
  const proxyPath = JSON.stringify(PROXY_ENDPOINT_PREFIX).replace(/</g, '\\u003c')
  const refusalPatterns = JSON.stringify(REFUSAL_PATTERNS)
  const wsPatterns = JSON.stringify(WS_FAILURE_PATTERNS)

  return `<script ${PROXY_RUNTIME_ATTRIBUTE}="1">(function(){if(window.__PERRY_PROXY_RUNTIME__)return;window.__PERRY_PROXY_RUNTIME__=true;
const proxyOrigin=window.location.origin;const proxyPrefix=proxyOrigin+${proxyPath};let currentUrl=new URL(${targetUrl});

/* --- 1. storage shims (opaque origin) --- */
function perryStorage(){const m=new Map();return{get length(){return m.size},key(i){const k=Array.from(m.keys());return i>=0&&i<k.length?k[i]:null},getItem(k){k=String(k);return m.has(k)?m.get(k):null},setItem(k,v){m.set(String(k),String(v))},removeItem(k){m.delete(String(k))},clear(){m.clear()}}}
try{localStorage.setItem("__p","1");localStorage.removeItem("__p")}catch(e){try{Object.defineProperty(window,"localStorage",{configurable:true,value:perryStorage()})}catch(e){}}
try{sessionStorage.setItem("__p","1");sessionStorage.removeItem("__p")}catch(e){try{Object.defineProperty(window,"sessionStorage",{configurable:true,value:perryStorage()})}catch(e){}}
try{document.cookie="__p=1";if(!/__p=1/.test(document.cookie))throw new Error("opaque");document.cookie="__p="}catch(e){try{const jar=new Map();Object.defineProperty(document,"cookie",{configurable:true,get(){return Array.from(jar.values()).join("; ")},set(v){const s=String(v);const sc=s.indexOf(";");const nv=sc<0?s:s.slice(0,sc);const eq=nv.indexOf("=");if(eq<=0)return;const name=nv.slice(0,eq).trim();const val=nv.slice(eq+1);const rest=sc<0?"":s.slice(sc);if(val===""||/expires=thu,\\s*01\\s*jan\\s*1970/i.test(rest)||/max-age=0/i.test(rest))jar.delete(name);else jar.set(name,name+"="+val)}})}catch(e){}}

/* --- 2. url helpers + rewrites --- */
function toAbsolute(input,base){try{return new URL(String(input),base||currentUrl);}catch{return null;}}
function normalizeForProxy(absolute){if(!absolute||!/^https?:$/.test(absolute.protocol))return absolute;if(absolute.origin!==proxyOrigin)return absolute;if(absolute.pathname==='/api/proxy'){const encodedTarget=absolute.searchParams.get('url');if(encodedTarget){const decoded=toAbsolute(encodedTarget,currentUrl);if(decoded)return decoded;}return currentUrl;}return new URL(absolute.pathname+absolute.search+absolute.hash,currentUrl.origin);}
function toProxyUrl(input,base){const absolute=toAbsolute(input,base);const normalized=normalizeForProxy(absolute);if(!normalized||!/^https?:$/.test(normalized.protocol))return input;return proxyPrefix+encodeURIComponent(normalized.toString());}
function rewriteHistoryUrl(url){if(url==null||url==='')return url;const absolute=toAbsolute(url,currentUrl);const normalized=normalizeForProxy(absolute);if(!normalized||!/^https?:$/.test(normalized.protocol))return url;currentUrl=normalized;return proxyPrefix+encodeURIComponent(normalized.toString());}
if(window.fetch){const originalFetch=window.fetch.bind(window);window.fetch=function(input,init){try{if(input instanceof Request){return originalFetch(new Request(toProxyUrl(input.url,currentUrl),init),init);}if(typeof input==='string'||input instanceof URL){return originalFetch(toProxyUrl(String(input),currentUrl),init);}}catch{}return originalFetch(input,init);};}
const originalOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){const args=Array.prototype.slice.call(arguments);try{args[1]=toProxyUrl(String(url),currentUrl);}catch{}return originalOpen.apply(this,args);};
const originalPushState=history.pushState.bind(history);history.pushState=function(state,unused,url){return originalPushState(state,unused,rewriteHistoryUrl(url));};
const originalReplaceState=history.replaceState.bind(history);history.replaceState=function(state,unused,url){return originalReplaceState(state,unused,rewriteHistoryUrl(url));};
const originalAnchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){try{if(this.protocol==='http:'||this.protocol==='https:'){this.href=toProxyUrl(this.href,currentUrl);}}catch{}return originalAnchorClick.call(this);};

/* --- 3. user navigation containment (capture phase) --- */
document.addEventListener("click",function(e){
if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
const a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
if(!a)return;
const targetAttr=(a.getAttribute("target")||"").toLowerCase();
if(targetAttr&&targetAttr!=="_self")return;
if(a.hasAttribute("download"))return;
const raw=a.getAttribute("href")||"";
if(!raw||raw.charAt(0)==="#"||/^(mailto|tel|javascript|data|blob):/i.test(raw))return;
try{const href=String(a.href);if(!/^https?:$/.test(new URL(href).protocol))return;e.preventDefault();location.href=toProxyUrl(href,currentUrl);}catch(err){}
},true);
document.addEventListener("submit",function(e){
if(e.defaultPrevented)return;
const form=e.target;
if(!form||form.tagName!=="FORM")return;
const method=(form.getAttribute("method")||"get").toLowerCase();
if(method!=="get")return;
const targetAttr=(form.getAttribute("target")||"").toLowerCase();
if(targetAttr&&targetAttr!=="_self")return;
try{
const url=new URL(form.action||currentUrl.toString());
const fd=new FormData(form);
const params=new URLSearchParams();
fd.forEach(function(v,k){if(typeof v==="string")params.append(k,v);});
url.search=params.toString();
e.preventDefault();
location.href=toProxyUrl(url.toString(),currentUrl);
}catch(err){}
},true);

/* --- 4. websocket handshake failure flag --- */
if(window.WebSocket){const Native=window.WebSocket;function Wrapped(url,protocols){let ws;try{ws=new Native(url,protocols);}catch(err){window.__PERRY_WS_FAILED__=true;throw err;}try{ws.addEventListener("error",function(){window.__PERRY_WS_FAILED__=true;},{once:true});}catch(err){}return ws;}Wrapped.prototype=Native.prototype;try{Object.assign(Wrapped,Native);}catch(err){}window.WebSocket=Wrapped;}

/* --- 5. refusal scanner -> parent overlay --- */
const REFUSAL=${refusalPatterns}.map(function(p){return new RegExp(p,"i");});
const WSFAIL=${wsPatterns}.map(function(p){return new RegExp(p,"i");});
function perryReport(type){try{window.parent.postMessage({source:"perry-proxy",type:type},"*");}catch(err){}}
function perryScan(){
if(window.__PERRY_REPORTED__)return;
let text="";try{text=(document.body&&document.body.innerText)||"";}catch(err){return;}
const sample=text.slice(0,4000);
for(let i=0;i<REFUSAL.length;i++){if(REFUSAL[i].test(sample)){window.__PERRY_REPORTED__=true;perryReport("embed-refused");return;}}
if(window.__PERRY_WS_FAILED__){for(let i=0;i<WSFAIL.length;i++){if(WSFAIL[i].test(sample)){window.__PERRY_REPORTED__=true;perryReport("connection-failed");return;}}}
}
function perryStartScan(){
perryScan();
let deb=null;let mo=null;
try{mo=new MutationObserver(function(){clearTimeout(deb);deb=setTimeout(perryScan,800);});if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true});}catch(err){}
setTimeout(function(){try{if(mo)mo.disconnect();}catch(err){}clearTimeout(deb);},15000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",perryStartScan);else perryStartScan();
setTimeout(perryScan,2500);setTimeout(perryScan,7000);
})();</script>`
}
