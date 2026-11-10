import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {PlannerPreferences} from './PlannerPreferences';
import {usePlannerPreferences} from './usePlannerPreferences';
export function PlannerPersonalizationPrompt(){
 const store=usePlannerPreferences(),[open,setOpen]=useState(false),[error,setError]=useState('');
 if(!store.preferences||store.preferences.reviewed_at)return null;
 return <><aside className="rounded-2xl border border-primary/20 bg-violet-950/30 p-4"><p className="font-semibold">Make your quests more personal</p><p className="mt-1 text-sm text-muted-foreground">Choose what you enjoy and what you’d like to try. Your planner can learn what fits.</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={()=>setOpen(true)}>Shape my adventure</Button><Button size="sm" variant="ghost" disabled={store.isSaving} onClick={()=>void store.save({reviewed_at:new Date().toISOString()}).catch(()=>setError('Could not save. Please try again.'))}>Not now</Button></div>{error&&<p role="alert">{error}</p>}</aside><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle className="sr-only">Shape your adventure</DialogTitle><DialogDescription className="sr-only">Optional interests and aspirations for your planner.</DialogDescription><PlannerPreferences setup onDone={()=>setOpen(false)}/></DialogContent></Dialog></>;
}
