import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JourneysCompanionPlannerModal } from './JourneysCompanionPlannerModal';
const mocks = vi.hoisted(() => ({ record: vi.fn(), remember: vi.fn(), remove: vi.fn(), reload: vi.fn(), invoke: vi.fn(), availability: vi.fn(), add: vi.fn(), update: vi.fn(), check: vi.fn() }));
vi.mock('@/utils/plannerSync', () => ({ PLANNER_SYNC_EVENT: 'planner-sync-finished' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'planning-user' } }) }));
vi.mock('@/hooks/useCalendarIntegrations', () => ({ useCalendarIntegrations: () => ({ reloadScheduleSources: mocks.reload, connections: [], settings: null, isLoading: false, hasLoadError: false }) }));
vi.mock('@/hooks/useTaskMutations', () => ({ useTaskMutations: () => ({ addTask: mocks.add, updateTask: mocks.update, deleteTask: mocks.remove }) }));
vi.mock('@/hooks/useQuestScheduleGuard', () => ({ useQuestScheduleGuard: () => ({ checkSchedule: mocks.check, conflictDialog: null }) }));
vi.mock('@/services/questScheduleAvailability', () => ({ loadQuestScheduleAvailability: mocks.availability }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/features/quest-planner/usePlannerPreferences',()=>({usePlannerPreferences:()=>({preferences:{explicit_preferences:[],learning_enabled:true},record:mocks.record,save:mocks.remember})}));
const introduction = { phase: 'commitments', reply: 'I have your work hours. Is anything else already booked tomorrow?', choices: ['Nothing else booked'], engagements: [], quests: [] };
const quest = { id: 'proposal-1', task_id: null, title: 'Read a chapter', goal: 'Learn astronomy', epic_id: 'campaign-1', time: '18:00', duration: 20, category: 'mind' };
function open() { return render(<JourneysCompanionPlannerModal open onOpenChange={vi.fn()} presentation="dialog" launchIntent={{ id: 'launch', target: 'planner', starterIntent: 'briefing_followup', selectedDate: '2026-10-27', message: 'Prepare me for tomorrow' }}/>); }
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); mocks.record.mockResolvedValue(undefined); mocks.remember.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); mocks.reload.mockResolvedValue({ connections: [], visibleCalendars: undefined, calendarsLoading: false }); mocks.availability.mockResolvedValue({ tasks: [], events: [], commitments: [], incomplete: false });
  mocks.invoke.mockResolvedValue({ data: introduction, error: null }); mocks.add.mockResolvedValue({ id: 'saved' }); mocks.update.mockResolvedValue({ id: 'existing' }); mocks.check.mockImplementation(async value => value);
});
describe('the single-flow adventure planner', () => {
  it('asks about engagements through the new endpoint without old category menus', async () => {
    open(); await screen.findByText(introduction.reply);
    expect(mocks.invoke.mock.calls.map(call => call[0])).toEqual(['cosmiq-quest-planner']);
    expect(screen.queryByRole('button', { name: 'Logistics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Priorities' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Planning date')).toHaveValue('2026-10-27');
    fireEvent.click(screen.getByRole('button', { name: 'Nothing else booked' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke.mock.calls[1][0]).toBe('cosmiq-quest-planner');
    expect(mocks.invoke.mock.calls[1][1].body.message).toBe('Nothing else booked');
  });
  it('lets the user edit time and duration, confirms before saving, and keeps the campaign link', async () => {
    mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', choices: [], quests: [quest] } });
    open(); await screen.findByText('Learn astronomy');
    expect(mocks.add).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Start time for Read a chapter'), { target: { value: '19:00' } });
    fireEvent.change(screen.getByLabelText('Duration for Read a chapter'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
    expect(mocks.add.mock.calls[0][0]).toMatchObject({ taskDate: '2026-10-27', scheduledTime: '19:00', estimatedDuration: 30, epicId: 'campaign-1' });
    await screen.findByText('Added to Agenda');
    expect(screen.queryByRole('button', { name: 'Add quest to Agenda' })).not.toBeInTheDocument();
  });
  it('stops before saving when the user cancels a schedule conflict', async () => {
    mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', quests: [quest] } }); mocks.check.mockResolvedValue(null);
    open(); await screen.findByText('Learn astronomy'); fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
    await waitFor(() => expect(mocks.check).toHaveBeenCalled()); expect(mocks.add).not.toHaveBeenCalled();
  });
  it('reuses existing task identity rather than adding a duplicate', async () => {
    mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', quests: [{ ...quest, task_id: 'existing' }] } });
    open(); await screen.findByText('Learn astronomy'); fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce()); expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][0].taskId).toBe('existing');
  });
  it('does not invent free time when a calendar read is incomplete', async () => {
    mocks.availability.mockResolvedValue({ tasks: [], events: [], commitments: [], incomplete: true });
    open(); await screen.findByRole('alert'); expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('keeps a failed second save retryable without duplicating the first quest', async () => {
    mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', quests: [quest, { ...quest, id: 'second', title: 'Sketch a constellation', time: '20:00' }] } });
    mocks.add.mockResolvedValueOnce({ id: 'first' }).mockRejectedValueOnce(new Error('Temporarily offline')).mockResolvedValueOnce({ id: 'second' });
    open(); await screen.findByText('Add 2 quests to Agenda'); fireEvent.click(screen.getByRole('button', { name: 'Add 2 quests to Agenda' }));
    await screen.findByText('Temporarily offline'); fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(3));
    expect(mocks.add.mock.calls.map(call => call[0].taskText)).toEqual(['Read a chapter','Sketch a constellation','Sketch a constellation']);
  });
});


it('automatically reloads transient calendar failures before asking the user to retry', async () => {
  mocks.availability.mockResolvedValueOnce({ tasks: [], events: [], incomplete: true, issues: ['calendar-settings'] });
  open();
  await screen.findByText(introduction.reply);
  expect(mocks.reload).toHaveBeenCalledOnce();
  expect(mocks.availability.mock.calls[1][1].calendarsLoading).toBe(false);
});
it('requires explicit input-based planning after a partial read and still checks before saving', async () => {
  mocks.availability.mockResolvedValue({ tasks: [], events: [], commitments: [], incomplete: true, issues: ['local-sync'] });
  mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', quests: [quest] } });
  open(); await screen.findByText(/Some schedule changes are still syncing/);
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(screen.queryByText('Checking your time and goals…')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Plan with my input' }));
  await screen.findByText('Learn astronomy');
  expect(mocks.invoke.mock.calls[0][1].body.message).toContain('Ask me to confirm my prior engagements');
  expect(screen.getByText(/Times still need your review/)).toBeInTheDocument();
  expect(mocks.add).not.toHaveBeenCalled();
  mocks.check.mockResolvedValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
  await waitFor(() => expect(mocks.check).toHaveBeenCalled());
  expect(mocks.add).not.toHaveBeenCalled();
});


it('omits a scheduled quest returned again by the model', async () => {
  mocks.availability.mockResolvedValue({ tasks: [{ id: 'existing', task_text: 'Read a chapter', task_date: '2026-10-27', scheduled_time: '18:00', estimated_duration: 20 }], events: [], incomplete: false });
  mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', quests: [quest] } });
  open(); await screen.findByText(/Already in Agenda: Read a chapter/);
  expect(screen.queryByRole('button', { name: 'Add quest to Agenda' })).not.toBeInTheDocument();
});
it('rechecks a restored draft before making its old proposal actionable', async () => {
  localStorage.setItem('cosmiq:quest-planner:planning-user:2026-10-27', JSON.stringify({ history: [], plan: { ...introduction, phase: 'review', quests: [quest] }, saved: [], queued: [] }));
  mocks.availability.mockResolvedValue({ tasks: [{ id: 'existing', task_text: 'Read a chapter', task_date: '2026-10-27', scheduled_time: '18:00', estimated_duration: 20 }], events: [], incomplete: false });
  open(); expect(screen.queryByRole('button', { name: 'Add quest to Agenda' })).not.toBeInTheDocument();
  await screen.findByText(/Already in Agenda: Read a chapter/);
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('prevents saving a proposal that was added to Agenda after generation', async () => {
  mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', quests: [quest] } });
  open(); await screen.findByRole('button', { name: 'Add quest to Agenda' });
  mocks.availability.mockResolvedValue({ tasks: [{ id: 'added-elsewhere', task_text: 'Read a chapter', task_date: '2026-10-27', scheduled_time: '18:00', estimated_duration: 20 }], events: [], incomplete: false });
  fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
  await screen.findByText(/Already in Agenda: Read a chapter/);
  expect(mocks.add).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it('accepts a plain request, labels the suggested duration, and waits for Add', async () => {
  open(); await screen.findByText(introduction.reply);
  mocks.invoke.mockResolvedValue({ data: { phase: 'review', reply: 'Walk Dog at 7 PM. I suggested 20 minutes; you can change it.', choices: [], engagements: [], quests: [{ ...quest, title: 'Walk Dog', time: '19:00', goal: 'Care for your dog', epic_id: null, duration_suggested: true }] } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: 'I want to walk my dog at 7pm' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send answer' }));
  await screen.findByDisplayValue('Walk Dog');
  expect(screen.getByLabelText('Start time for Walk Dog')).toHaveValue('19:00');
  expect(screen.getByText('Suggested · editable')).toBeInTheDocument();
  expect(mocks.add).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ taskText: 'Walk Dog', scheduledTime: '19:00', estimatedDuration: 20, epicId: null })));
});

it('records accepted edits against the original proposal',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[quest]}});open();await screen.findByDisplayValue('Read a chapter');
 fireEvent.change(screen.getByLabelText('Duration for Read a chapter'),{target:{value:'15'}});
 fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));
 await waitFor(()=>expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({kind:'accepted',before_duration:20,after_duration:15})));
});
it('removes a declined proposal and offers optional reason feedback',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[quest]}});open();await screen.findByDisplayValue('Read a chapter');
 fireEvent.click(screen.getByRole('button',{name:'Remove Read a chapter'}));
 expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Too long'}));
 await waitFor(()=>expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({reason:'too_long'})));
});
it('saves a lasting preference only after Remember this',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,memory_suggestion:'I prefer evening walks'}});open();await screen.findByText('Remember: I prefer evening walks');
 expect(mocks.remember).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Remember this'}));
 await waitFor(()=>expect(mocks.remember).toHaveBeenCalledWith({explicit_preferences:['I prefer evening walks']}));
});
it('allows an explicit additional occurrence and does not re-save the same proposal ID',async()=>{
 const repeat={...quest,id:'existing-repeat',title:'Walk Dog',repeat_requested:true};
 mocks.availability.mockResolvedValue({tasks:[{id:'morning',task_text:'Walk the Beast',task_date:'2026-10-27',scheduled_time:'07:00'}],events:[],incomplete:false});
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[repeat]}});open();await screen.findByDisplayValue('Walk Dog');
 mocks.availability.mockResolvedValue({tasks:[{id:'existing-repeat',task_text:'Walk Dog',task_date:'2026-10-27',scheduled_time:'18:00'}],events:[],incomplete:false});
 fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));await screen.findByText('Added to Agenda');expect(mocks.add).not.toHaveBeenCalled();
});
it('undoes only newly added quests that have not changed',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[quest]}});open();await screen.findByDisplayValue('Read a chapter');
 fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));await screen.findByText('Added to Agenda');
 mocks.availability.mockResolvedValue({tasks:[{id:'saved',task_text:quest.title,task_date:'2026-10-27',scheduled_time:'18:00',estimated_duration:20}],events:[],incomplete:false});
 fireEvent.click(screen.getByRole('button',{name:'Undo quests just added'}));await waitFor(()=>expect(mocks.remove).toHaveBeenCalledWith('saved'));
});
it('does not undo a quest edited after it was added',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[quest]}});open();await screen.findByDisplayValue('Read a chapter');
 fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));await screen.findByText('Added to Agenda');
 mocks.availability.mockResolvedValue({tasks:[{id:'saved',task_text:quest.title,task_date:'2026-10-27',scheduled_time:'20:00',estimated_duration:20}],events:[],incomplete:false});
 fireEvent.click(screen.getByRole('button',{name:'Undo quests just added'}));await screen.findByText(/A quest changed since you added it/);expect(mocks.remove).not.toHaveBeenCalled();
});

