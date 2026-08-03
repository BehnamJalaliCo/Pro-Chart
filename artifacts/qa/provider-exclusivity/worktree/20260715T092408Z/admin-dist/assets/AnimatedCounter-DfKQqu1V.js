import{c as a,j as l,r as u}from"./index-Dfmxzewf.js";import{t as M}from"./ErrorState-jzwtfGWA.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=a("Crown",[["path",{d:"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",key:"1vdc57"}],["path",{d:"M5 21h14",key:"11awu3"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=a("KeyRound",[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=a("LogIn",[["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",key:"u53s6r"}],["polyline",{points:"10 17 15 12 10 7",key:"1ail0h"}],["line",{x1:"15",x2:"3",y1:"12",y2:"12",key:"v6grx8"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=a("Pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=a("UserX",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"17",x2:"22",y1:"8",y2:"13",key:"3nzzx3"}],["line",{x1:"22",x2:"17",y1:"8",y2:"13",key:"1swrse"}]]),x={green:"#00C853",red:"#FF1744",blue:"#2979FF",amber:"#FFB300"};function P({active:n=!0,color:s="green",size:e=8,className:d=""}){const r=x[s]||x.green;return l.jsxs("span",{className:`relative inline-flex shrink-0 ${d}`,style:{width:e,height:e},"aria-hidden":"true",children:[n&&l.jsx("span",{className:"absolute inset-0 rounded-full animate-soft-pulse",style:{backgroundColor:r}}),l.jsx("span",{className:"relative inline-flex rounded-full",style:{width:e,height:e,backgroundColor:n?r:"#5b6172",boxShadow:n?`0 0 ${e}px ${r}66`:"none"}})]})}function U({value:n=0,decimals:s=0,duration:e=800,prefix:d="",suffix:r="",className:k=""}){const o=Number(n)||0,[g,m]=u.useState(o),c=u.useRef(o),i=u.useRef(null);u.useEffect(()=>{const F=typeof window<"u"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,y=c.current,t=o;if(F||e<=0||y===t){m(t),c.current=t;return}const L=performance.now(),b=h=>1-Math.pow(1-h,3),f=h=>{const p=Math.min(1,(h-L)/e),C=y+(t-y)*b(p);m(C),p<1?i.current=requestAnimationFrame(f):(m(t),c.current=t)};return i.current=requestAnimationFrame(f),()=>{i.current&&cancelAnimationFrame(i.current),c.current=t}},[o,e]);const w=M(Number(g).toLocaleString("en-US",{minimumFractionDigits:s,maximumFractionDigits:s}));return l.jsxs("span",{className:k,children:[d,w,r]})}export{U as A,j as C,A as K,P as L,N as P,S as U,D as a};
