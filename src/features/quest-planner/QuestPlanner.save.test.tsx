import {cleanup,act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {QuestPlanner} from './QuestPlanner';
const mocks=vi.hoisted(()=>({read:vi.fn(),check:vi.fn(),add:vi.fn(),update:vi.fn(),record:vi.fn(),savePreference:vi.fn(),invoke:vi.fn(),remove:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'save-user'}})}));
vi.mock('./usePlannerPreferences',()=>({usePlannerPreferences:()=>({record:mocks.record,preferences:{explicit_preferences:[]},save:mocks.savePreference})}));
vi.mock('@/hooks/useVoiceInput',()=>({useVoiceInput:()=>({isListening:false})}));
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
describe('saving planner quests',()=>{
 it('keeps rapid taps to one write and reuses the fresh availability snapshot',async()=>{
  let finish!:(value:{id:string})=>void;mocks.add.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  const saving=open();const button=await screen.findByRole('button',{name:'Add quest to Agenda'});
  const scroll = screen.getByTestId('quest-planner-scroll');
  scroll.scrollTop = 800;
  Object.defineProperty(scroll, 'scrollHeight', {value: 1800, configurable: true});
  const scrollTo = vi.fn(() => {
    // This must run after the completion prompt has committed to the DOM.
    expect(screen.getByRole('region', {name:'Planner question'})).toHaveTextContent('What else would you like to plan?');
    scroll.scrollTop = 1800;
  });
  scroll.scrollTo = scrollTo;
  fireEvent.click(button);fireEvent.click(button);
  await screen.findByRole('button',{name:'Saving quest…'});
  expect(mocks.add).toHaveBeenCalledTimes(1);expect(mocks.check).toHaveBeenCalledWith(expect.objectContaining({task_text:'Read'}),snapshot,expect.any(Function));
  expect(mocks.read).toHaveBeenCalledTimes(2); // restore + one pre-save read, not two pre-save reads
  expect(scrollTo).not.toHaveBeenCalled();
  await act(async()=>finish({id:'first'}));
  await screen.findByText(/1 quest is in Agenda/);expect(saving).toHaveBeenLastCalledWith(false);
  expect(scrollTo).toHaveBeenCalledWith({top:1800,behavior:'auto'});
  expect(scroll.scrollTop).toBe(1800);
  expect(screen.getByRole('region',{name:'Planner question'})).toHaveTextContent('1 quest is in Agenda');
  expect(screen.getByText('Review your quest.')).toBeInTheDocument();
  expect(screen.getByRole('region', {name:'Quest plan'}).compareDocumentPosition(screen.getByRole('region', {name:'Planner question'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('button',{name:'Suggest another quest'})).toHaveClass('quest-planner-save');
 });
 it('carries the reviewed quest into the next date request and stops the pending save',async()=>{
  mocks.check.mockImplementation(async (_draft,_snapshot,chooseAnotherDay)=>{chooseAnotherDay();return null;});
  open();
  fireEvent.click(await screen.findByRole('button',{name:'Add quest to Agenda'}));
  await screen.findByText('Which day would you like to check for Read (30 minutes)?');
  fireEvent.click(screen.getByRole('button',{name:'2099-01-03'}));
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith('cosmiq-quest-planner',expect.objectContaining({body:expect.objectContaining({
    date:'2099-01-03',draft:expect.objectContaining({carried_duration:30,replacement_activity:expect.objectContaining({title:'Read'}),engagements:[],quests:[]}),
  })})));
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
 });
 it('returns to editing when schedule confirmation is cancelled',async()=>{
  mocks.check.mockResolvedValue(null);const saving=open();
  fireEvent.click(await screen.findByRole('button',{name:'Add quest to Agenda'}));
  await waitFor(()=>expect(saving).toHaveBeenLastCalledWith(false));
  expect(screen.getByRole('button',{name:'Add quest to Agenda'})).toBeEnabled();expect(mocks.add).not.toHaveBeenCalled();
 });
 it('preserves successful quests and retries only the failed quest',async()=>{
  mocks.add.mockResolvedValueOnce({id:'first'}).mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({id:'second'});
  const saving=open([quest(),quest('second')]);
  fireEvent.click(await screen.findByRole('button',{name:'Add 2 quests to Agenda'}));
  await screen.findByRole('alert');expect(saving).toHaveBeenLastCalledWith(false);
  expect(screen.queryByText('What else would you like to plan?')).not.toBeInTheDocument();
  const retry=screen.getByRole('button',{name:'Add quest to Agenda'});expect(retry).toBeEnabled();fireEvent.click(retry);
  await screen.findByText(/2 quests are in Agenda/);
  expect(mocks.add.mock.calls.map(([p])=>p.creationId)).toEqual(['first','second','second']);
 });
 it('finishes a queued save with an honest confirmation instead of waiting for sync',async()=>{
  mocks.add.mockResolvedValue({id:'first',queued:true});const saving=open();
  fireEvent.click(await screen.findByRole('button',{name:'Add quest to Agenda'}));
  await screen.findByText('Added to Agenda on this device. Changes will sync when connected.');
  expect(saving).toHaveBeenLastCalledWith(false);expect(mocks.add).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(key)!).queued).toEqual(['first']);
 });
});