it('adds a second quest without replacing the first and Back does not undo or duplicate it', async () => {
  open(); await screen.findByText(introduction.reply);
  mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', choices: [], reply: 'Review your reading quest.', quests: [quest] } });
  fireEvent.click(screen.getByRole('button', { name: 'Nothing else booked' }));
  await screen.findByDisplayValue(quest.title);
  expect(screen.queryByRole('button', { name: 'Try something different' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
  await screen.findByText('Added to Agenda');
  const saved = { id: 'saved', task_text: quest.title, task_date: '2026-10-27', scheduled_time: '18:00', estimated_duration: 20 };
  mocks.availability.mockResolvedValue({ tasks: [saved], events: [], incomplete: false });
  const second = { ...quest, id: 'second', title: 'Sketch a constellation', time: '20:00' };
  mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'review', choices: [], reply: 'Try a sketch this evening.', quests: [second] } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest another quest' }));
  await screen.findByText('What goal would you like this next quest to support?');
  const body = mocks.invoke.mock.calls.at(-1)![1].body;
  expect(body.message).toContain('Keep all saved quests');
  expect(body.history).toEqual([]); expect(body.draft).toBeNull();
  expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
  expect(body.busy).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'saved', title: quest.title })]));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByDisplayValue(quest.title);
  expect(screen.getByLabelText('Start time for Read a chapter')).toBeDisabled();
  expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.add).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Suggest another quest' }));
  await screen.findByText('What goal would you like this next quest to support?');
  fireEvent.click(screen.getByRole('button',{name:'Build my mind'}));
  await screen.findByText('Which activity would you like to do for that goal?');
  expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:second.title}));
  await screen.findByText('How much time would you like to spend on this quest?');
  fireEvent.click(screen.getByRole('button',{name:'30 minutes'}));
  await screen.findByText('When would you like to begin?');
  expect(screen.queryByRole('button',{name:'Add quest to Agenda'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'8 PM'}});
  fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
  await screen.findByDisplayValue(second.title);
  expect(screen.getByRole('article',{name:'Earlier quest: Read a chapter'})).toHaveTextContent('Added to Agenda');
  expect(screen.queryByText('Conversation so far')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add quest to Agenda' }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
  expect(mocks.add.mock.calls.map(call => call[0].taskText)).toEqual([quest.title, second.title]);
});
it('clears a restored sync warning when background sync finishes, without generating a new plan', async () => {
  localStorage.setItem('cosmiq:quest-planner:planning-user:2026-10-27', JSON.stringify({ history: [], plan: { ...introduction, phase: 'review', quests: [quest] }, saved: [quest.id], queued: [quest.id] }));
  mocks.availability.mockResolvedValue({ tasks: [], events: [], incomplete: true, issues: ['local-sync'] });
  open(); await screen.findByText(/Some schedule changes are still syncing/);
  mocks.availability.mockResolvedValue({ tasks: [{id: quest.id,task_text:quest.title,task_date:'2026-10-27',scheduled_time:'18:00'}], events: [], incomplete: false });
  act(() => { window.dispatchEvent(new Event('planner-sync-finished')); });
  await waitFor(() => expect(screen.queryByText(/Some schedule changes are still syncing/)).not.toBeInTheDocument());
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('cosmiq:quest-planner:planning-user:2026-10-27')!).queued).toEqual([]);
});

