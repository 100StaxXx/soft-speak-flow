import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {QuestPlanner} from './QuestPlanner';
const mocks=vi.hoisted(()=>({read:vi.fn(),check:vi.fn(),add:vi.fn(),update:vi.fn(),record:vi.fn(),invoke:vi.fn(),remove:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'save-user'}})}));
vi.mock('./usePlannerPreferences',()=>({usePlannerPreferences:()=>({record:mocks.record,preferences:{explicit_preferences:[]},save:vi.fn()})}));
const voiceMock = vi.hoisted(() => ({ emit: undefined as undefined | ((event: import('@/services/voiceCapture').VoiceCaptureEvent) => void), stop: vi.fn(), cancel: vi.fn() }));
vi.mock('@/services/voiceCapture', () => ({ supportsVoiceCapture: () => true, createVoiceCapture: (_language: string, emit: typeof voiceMock.emit) => { voiceMock.emit = emit; return voiceMock; } }));
vi.mock('@/hooks/useCalendarIntegrations',()=>({useCalendarIntegrations:()=>({connections:[],isLoading:false,hasLoadError:false,settings:{},reloadScheduleSources:vi.fn()})}));
vi.mock('@/hooks/useTaskMutations',()=>({useTaskMutations:()=>({addTask:mocks.add,updateTask:mocks.update,deleteTask:mocks.remove})}));
vi.mock('@/hooks/useQuestScheduleGuard',()=>({useQuestScheduleGuard:()=>({checkSchedule:mocks.check,conflictDialog:null})}));
vi.mock('@/services/questScheduleAvailability',()=>({loadQuestScheduleAvailability:mocks.read}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
const date='2099-01-02',key=`cosmiq:quest-planner:save-user:${date}`;
const snapshot={tasks:[],events:[],incomplete:false};
const quest=(id='first')=>({id,task_id:null,title:id==='first'?'Read':'Draw',goal:'Personal goal',time:id==='first'?'18:00':'19:00',date,duration:30,epic_id:null,category:'mind'});
function open(quests=[quest()]){
 localStorage.setItem(key,JSON.stringify({history:[],saved:[],queued:[],plan:{phase:'review',reply:'Review your quest.',input_hint:'Change anything…',quests,engagements:[],choices:[]}}));
 const saving=vi.fn();render(<QuestPlanner selectedDate={new Date(`${date}T12:00:00`)} onClose={vi.fn()} onSavingChange={saving}/>);return saving;
}
beforeEach(()=>{
 localStorage.clear();vi.clearAllMocks();mocks.read.mockResolvedValue(snapshot);mocks.check.mockImplementation(async draft=>draft);mocks.add.mockImplementation(async p=>({id:p.creationId}));mocks.record.mockResolvedValue(undefined);
});

it('lets users review a complete spoken request without losing typed text or sending partial words', async () => {
 open(); await screen.findByRole('button', {name:'Add quest to Agenda'});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'Tomorrow:'}});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'}));
 act(() => voiceMock.emit?.({type:'started'}));
 act(() => voiceMock.emit?.({type:'transcript',text:'Meet Cynthia at ten'}));
 expect(screen.getByText('Meet Cynthia at ten')).toBeVisible();
 expect(screen.getByRole('button',{name:'Send answer'})).toBeEnabled(); expect(mocks.invoke).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Stop recording'}));
 expect(screen.getByRole('button',{name:'Send answer'})).toBeDisabled();
 act(() => { voiceMock.emit?.({type:'transcript',text:'Meet Cynthia at ten, remind me an hour before.'}); voiceMock.emit?.({type:'ended'}); });
 expect(screen.getByRole('textbox',{name:'Your answer'})).toHaveValue('Tomorrow: Meet Cynthia at ten, remind me an hour before.');
 expect(mocks.invoke).not.toHaveBeenCalled(); expect(screen.getByRole('button',{name:'Send answer'})).toBeEnabled();
});
it('cancels spoken words without erasing a typed draft', async () => {
 open(); await screen.findByRole('button', {name:'Add quest to Agenda'});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'Keep this'}});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'})); act(() => { voiceMock.emit?.({type:'started'}); voiceMock.emit?.({type:'transcript',text:'Discard this'}); });
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 act(() => voiceMock.emit?.({type:'ended'}));
 expect(screen.getByRole('textbox',{name:'Your answer'})).toHaveValue('Keep this'); expect(mocks.invoke).not.toHaveBeenCalled();
});

it('stops recording immediately when the planner closes, even if its parent keeps it mounted',async()=>{
 open(); await screen.findByRole('button',{name:'Add quest to Agenda'});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'})); act(()=>voiceMock.emit?.({type:'started'}));
 fireEvent.click(screen.getByRole('button',{name:'Close planner'}));
 expect(voiceMock.cancel).toHaveBeenCalled(); expect(screen.queryByLabelText('Voice input')).not.toBeInTheDocument();
});
it('warns when a spoken request exceeds the composer limit',async()=>{
 open(); await screen.findByRole('button',{name:'Add quest to Agenda'});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'}));
 act(()=>{voiceMock.emit?.({type:'started'});voiceMock.emit?.({type:'transcript',text:'a'.repeat(2100)});voiceMock.emit?.({type:'ended'});});
 expect(screen.getByRole('alert')).toHaveTextContent('2,000-character limit');
 expect((screen.getByRole('textbox',{name:'Your answer'}) as HTMLTextAreaElement).value).toHaveLength(2000);
 expect(mocks.invoke).not.toHaveBeenCalled();
});

it('sends once after the final words arrive, preserving the typed prefix', async () => {
 open(); await screen.findByRole('button', {name:'Add quest to Agenda'});
 mocks.invoke.mockResolvedValue({data:{phase:'clarify',reply:'How long?',quests:[],engagements:[],choices:[]},error:null});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'Please:'}});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'}));
 act(()=>{voiceMock.emit?.({type:'started'});voiceMock.emit?.({type:'transcript',text:'Read a book'});});
 fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
 expect(voiceMock.stop).toHaveBeenCalledOnce(); expect(mocks.invoke).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Send answer'})).toBeDisabled();
 act(()=>{voiceMock.emit?.({type:'transcript',text:'Read a book for twenty minutes'});voiceMock.emit?.({type:'ended'});voiceMock.emit?.({type:'ended'});});
 await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledOnce());
 expect(mocks.invoke.mock.calls[0][1].body.message).toBe('Please: Read a book for twenty minutes');
});
it('cancels a pending voice send when the planner closes', async () => {
 open(); await screen.findByRole('button', {name:'Add quest to Agenda'});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'}));
 act(()=>{voiceMock.emit?.({type:'started'});voiceMock.emit?.({type:'transcript',text:'Read a book'});});
 fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
 fireEvent.click(screen.getByRole('button',{name:'Close planner'}));
 act(()=>voiceMock.emit?.({type:'ended'}));
 expect(mocks.invoke).not.toHaveBeenCalled();
});
it('keeps an overlong voice send as a draft for review instead of submitting truncated words', async () => {
 open(); await screen.findByRole('button', {name:'Add quest to Agenda'});
 fireEvent.click(screen.getByRole('button',{name:'Use voice input'}));
 act(()=>{voiceMock.emit?.({type:'started'});voiceMock.emit?.({type:'transcript',text:'a'.repeat(2100)});});
 fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
 act(()=>voiceMock.emit?.({type:'ended'}));
 expect(mocks.invoke).not.toHaveBeenCalled();
 expect(screen.getByRole('alert')).toHaveTextContent('2,000-character limit');
});
