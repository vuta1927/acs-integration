import{c,j as i,a as t}from"./index-D4BpVmOi.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=c("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=c("CircleSlash",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"9",x2:"15",y1:"15",y2:"9",key:"1dfufj"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=c("CircleX",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=c("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]),n={Published:{Icon:l,cls:"text-cr-ok border-cr-ok bg-cr-ok/10"},Skipped:{Icon:s,cls:"text-cr-neutral border-cr-neutral bg-cr-neutral/10"},Failed:{Icon:a,cls:"text-cr-critical border-cr-critical bg-cr-critical/10"},Pending:{Icon:d,cls:"text-cr-info border-cr-info bg-cr-info/10"}};function x({status:e,className:o}){const r=n[e]??n.Pending;return i.jsxs("span",{className:t("inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5","font-mono text-2xs font-medium",r.cls,o),children:[i.jsx(r.Icon,{size:12,strokeWidth:1.75,"aria-hidden":!0}),e]})}export{x as F};