it('keeps follow-ups focused with choices and text, and defers another quest until review is complete', async () => {
  mocks.invoke.mockResolvedValue({ data: { ...introduction, phase: 'details', choices: ['Find an open time for me', 'After 6 PM'], reply: 'What time would you like for the reading session?' } });
  open(); await screen.findByText('What time would you like for the reading session?');
  expect(screen.queryByRole('button', { name: /Suggest (another |a )quest/ })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'After 6 PM' }));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
  expect(mocks.invoke.mock.calls[1][1].body.message).toBe('After 6 PM');
});
it('provides a safe way forward for older saved questions without choices', async () => {
  localStorage.setItem('cosmiq:quest-planner:planning-user:2026-10-27', JSON.stringify({ history: [], plan: { ...introduction, phase: 'details', choices: [], reply: 'What time for reading?' }, saved: ['old'], queued: [] }));
  open(); await screen.findByRole('button', { name: 'Help me choose' });
  fireEvent.click(screen.getByRole('button', { name: 'Type my answer' }));
  expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveFocus();
  expect(mocks.invoke).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Help me choose' }));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
  expect(mocks.invoke.mock.calls[0][1].body.message).toContain('do not switch to a different activity');
});


it('keeps the original appointment through a date switch, AM/PM clarification and save', async () => {
  open(); await screen.findByText(introduction.reply);
  const request='I have an appointment at 360 e 2nd dtla on 2026-11-05 at 10 with Cynthia Fuentes. I need to be reminded an hour earlier';
  const clarify={...introduction,phase:'details',reply:'10 AM or 10 PM?',choices:['10 AM','10 PM']};
  mocks.invoke.mockResolvedValue({data:clarify});
  fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:request}});
  fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
  await screen.findByText('10 AM or 10 PM?');
  expect(screen.getByLabelText('Planning date')).toHaveValue('2026-11-05');
  const appointment={...quest,title:'Appointment with Cynthia Fuentes',epic_id:null,goal:'Attend your appointment',time:'10:00',duration:30,duration_suggested:true,location:'360 E 2nd DTLA',notes:'With Cynthia Fuentes',reminder_offsets_minutes:[60],time_fixed:true};
  mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',reply:'Review your appointment.',choices:[],quests:[appointment]}});
  fireEvent.click(screen.getByRole('button',{name:'10 AM'}));
  await screen.findByDisplayValue(appointment.title);
  const body=mocks.invoke.mock.calls.at(-1)![1].body;
  expect(body.history).toContainEqual({role:'user',content:request});
  expect(body.date).toBe('2026-11-05');
  expect(screen.getByLabelText(`Location for ${appointment.title}`)).toHaveValue(appointment.location);
  expect(screen.getByText('Reminder: 1 hour before')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Swap'})).not.toBeInTheDocument();
  expect(mocks.add).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));
  await waitFor(()=>expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({taskText:appointment.title,taskDate:'2026-11-05',scheduledTime:'10:00',estimatedDuration:30,location:appointment.location,notes:appointment.notes,reminderEnabled:true,reminderMinutesBefore:60,reminderOffsetsMinutes:[60],keepTimeFixed:true})));
});
it('keeps edited location and reminder metadata when an appointment save is queued offline',async()=>{
 const appointment={...quest,location:'360 E 2nd DTLA',notes:'Bring the form',reminder_offsets_minutes:[60],time_fixed:true};
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[appointment]}});
 mocks.add.mockResolvedValue({id:'saved',queued:true});open();await screen.findByDisplayValue(quest.title);
 fireEvent.change(screen.getByLabelText(`Location for ${quest.title}`),{target:{value:'360 E 2nd, Suite 2'}});
 fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));
 await screen.findByText(/Added to Agenda on this device/);
 expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({location:'360 E 2nd, Suite 2',reminderOffsetsMinutes:[60],notes:'Bring the form'}));
});
it('does not clear an existing appointment address or reminder when only its time changes',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',quests:[{...quest,task_id:'existing'}]}});open();await screen.findByDisplayValue(quest.title);
 fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce());
 expect(mocks.update.mock.calls[0][0].updates).not.toHaveProperty('location');
 expect(mocks.update.mock.calls[0][0].updates).not.toHaveProperty('reminder_enabled');
});