describe('planner conversation controls',()=>{
 const reply=(changes={})=>({phase:'details',reply:'How long would you like to read?',input_hint:'For example, 20 minutes…',choices:['15 minutes','30 minutes'],quests:[],engagements:[],time_choices:[],...changes});
 function openQuestion(plan=reply(),previous=[] as unknown[],saved=[] as string[]){
  localStorage.setItem(key,JSON.stringify({history:[{role:'user',content:'I want to read at 7 PM'},{role:'assistant',content:plan.reply}],saved,queued:[],plan,previous}));
  render(<QuestPlanner selectedDate={new Date(`${date}T12:00:00`)} onClose={vi.fn()}/>);
 }
 it('shows the current question hint and sends a selected answer with its context',async()=>{
  mocks.invoke.mockResolvedValue({data:reply({phase:'review',reply:'Review reading.',input_hint:'Tell me what to change…',choices:[],quests:[quest()]}),error:null});
  openQuestion();
  const button=await screen.findByRole('button',{name:/15 minutes/});
  expect(screen.getByRole('textbox',{name:'Your answer'})).toHaveAttribute('placeholder','For example, 20 minutes…');
  const scroll=screen.getByTestId('quest-planner-scroll');
  Object.defineProperty(scroll, 'scrollHeight', {value: 1600, configurable: true});
  scroll.scrollTo=vi.fn();
  fireEvent.click(button);
  await screen.findByRole('button',{name:'Add quest to Agenda'});
  expect(scroll.scrollTo).toHaveBeenLastCalledWith({top:1600,behavior:'auto'});
  const previousQuestion=screen.getByText('How long would you like to read?');
  const answer=screen.getByText('15 minutes', {exact:true});
  const latest=screen.getByRole('region',{name:'Planner question'});
  expect(previousQuestion.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(answer.compareDocumentPosition(latest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(mocks.invoke).toHaveBeenCalledWith('cosmiq-quest-planner',expect.objectContaining({body:expect.objectContaining({message:'15 minutes',draft:expect.objectContaining({phase:'details'}),history:expect.arrayContaining([{role:'user',content:'I want to read at 7 PM'}])})}));
  expect(screen.getByRole('textbox',{name:'Your answer'})).toHaveAttribute('placeholder','Tell me what to change…');
  expect(mocks.add).not.toHaveBeenCalled();
 });
 it('allows a typed request while answering a question without writing before review',async()=>{
  mocks.invoke.mockResolvedValue({data:reply({phase:'review',reply:'Review drawing.',choices:[],quests:[quest('second')]}),error:null});
  openQuestion();await screen.findByRole('button',{name:/15 minutes/});
  fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'Actually draw at 8 PM for 30 minutes'}});
  fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
  await screen.findByRole('button',{name:'Add quest to Agenda'});
  expect(mocks.invoke.mock.calls[0][1].body.message).toBe('Actually draw at 8 PM for 30 minutes');
  expect(mocks.add).not.toHaveBeenCalled();
 });
 it('requires reset confirmation, clears conversation, and keeps saved Agenda tasks',async()=>{
  mocks.invoke.mockResolvedValue({data:reply({reply:'Anything else already booked?',choices:['Nothing else','One more booking']}),error:null});
  openQuestion(reply(),[],['already-saved']);await screen.findByRole('button',{name:/15 minutes/});
  fireEvent.click(screen.getByRole('button',{name:'Start over'}));
  expect(mocks.invoke).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Keep planning'}));
  expect(screen.getByRole('textbox',{name:'Your answer'})).toHaveAttribute('placeholder','For example, 20 minutes…');
  fireEvent.click(screen.getByRole('button',{name:'Start over'}));
  fireEvent.click(screen.getByRole('button',{name:'Reset conversation'}));
  await screen.findByRole('button',{name:/Nothing else/});
  expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({history:[],draft:null});
  expect(mocks.add).not.toHaveBeenCalled();expect(mocks.remove).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key)!).previous).toEqual([]);
 });
 it('Back rechecks old time options against newly occupied time',async()=>{
  const old=reply({reply:'Choose a time.',input_hint:'Enter a time…',choices:['7 PM','Find an open time for me'],time_choices:[{choice:'7 PM',date,time:'19:00',duration:30}]});
  openQuestion(reply(),[{history:[],plan:old}]);await screen.findByRole('button',{name:/15 minutes/});
  mocks.read.mockResolvedValue({...snapshot,tasks:[{id:'new-booking',task_text:'Dinner',task_date:date,scheduled_time:'19:00',estimated_duration:60,completed:false}]});
  fireEvent.click(screen.getByRole('button',{name:'Back'}));
  await screen.findByRole('button',{name:/Find an open time for me/});
  expect(screen.queryByRole('button',{name:/7 PM/})).not.toBeInTheDocument();
  expect(mocks.invoke).not.toHaveBeenCalled();expect(mocks.add).not.toHaveBeenCalled();
 });
});
it('honors a campaign launch even when a different conversation is saved',async()=>{
 localStorage.setItem(key,JSON.stringify({history:[{role:'user',content:'Draw'}],saved:['existing'],queued:[],plan:{phase:'review',reply:'Draw tomorrow',quests:[quest()],engagements:[],choices:[]}}));
 mocks.invoke.mockResolvedValue({data:{phase:'goals',reply:'Let’s work on your reading campaign.',input_hint:'Which chapter?',choices:['Read','Discuss'],quests:[],engagements:[]},error:null});
 render(<QuestPlanner onClose={vi.fn()} launchIntent={{id:'campaign',starterIntent:'goal_breakdown',selectedDate:date,message:'Plan my reading campaign'}}/>);
 await waitFor(()=>expect(mocks.invoke).toHaveBeenCalled());
 expect(mocks.invoke.mock.calls[0][1].body.message).toBe('Plan my reading campaign');
 expect(JSON.parse(localStorage.getItem(key)!).saved).toContain('existing');
});


