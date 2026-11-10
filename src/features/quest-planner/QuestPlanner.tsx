import { asksAboutScheduleFit, choosePlanningDay } from '../../../supabase/functions/cosmiq-quest-planner/planning';
import { guidedQuestInstruction, guidedQuestReply } from './guidedQuestRound';
import {recurringPeersExcluded} from './plannerSnapshot';
import {recurrenceFields,recurrenceLabel} from '../../../supabase/functions/cosmiq-quest-planner/recurrence';
import { proposalTaskDetails } from './proposalTaskDetails';
import { formatQuestReminderOffset } from '@/utils/questReminders';
import { usePlannerPreferences } from './usePlannerPreferences';
import { cleanInterests } from '../../../supabase/functions/_shared/plannerLearning';
import { requestedPlanningDate } from './planningDate';
import { PLANNER_SYNC_EVENT } from '@/utils/plannerSync';
import { scheduleReadMessage } from '@/services/scheduleReadMessage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ArrowLeft, RotateCcw, Plus, BookOpen, Check, Compass, Loader2, Mic, Square, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceInputFeedback } from '@/components/voice/VoiceInputFeedback';
import { useAuth } from '@/hooks/useAuth';
import { useCalendarIntegrations } from '@/hooks/useCalendarIntegrations';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { useQuestScheduleGuard } from '@/hooks/useQuestScheduleGuard';
import { loadQuestScheduleAvailability } from '@/services/questScheduleAvailability';
import { findExistingPlannerQuest } from '../../../supabase/functions/_shared/questPlanIdentity';
import { planningSnapshot, reviewPlannerProposals } from './plannerSnapshot';
import { calendarZonedDate } from '@/utils/calendarTime';
import { supabase } from '@/integrations/supabase/client';
import { safeLocalStorage } from '@/utils/storage';
import { recheckPlannerTimeChoices } from '../../../supabase/functions/cosmiq-quest-planner/planning';
import type { PlanningReply, PlannedQuest } from '../../../supabase/functions/cosmiq-quest-planner/planning';
import type { CompanionPlannerLaunchIntent } from '@/types/companionPlanner';
import './questPlanner.css';