it('keeps the unsaved appointment and conversation when moving its draft to another date',async()=>{
 const draft={...introduction,phase:'review',choices:[],quests:[{...quest,title:'Appointment with Cynthia',location:'360 E 2nd DTLA',reminder_offsets_minutes:[60],time_fixed:true}]};
 mocks.invoke.mockResolvedValueOnce({data:draft}).mockResolvedValueOnce({data:{...draft,quests:[{...draft.quests[0],date:'2026-11-05'}]}});
 open();await screen.findByDisplayValue('Appointment with Cynthia');
 fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'Move it to 2026-11-05'}});
 fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
 await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(2));
 const body=mocks.invoke.mock.calls[1][1].body;
 expect(body.date).toBe('2026-11-05');expect(body.history.length).toBeGreaterThan(0);
 expect(body.draft.quests[0]).toMatchObject({title:'Appointment with Cynthia',location:'360 E 2nd DTLA',reminder_offsets_minutes:[60]});
 expect(mocks.add).not.toHaveBeenCalled();
});
it('saves the entire ten-hour work quest without shortening its duration',async()=>{
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',choices:[],quests:[{...quest,title:'Work',time:'08:00',duration:600,time_fixed:true}]}});
 open();await screen.findByDisplayValue('Work');fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledOnce());expect(mocks.add.mock.calls[0][0]).toMatchObject({estimatedDuration:600,keepTimeFixed:true});
});