describe('additional guided quest continuity',()=>{
 const shortcut={phase:'review',reply:'Here is another quest.',choices:[],engagements:[],quests:[quest('second')]};
 it('restores the conversation and question round without regenerating or saving again',async()=>{
  open(); fireEvent.click(await screen.findByRole('button',{name:'Add quest to Agenda'}));
  await screen.findByText(/1 quest is in Agenda/);
  mocks.invoke.mockResolvedValue({data:shortcut,error:null});
  fireEvent.click(screen.getByRole('button',{name:'Suggest another quest'}));
  await screen.findByText('What goal would you like this next quest to support?');
  cleanup();
  render(<QuestPlanner selectedDate={new Date(`${date}T12:00:00`)} onClose={vi.fn()}/>);
  await screen.findByText('What goal would you like this next quest to support?');
  expect(screen.getByRole('article',{name:'Earlier quest: Read'})).toHaveTextContent('Added to Agenda');
  expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
  expect(mocks.invoke).toHaveBeenCalledTimes(1); expect(mocks.add).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Build my mind'}));
  await screen.findByText('Which activity would you like to do for that goal?');
  expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
 });
 it('keeps the new round on its first question when a schedule failure is retried',async()=>{
  open(); fireEvent.click(await screen.findByRole('button',{name:'Add quest to Agenda'}));
  await screen.findByText(/1 quest is in Agenda/);
  mocks.read.mockResolvedValue({...snapshot,incomplete:true});
  fireEvent.click(screen.getByRole('button',{name:'Suggest another quest'}));
  await screen.findByRole('alert');
  mocks.read.mockResolvedValue(snapshot);mocks.invoke.mockResolvedValue({data:shortcut,error:null});
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  await screen.findByText('What goal would you like this next quest to support?');
  expect(mocks.invoke.mock.calls.at(-1)[1].body).toMatchObject({history:[],draft:null});
  expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
  expect(mocks.add).toHaveBeenCalledTimes(1);
 });
});

describe('answering contextual planner questions',()=>{
 const rule='Leave 20 minutes after class';
 const check={kind:'reuse',booking_id:'session',activity:'trying a recipe'};
 function showQuestion(){
  localStorage.setItem(key,JSON.stringify({guidedQuestStep:2,history:[],saved:[],queued:[],plan:{
   phase:'details',schedule_check:check,reply:'Use your cooking session for this recipe?',memory_suggestion:rule,
   choices:['Use the existing session','Add an extra session'],engagements:[],quests:[]}}));
  render(<QuestPlanner selectedDate={new Date(`${date}T12:00:00`)} onClose={vi.fn()}/>);
 }
 it('keeps a correction local after dismissal and closes the guided round on reuse',async()=>{
  showQuestion();
  fireEvent.click(await screen.findByRole('button',{name:'Just for now'}));
  expect(mocks.savePreference).not.toHaveBeenCalled();
  mocks.invoke.mockResolvedValueOnce({data:{phase:'goals',reply:'You can use your cooking session.',quests:[],engagements:[],choices:['Plan another quest','Finish planning'],memory_suggestion:rule},error:null});
  fireEvent.click(screen.getByRole('button',{name:/Use the existing session/}));
  await screen.findByText('You can use your cooking session.');
  expect(mocks.invoke.mock.calls.at(-1)[1].body.declinedMemorySuggestions).toEqual([rule]);
  expect(screen.queryByRole('button',{name:'Remember this'})).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!).guidedQuestStep).toBeUndefined();
  expect(mocks.add).not.toHaveBeenCalled();
 });
 it('writes the preference only after the user selects Remember this',async()=>{
  mocks.savePreference.mockResolvedValueOnce(undefined);
  showQuestion();
  const remember=await screen.findByRole('button',{name:'Remember this'});
  expect(mocks.savePreference).not.toHaveBeenCalled();
  fireEvent.click(remember);
  await screen.findByText('Preference saved. You can change it in Settings.');
  expect(mocks.savePreference).toHaveBeenCalledWith({explicit_preferences:[rule]});
 });
});