type Turn = { role: 'user' | 'assistant'; content: string };
type ConversationTurn = Turn & { quests?: (PlannedQuest & { saved: boolean })[]; status?: string };
type PlanningStep = { guidedQuestStep?: number; history: Turn[]; plan: PlanningReply; transcript?: ConversationTurn[] };
type Session = { declinedMemorySuggestions?: string[]; guidedQuestStep?: number; transcript?: ConversationTurn[]; previous?: PlanningStep[]; history: Turn[]; plan: PlanningReply | null; saved: string[]; queued: string[] };
const empty = (): Session => ({ history: [], plan: null, saved: [], queued: [] });
function legacyTranscript(session: Session): ConversationTurn[] {
  const history = [...session.history];
  if (history.at(-1)?.role === 'assistant' && history.at(-1)?.content === session.plan?.reply) history.pop();
  return history.filter(turn => !(turn.role === 'user' && /^(Help me make a small plan for|Start a fresh plan for)/.test(turn.content)));
}
export function QuestPlanner({ selectedDate, launchIntent, onClose, onLaunchIntentConsumed, onSavingChange, onQuestSaved }: {
  onQuestSaved?: () => void; selectedDate?: Date | null; launchIntent?: CompanionPlannerLaunchIntent | null; onClose: () => void; onSavingChange?: (saving: boolean) => void; onLaunchIntentConsumed?: (id: string) => void;
}) {
  const { user } = useAuth();
  const learning = usePlannerPreferences();
  const originals = useRef<Record<string, PlannedQuest>>({});
  const pendingDateRequest = useRef<{message:string;history:Turn[];draft:PlanningReply|null} | null>(null);
  const [dismissedQuest,setDismissedQuest] = useState<PlannedQuest|null>(null);
  const [memoryStatus,setMemoryStatus] = useState('');
  const [confirmReset,setConfirmReset] = useState(false);
  const [undoTasks,setUndoTasks] = useState<{id:string;title:string;time:string;duration:number;date:string}[]>([]);
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const initialDate = launchIntent?.selectedDate || (selectedDate && format(selectedDate, 'yyyy-MM-dd') > format(new Date(), 'yyyy-MM-dd') ? format(selectedDate, 'yyyy-MM-dd') : tomorrow);
  const [snapshotChecked, setSnapshotChecked] = useState(false), [proposalNotice, setProposalNotice] = useState('');
  const restoredSession = useRef<Session | null>(null), scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const requestScrollLatest = () => setScrollRequest(value => value + 1);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scrollRequest && scroll) scroll.scrollTo?.({ top: scroll.scrollHeight, behavior: 'auto' });
  }, [scrollRequest]);
  const [pendingMessage, setPendingMessage] = useState('');
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [date, setDate] = useState(initialDate), [session, setSession] = useState<Session>(empty), [input, setInput] = useState('');
  const [scheduleBlocked, setScheduleBlocked] = useState(false), [scheduleNotice, setScheduleNotice] = useState(''), [manualPlanning, setManualPlanning] = useState(false);
  const lastMessage = useRef('');
  const lastRequest = useRef<{displayMessage?: string; guidedAction?: 'start' | 'repeat'}>({});
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const voice = useVoiceInput({ autoStopOnSilence: false, onFinalResult: (text, submitRequested) => { const next = `${input} ${text}`.trim(); setInput(next.slice(0,2000)); if (next.length > 2000) setError('Your answer reached the 2,000-character limit. Review the ending before sending, and add the remaining details in your next message.'); else if (submitRequested) void send(next, false, manualPlanning, false, undefined, true); }, onError: setError, onPermissionNeeded: () => setError('Enable microphone access in your device settings to use voice input.') });
  const [status, setStatus] = useState('');
  const [saveStage,setSaveStage] = useState('Adding quests…');
  const scope = `${user?.id || 'anonymous'}:${date}`, currentScope = useRef(scope), started = useRef(false), savingRef = useRef(false);
  currentScope.current = scope;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calendars = useCalendarIntegrations();
  const { addTask, updateTask, deleteTask } = useTaskMutations(date);
  const options = { userId: user?.id || '', connections: calendars.connections, visibleCalendars: calendars.settings?.visible_calendars, timezone,
    cachedTasks: [], cachedEvents: [], extraCommitments: (session.plan?.engagements || []).map((event,index) => ({ id: `mentioned:${index}`, title: event.title, date, start: Date.parse(event.start), end: Date.parse(event.end), source: 'commitment' as const })), excludedEventKeys: new Set<string>(), calendarsLoading: calendars.isLoading || calendars.hasLoadError, scopeKey: scope };
  const { checkSchedule, conflictDialog } = useQuestScheduleGuard(options);
  const storageKey = `cosmiq:quest-planner:${scope}`;
  const persist = (next: Session) => { setSession(next); safeLocalStorage.setItem(storageKey, JSON.stringify(next)); };
  useEffect(() => {
    voice.cancelRecording?.();
    currentScope.current = scope;
    started.current = false; restoredSession.current = null; setSnapshotChecked(false); setProposalNotice(''); setScheduleBlocked(false); setScheduleNotice(''); setManualPlanning(false); lastMessage.current = ''; setError(''); setStatus(''); setShowSaveConfirmation(false); setPendingMessage(''); setInput(''); setUndoTasks([]); setDismissedQuest(null); setConfirmReset(false);
    try {
      const saved = JSON.parse(safeLocalStorage.getItem(storageKey) || 'null') as Session | null;
      if (saved && Array.isArray(saved.history) && Array.isArray(saved.saved) && Array.isArray(saved.queued)) { setSession(saved); restoredSession.current = saved; }
      else setSession(empty());
    } catch { setSession(empty()); }
    return () => { currentScope.current = ''; };
  }, [storageKey]);

  async function send(message: string, initial = false, allowIncomplete = manualPlanning, refreshSources = false, carried?: {history:Turn[];draft:PlanningReply|null;session?:Session}, finalizedVoice = false, displayMessage = message, guidedAction?: 'start' | 'repeat') {
    if (busy || savingRef.current || !user || !message.trim() || (voice.isRecording && !finalizedVoice)) return;
    const requestedDate = initial ? null : requestedPlanningDate(message, format(new Date(), 'yyyy-MM-dd'));
    if(requestedDate && requestedDate !== date){pendingDateRequest.current={message,history:session.history.slice(-20),draft:session.plan ? {...session.plan,engagements:[],quests:session.plan.quests.filter(q=>!session.saved.includes(q.id)&&!session.queued.includes(q.id)&&!q.task_id)} : null};setDate(requestedDate);return;}
    const baseSession=carried?.session??session;
    const discussingTime = asksAboutScheduleFit(message);
    const guidedStep = guidedAction === 'start' ? 0 : !initial && baseSession.guidedQuestStep != null
      ? Math.min(baseSession.guidedQuestStep + (guidedAction === 'repeat' || discussingTime || baseSession.plan?.schedule_check ? 0 : 1), 4) : undefined;
    lastRequest.current = {displayMessage, guidedAction};
    const completedPrompt = showSaveConfirmation;
    const completedStatus = status;
    setPendingMessage(initial ? '' : displayMessage); requestScrollLatest();
    const requestScope = scope; lastMessage.current = message; setBusy(true); setError(''); setScheduleBlocked(false);
    try {
      setConfirmReset(false);
      const readOptions=initial ? {...options,extraCommitments:[]} : options;
      const freshSources = refreshSources ? await calendars.reloadScheduleSources() : null;
      let availability = await loadQuestScheduleAvailability({ id: 'planning-read', task_text: '', task_date: date }, { ...readOptions, ...freshSources });
      if(availability.incomplete && !allowIncomplete){
        const recovered = await calendars.reloadScheduleSources();
        availability = await loadQuestScheduleAvailability({ id:'planning-read', task_text:'', task_date:date }, {...readOptions,...recovered});
      }
      if (currentScope.current !== requestScope) return;
      if (availability.incomplete && !allowIncomplete) {
        setScheduleBlocked(true);
        throw new Error(scheduleReadMessage(availability.issues));
      }
      setManualPlanning(allowIncomplete);
      setScheduleNotice(availability.incomplete ? `${scheduleReadMessage(availability.issues)} We’ll use the commitments you confirm. Times still need your review.` : '');
      const { busy: dayBusy, existing } = planningSnapshot(availability, date, timezone);
      setSnapshotChecked(true);
      if (dayBusy.length > 200) throw new Error('There are too many calendar items to review safely. Check the visible calendars in Settings.');
      if (currentScope.current !== requestScope) return;
      const history = guidedAction === 'start' ? [] : carried?.history ?? (initial ? [] : session.history.slice(-20));
      const plannerMessage = guidedStep == null || discussingTime ? message : `${message}\n${guidedQuestInstruction(guidedStep)}`;
      if (plannerMessage.length > 2000) throw new Error('Please shorten this answer so I can keep guiding this quest. Your text is still below.');
      const { data, error: invokeError } = await supabase.functions.invoke('cosmiq-quest-planner', { body: {
        declinedMemorySuggestions: baseSession.declinedMemorySuggestions ?? [],
        structuredDetailsVersion: 2, date, timezone, message: availability.incomplete
          ? `${plannerMessage.slice(0, 1600)}\nSome schedule sources could not be checked. I chose to plan using my input. Ask me to confirm my prior engagements before proposing quest times. Treat any proposed time as tentative; do not claim my full schedule was checked.`
          : plannerMessage, history, draft: guidedAction === 'start' ? null : carried?.draft ?? (initial ? null : session.plan),
        busy: dayBusy.map(block => ({ id: block.id, title: block.title.slice(0,160), start: new Date(block.start).toISOString(), end: new Date(block.end).toISOString() })),
      } });
      if (invokeError?.context instanceof Response && invokeError.context.status === 429) {
        const details=await invokeError.context.clone().json().catch(()=>null);
        const retrySeconds=Number(details?.retryAfterSeconds || invokeError.context.headers.get('Retry-After'));
        const wait=Number.isFinite(retrySeconds)&&retrySeconds>0?` in about ${Math.ceil(retrySeconds/60)} minute${Math.ceil(retrySeconds/60)===1?'':'s'}`:' in a little while';
        throw new Error(`The planner has reached its request limit. Please try again${wait}. Your request is still below, and your saved schedule is unchanged.`);
      }
      if (invokeError || !data?.reply || !Array.isArray(data.quests) || !Array.isArray(data.choices)) throw new Error('Your planner couldn’t respond. Please try again; your saved schedule is unchanged.');
      if (currentScope.current !== requestScope) return;
      const finishedReuse = baseSession.plan?.schedule_check?.kind === 'reuse' && message === 'Use the existing session' && data.phase === 'goals';
      const reviewed = reviewPlannerProposals(guidedStep == null || discussingTime || finishedReuse || data.schedule_check ? data as PlanningReply : guidedQuestReply(data as PlanningReply, guidedStep), existing);
      originals.current = Object.fromEntries(reviewed.plan.quests.map(q=>[q.id,{...q}]));
      setMemoryStatus('');
      setProposalNotice(reviewed.removed.length ? `Already in Agenda: ${reviewed.removed.join(', ')}. No duplicate quest was added.` : '');
      // Keep the visible conversation separate from the bounded context sent to the planner.
      // Earlier quest cards are read-only snapshots, never another way to save a quest.
      const transcript: ConversationTurn[] = initial ? [] : [...(baseSession.transcript ?? legacyTranscript(baseSession))];
      if (!initial && baseSession.plan) {
        transcript.push({ role: 'assistant', content: baseSession.plan.reply,
          quests: baseSession.plan.quests.map(quest => ({ ...quest, saved: baseSession.saved.includes(quest.id) })) });
        if (completedPrompt) transcript.push({ role: 'assistant', content: 'What else would you like to plan?', status: completedStatus });
      }
      if (!initial) transcript.push({ role: 'user', content: displayMessage });
      persist({ ...(initial ? empty() : baseSession), guidedQuestStep: finishedReuse ? undefined : guidedStep, transcript, history: [...history, { role: 'user' as const, content: message }, { role: 'assistant', content: reviewed.plan.reply }], plan: reviewed.plan, previous: !initial && baseSession.plan ? [...(baseSession.previous || []), { history: baseSession.history, plan: baseSession.plan, guidedQuestStep: baseSession.guidedQuestStep, transcript: baseSession.transcript ?? legacyTranscript(baseSession) }].slice(-10) : [] });
      setPendingMessage(''); setShowSaveConfirmation(false); setStatus('');
      requestScrollLatest();
      setInput('');
    } catch (failure) { if (currentScope.current === requestScope) setError(failure instanceof Error ? failure.message : 'Unable to prepare your plan.'); }
    finally { if (currentScope.current === requestScope) setBusy(false); }
  }
  async function refreshRestoredPlan(restored: Session, returnToQuestion = false) {
    const requestScope = scope; setBusy(true);
    try {
      let availability = await loadQuestScheduleAvailability({ id: 'planning-read', task_text: '', task_date: date }, options);
      if (availability.incomplete) {
        const sources = await calendars.reloadScheduleSources();
        availability = await loadQuestScheduleAvailability({ id: 'planning-read', task_text: '', task_date: date }, { ...options, ...sources });
      }
      if (currentScope.current !== requestScope) return;
      const snapshot = planningSnapshot(availability, date, timezone);
      const refreshed = recheckPlannerTimeChoices(restored.plan!, {date,timezone,busy:snapshot.busy.map(b=>({start:new Date(b.start).toISOString(),end:new Date(b.end).toISOString()}))});
      const reviewed = reviewPlannerProposals(refreshed, snapshot.existing, restored.saved);
      originals.current = Object.fromEntries(reviewed.plan.quests.map(q=>[q.id,{...q}]));
      setSnapshotChecked(true);
      setProposalNotice(reviewed.removed.length ? `Already in Agenda: ${reviewed.removed.join(', ')}. No duplicate quest was added.` : '');
      setScheduleNotice(availability.incomplete ? `${scheduleReadMessage(availability.issues)} Times still need your review.` : '');
      if (!availability.incomplete) { setError(''); setScheduleBlocked(false); }
      const queued = availability.incomplete ? restored.queued : restored.queued.filter(id =>
        !snapshot.existing.some(task => task.id === (restored.plan?.quests.find(q => q.id === id)?.task_id || id)));
      if (restored.queued.length && !queued.length) setStatus('Your quests are saved and synced with Agenda.');
      persist({ ...restored, plan: reviewed.plan, queued });
      if (returnToQuestion) requestScrollLatest();
    } catch { if (currentScope.current === requestScope) setError('Your saved proposal could not be checked. Send your request again to refresh it.'); }
    finally { if (currentScope.current === requestScope) setBusy(false); }
  }
  useEffect(() => {
    if (started.current || !user || calendars.isLoading || busy) return;
    started.current = true;
    if (launchIntent) onLaunchIntentConsumed?.(launchIntent.id);
    if(pendingDateRequest.current){const request=pendingDateRequest.current;pendingDateRequest.current=null;void send(request.message,true,false,false,request);return;}
    if (launchIntent?.starterIntent === 'goal_breakdown' && launchIntent.message) { const restored=restoredSession.current; void send(launchIntent.message,false,false,false,restored?{history:restored.history,draft:restored.plan,session:restored}:undefined); return; }
    if (restoredSession.current?.plan) { void refreshRestoredPlan(restoredSession.current); return; }
    void send(`Help me make a small plan for ${date}. Check what is already booked first, then help choose tasks tied to my goals and agree on a time and duration for each.${launchIntent?.starterIntent === 'goal_breakdown' ? ` My request: ${launchIntent.message}` : ''}`, true);
  }, [user?.id, calendars.isLoading, date, busy]);

  const [scheduleRevision, setScheduleRevision] = useState(0);
  const checkedRevision = useRef(0);
  useEffect(() => {
    const refresh = () => setScheduleRevision(value => value + 1);
    window.addEventListener(PLANNER_SYNC_EVENT, refresh);
    window.addEventListener('online', refresh);
    return () => { window.removeEventListener(PLANNER_SYNC_EVENT, refresh); window.removeEventListener('online', refresh); };
  }, []);
  useEffect(() => {
    if (busy || saving || checkedRevision.current === scheduleRevision) return;
    checkedRevision.current = scheduleRevision;
    if (session.plan && (scheduleNotice || session.queued.length)) void refreshRestoredPlan(session);
    else if (scheduleBlocked) void send(lastMessage.current, !session.plan, false, true);
  }, [scheduleRevision, busy, saving, scheduleNotice, scheduleBlocked]);

  function resetConversation() {
    if (busy || savingRef.current) return;
    voice.cancelRecording?.();
    pendingDateRequest.current=null; originals.current={}; restoredSession.current=null;
    setConfirmReset(false); setInput(''); setError(''); setStatus(''); setShowSaveConfirmation(false); setMemoryStatus('');
    setDismissedQuest(null); setUndoTasks([]); setProposalNotice(''); setSnapshotChecked(false);
    setScheduleNotice(''); setScheduleBlocked(false); setManualPlanning(false);
    setPendingMessage('');
    persist(empty());
    requestScrollLatest();
    // Only the conversation is reset. Agenda rows, offline writes and preferences remain.
    void send(`Start a fresh plan for ${date}. Check my saved quests and bookings first, then ask what else I would like to plan.`,true,false,true);
  }

  function goBack() {
    if (busy || savingRef.current) return;
    voice.cancelRecording?.();
    const previous = [...(session.previous || [])], step = previous.pop();
    if (!step) return;
    setError(''); setStatus(''); setShowSaveConfirmation(false); setPendingMessage(''); setInput(''); setDismissedQuest(null); setMemoryStatus('');
    // Navigation only: keep saved identities so Back cannot save a quest twice.
    void refreshRestoredPlan({ ...session, ...step, previous }, true);
  }

  function editQuest(id: string, changes: Partial<PlannedQuest>) {
    if (!session.plan) return;
    persist({ ...session, plan: { ...session.plan, quests: session.plan.quests.map(quest => quest.id === id ? { ...quest, ...changes } : quest) } });
  }
  function chooseDayForReviewedQuest(current: Session, quest: PlannedQuest) {
    const review = current.plan;
    if (!review) return;
    const plan = choosePlanningDay(quest.date || date, {
      ...review, replacement_activity: quest, carried_duration: quest.duration,
    });
    plan.reply = `Which day would you like to check for ${quest.title} (${quest.duration} minutes)?`;
    const transcript = current.transcript ?? legacyTranscript(current);
    const choice: Turn = { role: 'user', content: 'Choose another day' };
    const previous = { history: current.history, plan: review, guidedQuestStep: current.guidedQuestStep, transcript };
    persist({
      ...current, plan, guidedQuestStep: undefined,
      previous: [...(current.previous ?? []), previous].slice(-10),
      history: [...current.history, choice, { role: 'assistant', content: plan.reply }],
      transcript: [...transcript, { role: 'assistant', content: review.reply }, choice],
    });
    setInput('');
    setStatus('');
    setProposalNotice('');
    requestScrollLatest();
  }

  async function saveQuests() {
    if (!session.plan || session.plan.phase !== 'review' || !snapshotChecked || savingRef.current || voice.isRecording) return;
    savingRef.current = true; setSaveStage('Checking your schedule…'); setSaving(true); onSavingChange?.(true); setError('');
    let next = session;
    try {
      for (let quest of session.plan.quests) {
        if (next.saved.includes(quest.id)) continue;
        if (!quest.title.trim() || !quest.goal.trim() || !Number.isInteger(quest.duration) || quest.duration < 5 || quest.duration > 1440) throw new Error('Give each quest a name and a duration between 5 and 1440 minutes.');
        const questDate=quest.date||date;
        // Re-read before each write: the proposal may be stale, restored, or
        // already added from another screen/device since it was generated.
        setSaveStage('Checking your schedule…');
        const availability = await loadQuestScheduleAvailability({ id: 'save-check', task_text: '', task_date: questDate, ...recurrenceFields(quest.recurrence) }, options);
        const existing = planningSnapshot(availability, questDate, timezone).existing;
        if(existing.some(t=>t.id===quest.id)){next={...next,saved:[...next.saved,quest.id]};persist(next);continue;}
        const match = findExistingPlannerQuest(quest, recurringPeersExcluded(quest,existing,next.plan!,next.saved));
        const editing=!!quest.task_id && existing.some(item=>item.id===quest.task_id && item.editable);
        if ((match?.scheduled || match?.completed) && !editing && !quest.repeat_requested) {
          next = { ...next, plan: { ...next.plan!, quests: next.plan!.quests.filter(item => item.id !== quest.id) } };
          persist(next); setProposalNotice(`Already in Agenda: ${match.title}. No duplicate quest was added.`); continue;
        }
        if (match && !editing && !quest.repeat_requested && !quest.recurrence) quest = { ...quest, task_id: match.id };
        if(!quest.recurrence && quest.date && quest.date !== date) throw new Error('This proposal is for a different date. Send your request again before saving.');
        const start = calendarZonedDate(questDate, quest.time, timezone).getTime();
        if (session.plan.engagements.some(event => start < Date.parse(event.end) && start + quest.duration*60000 > Date.parse(event.start))) throw new Error('This time overlaps an engagement you mentioned. Adjust the quest time first.');
        setSaveStage('Reviewing the time…');
        const checked = await checkSchedule({ id: quest.task_id || `plan:${quest.id}`, task_text: quest.title, task_date: questDate, scheduled_time: quest.time, estimated_duration: quest.duration, ...recurrenceFields(quest.recurrence) }, availability,
          quest.recurrence || quest.task_id ? undefined : () => chooseDayForReviewedQuest(next, quest));
        if (!checked) break;
        setSaveStage('Saving quest…');
        const details = proposalTaskDetails(quest);
        const result = quest.task_id ? await updateTask({ taskId: quest.task_id, updates: { task_text: quest.title, task_date: date, scheduled_time: checked.scheduled_time, estimated_duration: quest.duration, ...details.update } })
          : await addTask({ creationId: quest.id, taskText: quest.title, taskDate: questDate, scheduledTime: checked.scheduled_time, estimatedDuration: quest.duration, epicId: quest.epic_id, difficulty: 'medium', category: quest.category, source: 'manual', ...details.add });
        if(!quest.recurrence && !quest.task_id && result && 'id' in result && typeof result.id==='string') setUndoTasks(previous=>[...previous,{id:result.id!,title:quest.title,time:checked.scheduled_time||quest.time,duration:quest.duration,date}]);
        const original=originals.current[quest.id]||quest;
        void learning.record({kind:'accepted',proposal_id:quest.id,title:quest.title,task_date:date,before_time:original.time,after_time:checked.scheduled_time||quest.time,before_duration:original.duration,after_duration:quest.duration}).catch(()=>setProposalNotice('Your quests were saved, but learning feedback could not sync.'));
        const queued = result && typeof result === 'object' && 'queued' in result && result.queued;
        next = { ...next, plan: { ...next.plan!, quests: next.plan!.quests.map(item => item.id === quest.id ? { ...item, task_id: quest.task_id || (result && 'id' in result && typeof result.id === 'string' ? result.id : item.task_id), time: checked.scheduled_time || item.time } : item) }, saved: [...next.saved, quest.id], queued: queued ? [...next.queued, quest.id] : next.queued };
        onQuestSaved?.();
        persist(next); // Keep successful saves if a later quest fails or is cancelled.
      }
      if (next.saved.length) setStatus(next.queued.length ? 'Added to Agenda on this device. Changes will sync when connected.' : `${next.saved.length} ${next.saved.length === 1 ? 'quest is' : 'quests are'} in Agenda. Your next chapter has a plan.`);
      if (next.saved.length && next.plan?.quests.every(quest => next.saved.includes(quest.id))) {
        setShowSaveConfirmation(true);
        requestScrollLatest();
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'A quest could not be saved. Already added quests will not be duplicated.'); }
    finally { savingRef.current = false; setSaving(false); onSavingChange?.(false); }
  }
  async function dismiss(quest:PlannedQuest,reason:string){
    if(!session.plan)return;
    persist({...session,history:[...session.history,{role:'user',content:`Do not suggest ${quest.title} again in this plan. Reason: ${reason}.`}],plan:{...session.plan,quests:session.plan.quests.filter(q=>q.id!==quest.id)}});
    setDismissedQuest(quest);
    try{await learning.record({kind:'dismissed',proposal_id:quest.id,title:quest.title,task_date:date,reason});}
    catch{setProposalNotice('Removed from this plan. Your learning feedback could not be saved.');}
  }
  async function undoAdded(){
    setShowSaveConfirmation(false);
    if(savingRef.current)return;savingRef.current=true;setSaving(true);onSavingChange?.(true);
    try{
      for(const task of undoTasks){
        const fresh=await loadQuestScheduleAvailability({id:'undo-read',task_text:'',task_date:task.date},options);
        if(fresh.incomplete)throw Error('Could not verify the quests before undo. Please try again.');
        const current=fresh.tasks.find(t=>t.id===task.id);
        if(!current)continue;
        if(current.completed||current.task_text!==task.title||current.task_date!==task.date||current.scheduled_time?.slice(0,5)!==task.time||current.estimated_duration!==task.duration)throw Error('A quest changed since you added it. Review it in Agenda instead.');
        await deleteTask(task.id);setUndoTasks(items=>items.filter(t=>t.id!==task.id));
      }
      setStatus('The quests just added were removed. Existing quests were kept.');
    }catch(e){setError(e instanceof Error?e.message:'Could not undo.');}
    finally{savingRef.current=false;setSaving(false);onSavingChange?.(false);}
  }
  const plan = session.plan;
  const inputHint = typeof plan?.input_hint === 'string' && plan.input_hint.trim() && plan.input_hint.length <= 90 ? plan.input_hint : plan?.phase === 'review' ? 'Tell me what you’d like to change or add…' : 'Type your answer to the question above…';
  const remaining = plan?.quests.filter(quest => !session.saved.includes(quest.id)) || [];
  return <div className="quest-planner flex min-h-0 flex-1 flex-col">
    <header className="quest-planner-header"><div className="quest-planner-emblem" aria-hidden="true"><Compass size={30}/></div><div className="min-w-0 flex-1"><p className="quest-planner-eyebrow">Your next chapter</p><h2 className="font-serif text-2xl text-amber-50">Quest Planner</h2></div><Button variant="ghost" size="icon" aria-label="Close planner" disabled={saving} onClick={() => { voice.cancelRecording?.(); onClose(); }}><X className="h-5 w-5"/></Button></header>
    <div className="quest-planner-toolbar">
      <label className="quest-planner-date">Planning for<input type="date" aria-label="Planning date" value={date} disabled={busy || saving} onChange={event => { if (event.target.value) setDate(event.target.value); }}/></label>
      <Button variant="outline" size="sm" className="quest-planner-reset" disabled={busy || saving} onClick={() => { voice.cancelRecording?.(); setConfirmReset(true); }}><RotateCcw size={14} aria-hidden="true"/>Start over</Button>
    </div>
      {confirmReset && <aside className="mx-4 mb-3 shrink-0 rounded-xl border border-amber-200/20 p-3 text-sm" aria-label="Reset planner conversation"><p>Start a new conversation? This clears the chat and unsaved proposals. Saved quests stay in Agenda.</p><div className="mt-2 flex gap-2"><Button variant="outline" disabled={busy||saving} onClick={resetConversation}>Reset conversation</Button><Button variant="ghost" onClick={()=>setConfirmReset(false)}>Keep planning</Button></div></aside>}
    <div ref={scrollRef} data-testid="quest-planner-scroll" className="quest-planner-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <div aria-label="Planner conversation" className="space-y-3">
        {(session.transcript ?? legacyTranscript(session)).map((turn,index) => <div key={index}>
          <section className={turn.role === 'user' ? 'quest-planner-user-message' : 'quest-planner-dialogue'}>
            <div className="quest-planner-dialogue-label">{turn.role === 'user' ? 'You' : 'Planner'}</div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{turn.content}</p>
            {turn.status && <p className="mt-3 text-sm text-emerald-200">{turn.status}</p>}
          </section>
          {turn.quests?.map(quest => <article key={quest.id} className="quest-planner-quest mt-3" aria-label={`Earlier quest: ${quest.title}`} data-saved={quest.saved}>
            <p className="mb-2 text-xs uppercase tracking-wider text-amber-200">{quest.saved ? 'Added to Agenda' : 'Earlier proposal'}</p>
            <h3 className="text-base font-medium text-amber-50">{quest.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{quest.goal}</p>
            <p className="mt-2 text-xs text-slate-300">{quest.date || date} · {quest.time} · {quest.duration} minutes</p>
          </article>)}
        </div>)}
      </div>
      <section className="quest-planner-dialogue" aria-label={showSaveConfirmation ? 'Planner response' : 'Planner question'} aria-live="polite"><div className="quest-planner-dialogue-label"><Sparkles size={14}/>{plan?.phase === 'review' ? 'Ready to review' : 'Let’s shape your day'}</div><p className="whitespace-pre-line text-base leading-relaxed text-amber-50">{plan?.reply || (error ? 'Let’s confirm your time before we plan.' : 'Checking your time and goals…')}</p></section>
      {!!plan?.choices.length && plan.phase !== 'review' && !busy && <div className="mt-3 grid gap-2" aria-label="Suggested replies">{plan.choices.map((choice,index) => <button key={choice} className="quest-planner-choice" disabled={saving} onClick={() => void send(choice)}><span className="quest-planner-choice-gem" aria-hidden="true">{index+1}</span><span>{choice}</span><span className="ml-auto text-amber-100/60" aria-hidden="true">›</span></button>)}</div>}
      {plan && plan.phase !== 'review' && !busy && <div className="mt-2 text-xs text-slate-300">
        <p>Choose an option or type your answer below.</p>
        {!plan.choices.some(choice => choice.trim()) && <div className="mt-2 grid gap-2" aria-label="Ways to answer">
          <Button variant="outline" disabled={saving} onClick={() => void send('Help me answer your last question. Suggest two or three concrete options that fit my existing plan and available time; do not switch to a different activity.', false, manualPlanning, false, undefined, false, 'Help me choose', 'repeat')}>Help me choose</Button>
          <Button variant="ghost" disabled={saving} onClick={() => inputRef.current?.focus()}>Type my answer</Button>
        </div>}
      </div>}
      {proposalNotice && <p role="status" className="mt-3 rounded-xl border border-sky-200/15 bg-sky-200/5 p-3 text-sm text-sky-100">{proposalNotice}</p>}
      {snapshotChecked && plan?.phase === 'review' && !!plan.quests.length && <section className="mt-4 space-y-3" aria-label="Quest plan">{plan.quests.map(quest => {
        const saved = session.saved.includes(quest.id);
        return <article key={quest.id} className="quest-planner-quest" data-saved={saved}><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-amber-200"><BookOpen size={14}/>{saved ? 'Added to Agenda' : quest.task_id ? 'Update existing quest' : 'Quest proposal'}{saved && <Check size={14}/>}</div>{quest.recurrence&&<p className="mb-3 text-sm text-amber-100">{recurrenceLabel(quest.recurrence)}<span className="block text-xs text-slate-300">First quest: {quest.date}. Conflicts checked for the next 30 days when saving. Manage this occurrence or the series in Agenda.</span></p>}
          <label className="block"><span className="sr-only">Quest name</span><input value={quest.title} disabled={saved || saving || busy} onChange={event => editQuest(quest.id, { title: event.target.value })} className="w-full rounded-lg border border-transparent bg-transparent py-1 text-lg font-medium text-amber-50 focus:border-amber-100/40"/></label><p className="mb-3 text-sm text-slate-300">{quest.goal}</p>
          <div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-300">Start time<input aria-label={`Start time for ${quest.title}`} type="time" value={quest.time} disabled={saved || saving || busy} onChange={event => editQuest(quest.id, { time: event.target.value })} className="mt-1 block rounded-lg border border-white/15 bg-slate-950/60 p-2 text-sm text-amber-50"/></label><label className="text-xs text-slate-300">Minutes<input aria-label={`Duration for ${quest.title}`} type="number" min={5} max={1440} step={5} value={quest.duration} disabled={saved || saving || busy} onChange={event => editQuest(quest.id, { duration: Number(event.target.value), duration_suggested: false })} className="mt-1 block w-20 rounded-lg border border-white/15 bg-slate-950/60 p-2 text-sm text-amber-50"/>{quest.duration_suggested && !saved && <span className="mt-1 block text-[10px] text-amber-200/80">Suggested · editable</span>}</label>{!saved && <Button size="sm" variant="ghost" disabled={saving || busy} aria-label={`Remove ${quest.title}`} onClick={() => void dismiss(quest,'not_today')}>Not today</Button>}</div>
          {(quest.location != null || quest.notes != null || quest.reminder_offsets_minutes != null || quest.time_fixed) && <div className="mt-3 space-y-2 text-sm text-slate-200" aria-label={`Details for ${quest.title}`}>
            {quest.time_fixed && <p className="text-xs text-amber-200">Fixed appointment time</p>}
            {quest.location != null && <label className="block text-xs">Location<input aria-label={`Location for ${quest.title}`} value={quest.location} maxLength={500} disabled={saved||saving||busy} onChange={event=>editQuest(quest.id,{location:event.target.value})} className="mt-1 block w-full rounded-lg border border-white/15 bg-slate-950/60 p-2 text-sm"/></label>}
            {quest.notes != null && <label className="block text-xs">Notes<textarea aria-label={`Notes for ${quest.title}`} value={quest.notes} maxLength={1000} disabled={saved||saving||busy} onChange={event=>editQuest(quest.id,{notes:event.target.value})} className="mt-1 block w-full rounded-lg border border-white/15 bg-slate-950/60 p-2 text-sm"/></label>}
            {quest.reminder_offsets_minutes != null && <p>Reminder: {quest.reminder_offsets_minutes.length ? quest.reminder_offsets_minutes.map(formatQuestReminderOffset).join(' · ') : 'Off'}</p>}
            {!!quest.reminder_offsets_minutes?.length && !saved && <p className="text-xs text-slate-400">Will be saved with this quest. Delivery uses your notification settings. Type below to change the reminder.</p>}
          </div>}
          {!saved&&!quest.time_fixed&&!quest.recurrence&&<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={saving||busy} onClick={()=>{void learning.record({kind:'swapped',proposal_id:quest.id,title:quest.title,task_date:date}).catch(()=>{});void send(`Swap only the unsaved proposal "${quest.title}" for a different activity that fits my interests and available time. Preserve my other proposals. Do not suggest this activity again in this plan.`, false, manualPlanning, false, undefined, false, `Suggest a different activity instead of ${quest.title}.`);}}>Swap</Button></div>}
        </article>;
      })}{remaining.length > 0 && <Button className="quest-planner-save w-full" disabled={saving || busy} onClick={() => void saveQuests()}>{saving ? saveStage : `Add ${remaining.length === 1 ? 'quest' : `${remaining.length} quests`} to Agenda`}</Button>}</section>}
      {plan?.memory_suggestion&&!memoryStatus&&!session.declinedMemorySuggestions?.includes(plan.memory_suggestion)&&!learning.preferences?.explicit_preferences.includes(plan.memory_suggestion)&&<aside className="mt-3 rounded-xl border border-amber-200/20 p-3 text-sm"><p>Remember: {plan.memory_suggestion}</p><Button size="sm" disabled={learning.isSaving||!learning.preferences} onClick={()=>void learning.save({explicit_preferences:cleanInterests([...(learning.preferences?.explicit_preferences||[]),plan.memory_suggestion!])}).then(()=>setMemoryStatus('Preference saved. You can change it in Settings.')).catch(()=>setError('Could not save this preference. Try again.'))}>Remember this</Button><Button size="sm" variant="ghost" disabled={busy || learning.isSaving} onClick={()=>{persist({...session, declinedMemorySuggestions:cleanInterests([...(session.declinedMemorySuggestions || []),plan.memory_suggestion!]).slice(-20)});setMemoryStatus('Kept only in this conversation.');}}>Just for now</Button></aside>}
      {memoryStatus&&<p role="status" className="mt-3 text-sm text-amber-100">{memoryStatus}</p>}
      {dismissedQuest&&<aside className="mt-3 rounded-xl border border-white/15 p-3 text-sm"><p>Optional: why didn’t {dismissedQuest.title} fit?</p><div className="flex flex-wrap gap-1">{[['wrong_time','Wrong time'],['too_long','Too long'],['not_interested','Not interested']].map(([reason,label])=><Button key={reason} size="sm" variant="ghost" onClick={()=>{const quest=dismissedQuest;setDismissedQuest(null);void learning.record({kind:'dismissed',proposal_id:`${quest.id}:reason`,title:quest.title,task_date:date,reason}).catch(()=>setProposalNotice('Your feedback could not be saved.'));}}>{label}</Button>)}<Button size="sm" variant="ghost" onClick={()=>setDismissedQuest(null)}>Skip</Button></div></aside>}
      {!!session.previous?.length && <div className="mt-3"><Button variant="ghost" disabled={busy || saving} onClick={goBack}><ArrowLeft size={16} className="mr-1"/>Back</Button></div>}
      {!!session.saved.length && <p className="mt-2 text-xs text-slate-400">Saved quests stay in Agenda. You can also type another request below.</p>}
      {!!undoTasks.length&&<Button className="mt-3" variant="outline" disabled={saving||busy} onClick={()=>void undoAdded()}>Undo quests just added</Button>}
      {status && !showSaveConfirmation && <p role="status" className="mt-3 text-sm text-emerald-200">{status}</p>}
      {scheduleNotice && <p role="status" className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/5 p-3 text-xs text-amber-100">{scheduleNotice}<Button size="sm" variant="ghost" disabled={busy || saving} onClick={() => session.plan && void refreshRestoredPlan(session)}>Check again</Button></p>}
      {error && <div role="alert" className="mt-3 rounded-xl border border-rose-300/25 bg-rose-900/10 p-3 text-sm text-rose-100">{error}
        <div className="mt-2 flex flex-wrap gap-2">
          {(!plan || scheduleBlocked) && <Button variant="ghost" size="sm" disabled={busy || saving} onClick={() => void send(lastMessage.current || `Help me plan ${date}. Check prior engagements first.`, !plan, false, true, undefined, false, lastRequest.current.displayMessage, lastRequest.current.guidedAction)}>Retry</Button>}
          {scheduleBlocked && <Button variant="outline" size="sm" disabled={busy || saving} onClick={() => void send(lastMessage.current || `Help me plan ${date}. Check prior engagements first.`, !plan, true, false, undefined, false, lastRequest.current.displayMessage, lastRequest.current.guidedAction)}>Plan with my input</Button>}
        </div>
      </div>}
      {showSaveConfirmation && <section className="quest-planner-dialogue" aria-label="Planner question" aria-live="polite"><div className="quest-planner-dialogue-label"><Sparkles size={14}/>Your plan is ready</div><p className="text-base leading-relaxed text-amber-50">What else would you like to plan?</p>{status && <p role="status" className="mt-3 text-sm text-emerald-200">{status}</p>}</section>}
      {pendingMessage && <section className="quest-planner-user-message" aria-label="Your latest message"><div className="quest-planner-dialogue-label">You</div><p className="whitespace-pre-line text-sm leading-relaxed">{pendingMessage}</p></section>}
      {busy && <div role="status" className="quest-planner-dialogue mt-3 flex items-center gap-2 text-sm text-amber-100"><Loader2 size={14} className="animate-spin motion-reduce:animate-none"/>Putting the next piece together…</div>}
    </div>
    {plan?.phase === 'review' && !remaining.length && !!session.saved.length && <div className="flex shrink-0 gap-2 border-t border-white/10 bg-slate-950/60 px-4 py-2" aria-label="Add quests">
      <Button className="quest-planner-save min-h-11 h-auto min-w-0 flex-1 whitespace-normal text-sm" disabled={busy || saving} onClick={() => void send('Help me plan another quest, one question at a time. Keep all saved quests in Agenda and do not repeat a saved activity. Begin with the goal, then help me choose an activity, duration and available start time before review.', false, manualPlanning, false, undefined, false, 'Suggest another quest', 'start')}><Plus size={16} className="mr-1 shrink-0"/>{session.saved.length ? 'Suggest another quest' : 'Suggest a quest'}</Button>
      <Button variant="ghost" className="min-h-11 h-auto min-w-0 flex-1 whitespace-normal text-sm" disabled={busy || saving} onClick={() => inputRef.current?.focus()}>Add my own quest</Button>
    </div>}
    <VoiceInputFeedback {...voice} onStop={voice.stopRecording} onCancel={voice.cancelRecording} onSend={voice.submitRecording} sendDisabled={busy || saving}/>
    <form style={voice.isRecording ? { display: 'none' } : undefined} className="quest-planner-composer" onSubmit={event => { event.preventDefault(); void send(input); }}><Textarea ref={inputRef} aria-label="Your answer" placeholder={inputHint} value={input} maxLength={2000} disabled={saving || voice.isRecording} onChange={event => setInput(event.target.value)} className="min-h-12 max-h-24 resize-none border-0 bg-transparent text-base text-amber-50 placeholder:text-slate-400 focus-visible:ring-amber-100/40"/><Button type="button" size="icon" variant="ghost" className={voice.isSupported ? undefined : "hidden"} aria-label={voice.isRecording ? "Stop voice input" : "Use voice input"} aria-pressed={!!voice.isRecording} disabled={saving || busy || voice.state === "stopping"} onClick={() => { setError(''); inputRef.current?.blur(); voice.toggleRecording(); }}>{voice.isRecording ? <Square size={17}/> : <Mic size={17}/>}</Button><Button type="submit" size="icon" aria-label="Send answer" disabled={!input.trim() || busy || saving || voice.isRecording}><Send size={17}/></Button></form>
    {conflictDialog}
  </div>;
}
