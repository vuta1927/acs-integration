import{c as a,r as l,j as r,a as i}from"./index-D4BpVmOi.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=a("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=a("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]);function u(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,e=>/^"/.test(e)?/:$/.test(e)?`<span style="color:var(--cr-info)">${e}</span>`:`<span style="color:var(--cr-text)">${e}</span>`:/true|false|null/.test(e)?`<span style="color:var(--cr-text-muted)">${e}</span>`:`<span style="color:var(--cr-minor)">${e}</span>`)}function y({value:t,className:e}){const[o,s]=l.useState(!1),n=(()=>{try{return JSON.stringify(t,null,2)}catch{return String(t)}})(),c=async()=>{await navigator.clipboard.writeText(n),s(!0),setTimeout(()=>s(!1),2e3)};return r.jsxs("div",{className:i("relative rounded-control border border-cr-border bg-cr-bg-deep",e),children:[r.jsxs("button",{onClick:c,className:"absolute right-2 top-2 flex items-center gap-1 rounded-control border border-cr-border bg-cr-panel px-2 py-1 text-2xs text-cr-muted transition-colors hover:text-cr-text","aria-label":"Copy JSON",children:[o?r.jsx(p,{size:12}):r.jsx(d,{size:12}),o?"Copied":"Copy"]}),r.jsx("pre",{className:"overflow-auto p-3 pt-8 font-mono text-2xs leading-relaxed",dangerouslySetInnerHTML:{__html:u(n)}})]})}export{p as C,y as J};