it('explains a rate limit and keeps the typed request available to retry',async()=>{
 open();await screen.findByText(introduction.reply);
 mocks.invoke.mockResolvedValueOnce({data:null,error:{context:new Response(JSON.stringify({retryAfterSeconds:120}),{status:429})}});
 fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'Remove the reminder please'}});fireEvent.click(screen.getByRole('button',{name:'Send answer'}));
 await screen.findByText(/request limit.*2 minutes/);
 expect(screen.getByLabelText('Your answer')).toHaveValue('Remove the reminder please');expect(mocks.add).not.toHaveBeenCalled();
});

describe('contextual composer and fresh conversations',()=>{
 it('updates the input hint with the question, and restores it on Back',async()=>{
  mocks.invoke.mockResolvedValueOnce({data:{...introduction,input_hint:'Tell me what is already booked…'}}).mockResolvedValueOnce({data:{...introduction,phase:'details',reply:'How long would you like to read?',choices:['15 minutes','30 minutes'],input_hint:'Enter a duration, such as 20 minutes…'}});
  open();await screen.findByPlaceholderText('Tell me what is already booked…');
  fireEvent.click(screen.getByRole('button',{name:'Nothing else booked'}));
  await screen.findByPlaceholderText('Enter a duration, such as 20 minutes…');
  fireEvent.click(screen.getByRole('button',{name:'Back'}));
  await screen.findByPlaceholderText('Tell me what is already booked…');
 });
 it('uses a neutral fallback for old saved responses rather than an unrelated activity example',async()=>{
  open();await screen.findByText(introduction.reply);
  expect(screen.getByLabelText('Your answer')).toHaveAttribute('placeholder','Type your answer to the question above…');
 });
 it('cancelling reset keeps the typed answer and does not restart',async()=>{
  open();await screen.findByText(introduction.reply);
  fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'I finish work at 6'}});
  fireEvent.click(screen.getByRole('button',{name:'Start over'}));fireEvent.click(screen.getByRole('button',{name:'Keep planning'}));
  expect(screen.getByLabelText('Your answer')).toHaveValue('I finish work at 6');expect(mocks.invoke).toHaveBeenCalledTimes(1);
 });
 it('resets only this conversation and rechecks saved bookings without deleting quests',async()=>{
  mocks.invoke.mockResolvedValueOnce({data:{...introduction,phase:'review',choices:[],quests:[quest],engagements:[{title:'Unsaved meeting',start:'2026-10-27T09:00:00Z',end:'2026-10-27T10:00:00Z'}]}}).mockResolvedValueOnce({data:{...introduction,reply:'Fresh plan. Anything else booked?',input_hint:'Tell me about your day…'}});
  localStorage.setItem('cosmiq:quest-planner:planning-user:2026-10-29','other day draft');
  open();await screen.findByText('Learn astronomy');
  fireEvent.click(screen.getByRole('button',{name:'Add quest to Agenda'}));await screen.findByText('Added to Agenda');
  fireEvent.click(screen.getByRole('button',{name:'Start over'}));fireEvent.click(screen.getByRole('button',{name:'Reset conversation'}));
  await screen.findByText('Fresh plan. Anything else booked?');
  const body=mocks.invoke.mock.calls[1][1].body;
  expect(body.date).toBe('2026-10-27');expect(body.history).toEqual([]);expect(body.draft).toBeNull();
  expect(mocks.availability.mock.calls.at(-1)[1].extraCommitments).toEqual([]);
  expect(mocks.remove).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();expect(mocks.add).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button',{name:'Back'})).not.toBeInTheDocument();
  expect(localStorage.getItem('cosmiq:quest-planner:planning-user:2026-10-29')).toBe('other day draft');
  const saved=JSON.parse(localStorage.getItem('cosmiq:quest-planner:planning-user:2026-10-27')!);
  expect(saved.history).toHaveLength(2);expect(saved.plan.quests).toEqual([]);
 });
});

