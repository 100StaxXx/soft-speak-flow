import {useEffect,useState} from 'react';
import {Compass,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {InterestBubbles} from './InterestBubbles';
import {usePlannerPreferences} from './usePlannerPreferences';
import {interestCatalog,aspirationCatalog,cleanInterests,defaultPlannerPreferences,type PlannerPreferences as Preferences} from '../../../supabase/functions/_shared/plannerLearning';
export function PlannerPreferences({onDone,setup=false,initialLearning}:{onDone?:()=>void;setup?:boolean;initialLearning?:boolean}){
 const store=usePlannerPreferences(),[draft,setDraft]=useState<Preferences>(defaultPlannerPreferences),[note,setNote]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState('');
 useEffect(()=>{if(store.preferences)setDraft({...store.preferences,...(setup&&initialLearning!==undefined?{learning_enabled:initialLearning}:{})});},[store.preferences,setup,initialLearning]);
 async function save(){setError('');try{await store.save({...draft,reviewed_at:new Date().toISOString()});setStatus('Your planner preferences are saved.');onDone?.();}catch(e){setError(e instanceof Error?e.message:'Could not save.');}}
 async function skip(){setError('');try{await store.save({reviewed_at:new Date().toISOString(),learning_enabled:draft.learning_enabled});onDone?.();}catch{setError('Could not save your choice. Try again.');}}
 if(store.isLoading)return <p role="status">Loading your adventure preferences…</p>;
 if(store.isError)return <div role="alert">Your preferences could not be loaded.<Button onClick={()=>void store.refetch()}>Retry</Button>{onDone&&<Button variant="ghost" onClick={onDone}>Continue for now</Button>}</div>;
 const section=(aspirations:boolean)=><section className="story-panel space-y-4 p-4"><div className="space-y-2"><h3 className="font-cinzel text-xl leading-snug text-amber-100">{aspirations?'What would you like to do more of?':'What do you enjoy?'}</h3><p className="text-sm text-slate-300">{aspirations?'A new skill, a healthier rhythm, or something just for you.':'Pick the interests that feel like you.'}</p></div><InterestBubbles label={aspirations?'Aspirations':'Interests'} previewCount={setup?8:12} catalog={aspirations?aspirationCatalog:interestCatalog} value={aspirations?draft.aspirations:draft.interests} onChange={items=>setDraft({...draft,[aspirations?'aspirations':'interests']:items})}/></section>;
 return <div className="story-menu story-surface space-y-6 p-5 text-left">
 <p className="flex items-center gap-2 text-xs uppercase tracking-[.2em] text-amber-200"><Compass size={20}/>Shape your adventure</p>
 {setup&&<p className="text-sm text-slate-300">Interests and things you’d like to try help shape your quests and campaign ideas. Choose a few, or skip. You can change them anytime.</p>}
 <div className="grid gap-5 md:grid-cols-2">{section(false)}{section(true)}</div>
 {!setup&&<>
 <section className="space-y-3"><h3 className="font-semibold">What should your planner remember?</h3><p className="text-xs text-slate-300">For example: “I prefer evening walks” or “I don’t have a gym membership.” These take priority over learned patterns.</p>
 <div className="flex gap-2"><input aria-label="New planner preference" maxLength={120} value={note} onChange={e=>setNote(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950 p-2"/><Button disabled={!note.trim()} onClick={()=>{setDraft({...draft,explicit_preferences:cleanInterests([...draft.explicit_preferences,note])});setNote('');}}>Add</Button></div>
 {draft.explicit_preferences.map(text=><div key={text} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2 text-sm"><span>{text}</span><Button size="icon" variant="ghost" aria-label={`Forget ${text}`} onClick={()=>setDraft({...draft,explicit_preferences:draft.explicit_preferences.filter(x=>x!==text)})}><X size={14}/></Button></div>)}
 </section>
 {!!(draft.interests.length+draft.aspirations.length)&&<details><summary className="cursor-pointer text-sm">Which interests can become suggestions?</summary><p className="my-2 text-xs text-slate-300">Keep an interest in your profile without receiving quests for it.</p>{cleanInterests([...draft.interests,...draft.aspirations]).map(item=><label key={item} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={!draft.excluded_interests.includes(item)} onChange={e=>setDraft({...draft,excluded_interests:e.target.checked?draft.excluded_interests.filter(x=>x!==item):cleanInterests([...draft.excluded_interests,item])})}/>{item}</label>)}</details>}

 <section className="space-y-2"><h3 className="font-semibold">What your planner has learned</h3>{store.eventsError?<p className="text-sm">Learning history could not be loaded.</p>:store.patterns.length?store.patterns.filter(p=>!draft.forgotten_patterns.includes(p.id)).map(p=><div key={p.id} className="rounded-lg bg-white/5 p-3 text-sm"><p>{p.explanation}</p><Button variant="ghost" size="sm" onClick={()=>setDraft({...draft,forgotten_patterns:[...draft.forgotten_patterns,p.id]})}>Forget this pattern</Button></div>):<p className="text-sm text-slate-400">Patterns appear after repeated choices across several days.</p>}
 <Button variant="outline" disabled={store.isSaving} onClick={async()=>{try{await store.reset();setStatus('Learned patterns reset. Your interests and explicit preferences remain.');}catch(e){setError(String(e));}}}>Reset learned patterns</Button></section>
 </>}
  {!setup&&<label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={draft.learning_enabled} onChange={e=>setDraft({...draft,learning_enabled:e.target.checked,learning_since:e.target.checked&&!store.preferences?.learning_enabled?new Date().toISOString():draft.learning_since})}/><span>Learn from my planning and quest activity<span className="mt-1 block text-xs text-slate-400">Repeated patterns help. A missed quest is not a judgment. Turning this off keeps your chosen preferences.</span></span></label>}
 {error&&<p role="alert" className="text-rose-200">{error}</p>}{status&&<p role="status" className="text-emerald-200">{status}</p>}
 <div className="sticky bottom-0 flex flex-wrap gap-2 rounded-xl bg-slate-950/95 p-2"><Button className="story-action min-h-12 flex-1" disabled={store.isSaving} onClick={()=>void save()}>{store.isSaving?'Saving…':setup?'Save and continue':'Save preferences'}</Button>{setup&&<Button variant="ghost" disabled={store.isSaving} onClick={()=>void skip()}>Skip for now</Button>}</div>
 </div>;
}
