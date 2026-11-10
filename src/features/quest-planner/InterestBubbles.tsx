import {useState} from 'react';
import {Check,Plus,Search} from 'lucide-react';
import {cleanInterests,interestKey} from '../../../supabase/functions/_shared/plannerLearning';
export function InterestBubbles({label,catalog,value,onChange,previewCount=12}:{label:string;catalog:string[];value:string[];onChange:(value:string[])=>void;previewCount?:number}){
 const [search,setSearch]=useState(''),[expanded,setExpanded]=useState(false);
 const filtered=cleanInterests([...value,...catalog]).filter(x=>interestKey(x).includes(interestKey(search)));
 const options=search.trim()||expanded?filtered:filtered.slice(0,previewCount);
 const selected=new Set(value.map(interestKey));
 const custom=search.trim()&&!cleanInterests([...value,...catalog]).some(x=>interestKey(x)===interestKey(search));
 const toggle=(text:string)=>onChange(selected.has(interestKey(text))?value.filter(x=>interestKey(x)!==interestKey(text)):cleanInterests([...value,text]));
 return <div className="space-y-4" role="group" aria-label={label}>
  <label className="flex items-center gap-2 rounded-xl border border-primary/25 bg-slate-950/50 px-3"><Search size={17} aria-hidden="true"/><input aria-label={`Search or add ${label.toLowerCase()}`} value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} placeholder="Search or add your own…" className="min-h-12 w-full bg-transparent text-base outline-none" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(search.trim()){onChange(cleanInterests([...value,search]));setSearch('');}}}}/></label>
  <div className="flex flex-wrap gap-2">{options.map(option=>{const active=selected.has(interestKey(option));return <button key={interestKey(option)} type="button" aria-pressed={active} onClick={()=>toggle(option)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors motion-reduce:transition-none ${active?'border-primary bg-primary text-primary-foreground':'border-primary/20 bg-slate-800/60 text-slate-200 hover:bg-primary/40'}`}>{active&&<Check size={14} aria-hidden="true"/>}{option}</button>;})}
  {custom&&<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-amber-200/50 px-4 py-2 text-sm text-amber-100" onClick={()=>{onChange(cleanInterests([...value,search]));setSearch('');}}><Plus size={15}/>Add “{search.trim()}”</button>}</div>
  {!search.trim()&&filtered.length>previewCount&&<button type="button" className="min-h-11 text-sm text-primary underline underline-offset-4" onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer':'Explore more'}</button>}
  <p className="text-xs text-slate-400">{value.length?`${value.length} selected · Change these anytime.`:'Pick a few, or skip for now. There’s no minimum.'}</p>
 </div>;
}
