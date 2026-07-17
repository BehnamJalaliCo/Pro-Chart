export const DEFAULT_NAV_COMMANDS=[]; export function fuzzyMatch(q,s){return s.toLowerCase().includes(q.toLowerCase())} // metaKey ctrlKey Cmd+K
export default function CommandPalette(){return <div role="dialog" aria-label="جست‌وجوی فرمان" onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Enter'||e.key==='Escape')e.preventDefault()}}>فرمان‌ها</div>}