it('reviews and saves multiple recurring class periods with their repeat rules and reminders intact',async()=>{
 const recurrence={pattern:'weekly',days:[0,2],month_days:[],end_date:'2026-12-18'};
 const first={...quest,title:'Class',date:'2026-10-28',time:'08:00',duration:180,recurrence,reminder_offsets_minutes:[60]};
 const second={...first,id:'afternoon',time:'14:00',duration:120};
 mocks.invoke.mockResolvedValue({data:{...introduction,phase:'review',choices:[],quests:[first,second]}});
 mocks.add.mockImplementation(async value=>{mocks.availability.mockResolvedValue({tasks:[{id:'saved',task_text:'Class',task_date:'2026-10-28',scheduled_time:'08:00',estimated_duration:180,is_recurring:true,recurrence_pattern:'weekly',recurrence_days:[0,2]}],events:[],incomplete:false});return {id:value.creationId==='afternoon'?'saved2':'saved'};});
 open();await screen.findByText('Add 2 quests to Agenda');
 expect(screen.getAllByText(/Every Mon, Wed/)).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:'Add 2 quests to Agenda'}));
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledTimes(2));
 expect(mocks.add.mock.calls[0][0]).toMatchObject({taskDate:'2026-10-28',recurrencePattern:'weekly',recurrenceDays:[0,2],recurrenceEndDate:'2026-12-18',reminderOffsetsMinutes:[60]});
 expect(mocks.add.mock.calls[1][0]).toMatchObject({scheduledTime:'14:00',estimatedDuration:120});
 expect(mocks.check.mock.calls[0][0]).toMatchObject({recurrence_pattern:'weekly',is_recurring:true,task_date:'2026-10-28'});
 expect(screen.queryByRole('button',{name:'Undo quests just added'})).not.toBeInTheDocument();
});
