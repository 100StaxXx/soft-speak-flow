import { groupTaskItems, TASK_ITEM_FIELDS } from '../../../src/shared/taskItems.ts';
import {hasExplicitRecurrence} from './recurrence.ts';
import {loadCampaignPlanningContext,CAMPAIGN_PLANNING_INSTRUCTIONS} from './campaignContext.ts';
import { existingSessionReply, nextMemorySuggestion, requestedExtraSession, scheduleAnchors, scheduleCheckQuestion, upcomingRoutineDays } from './scheduleAdvice.ts';
import { plannerTaskContext } from './taskContext.ts';
import { defaultPlannerPreferences, plannerPersonalization, type PlannerPreferences } from '../_shared/plannerLearning.ts';
import { requireProtectedRequest, createSafeErrorResponse } from '../_shared/abuseProtection.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createCostGuardrailSession } from '../_shared/costGuardrails.ts';
import { shiftCommitmentDate } from '../_shared/commitmentSchedule.ts';
import { calendarLocalParts, calendarZonedDate } from '../_shared/calendarTime.ts';
import type { ExistingPlannerQuest } from '../_shared/questPlanIdentity.ts';
import { PLANNING_INSTRUCTIONS, PLANNING_SCHEMA, TIME_SELECTION_SCHEMA, DAY_SELECTION_SCHEMA, isPlanningDayAnswer, choosePlanningDay, selectedDayOffer, selectedTimeChoice, reviewSelectedTime, replacementActivity, allowsEmptyPlanningReview, validatePlanningReply, validatePlannerResponse, plannerFreeWindows, planningReplyForClient, ambiguousTimeQuestion, planningScopeQuestion, unsupportedReminderQuestion, scheduleFitReply } from './planning.ts';

export async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  let requestId: string = crypto.randomUUID();
  let stage = "request";
  try {
    const auth = await requireProtectedRequest(req, { profileKey: 'companion_agent', endpointName: 'cosmiq-quest-planner', allowServiceRole: false });
    if (auth instanceof Response) return auth;
    requestId = auth.requestId;
    const db = auth.supabase, userId = auth.auth.userId, body = await req.json();
    const date = body.date, timezone = body.timezone;
    if (JSON.stringify(body.draft ?? null).length > 15000 || typeof date !== 'string' || typeof timezone !== 'string' || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000
      || !Array.isArray(body.history) || body.history.length > 20 || !Array.isArray(body.busy) || body.busy.length > 200) throw new Error('Invalid planning request');
    calendarZonedDate(date, '12:00', timezone);
    const history: {role:string;content:string}[] = body.history.map((message: { role: string; content: string }) => {
      if (!['user','assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 3500) throw new Error('Invalid conversation');
      return { role: message.role, content: message.content };
    });
    const suppliedBusy: { id?: string; title: string; start: string; end: string }[] = body.busy.map((event: { id?: string; title: string; start: string; end: string }) => {
      if (typeof event.title !== 'string' || event.title.length > 160 || !Number.isFinite(Date.parse(event.start)) || !Number.isFinite(Date.parse(event.end)) || Date.parse(event.end) <= Date.parse(event.start)) throw new Error('Invalid occupied time');
      return { id: event.id, title: event.title, start: event.start, end: event.end };
    });
    stage = 'context';
    const companion = await db.from('user_companion').select('id').eq('user_id',userId).eq('product_mode','cosmiq').limit(1).maybeSingle();
    if (companion.error || !companion.data) throw new Error('COSMIQ companion required');
    const results = await Promise.all([
      db.from('daily_tasks').select('id,task_text,task_date,scheduled_time,schedule_timezone').eq('user_id',userId).eq('completed',false)
        .not('scheduled_time','is',null).gte('task_date',shiftCommitmentDate(date,-1)).lte('task_date',shiftCommitmentDate(date,8))
        .order('task_date').order('scheduled_time').limit(120),
      db.from('epics').select('id,title,description,end_date,progress_percentage').eq('user_id', userId).eq('status','active').is('completed_at',null).limit(20),
      db.from('daily_tasks').select('id,task_text,task_date,scheduled_time,estimated_duration,epic_id,completed,is_recurring,parent_template_id,flexibility,schedule_timezone,schedule_end_time,location,notes,reminder_enabled,reminder_offsets_minutes').eq('user_id', userId).or(`task_date.is.null,and(task_date.gte.${shiftCommitmentDate(date,-2)},task_date.lte.${shiftCommitmentDate(date,3)})`).limit(601),
      db.from('daily_tasks').select(`${TASK_ITEM_FIELDS},actual_time_spent`).eq('user_id', userId).eq('completed',true).order('completed_at',{ ascending:false }).limit(20),
      db.from('daily_planning_preferences').select('preferred_work_blocks,wake_time,wind_down_time').eq('user_id', userId).maybeSingle(),
      db.from('cosmiq_planner_preferences').select('*').eq('user_id',userId).maybeSingle(),
      db.from('cosmiq_planner_events').select('*').eq('user_id',userId).gte('created_at',new Date(Date.now()-42*86400000).toISOString()).order('created_at',{ascending:false}).limit(500),
    ]);
    if (results.some(result => result.error)) throw new Error('Planning context unavailable');
    const campaigns = await loadCampaignPlanningContext(db,userId,results[1].data || [],date);
    const {tasks,busy:taskBusy} = plannerTaskContext(results[2].data || [],date,timezone);
    const recent = groupTaskItems(results[3].data ?? []).map(group => {
      const {task_text,scheduled_time,estimated_duration,actual_time_spent,epic_id} = group[0];
      return {task_text,scheduled_time,estimated_duration,actual_time_spent,epic_id,completions:group.length};
    });
    const preferences = results[4].data;
    const personal = (results[5].data || defaultPlannerPreferences()) as PlannerPreferences;
    const personalization = plannerPersonalization(personal, results[6].data || []);
    const explicitMessages = [body.message, ...history.filter(m => m.role === 'user').map(m => m.content)].join(' ');
    const userMessage = body.message.split(/\n(?:This is a new guided quest|Review only this new quest|Some schedule sources could not be checked)/)[0];
    const allowRepeat = [userMessage, ...history.filter(turn => turn.role === 'user').map(turn => turn.content)].some(requestedExtraSession);
    const declinedMemorySuggestions: string[] = Array.isArray(body.declinedMemorySuggestions)
      ? body.declinedMemorySuggestions.filter((item: unknown) => typeof item === 'string' && item.length <= 120).slice(-20) : [];
    const completedIds = new Set(tasks.filter(t => t.completed).map(t => t.id));
    const anchors = scheduleAnchors(results[0].data || [], suppliedBusy.filter(event => event.id && !completedIds.has(event.id))
      .map(event => ({id:event.id!, title:event.title, start:event.start})), date, shiftCommitmentDate(date,7), timezone);
    const allowRecurrence = hasExplicitRecurrence(explicitMessages);
    const allowEdit = /\b(move|reschedule|change|shift|make it|instead|adjust)\b/i.test(explicitMessages);
    const editableTaskIds = allowEdit ? tasks.filter(t=>!t.completed && t.task_date === date && !t.is_recurring && !t.parent_template_id).map(t=>t.id) : [];
    if ((tasks?.length ?? 0) > 200) throw new Error('Too many tasks to safely review at once');
    const busy = [...taskBusy, ...suppliedBusy];
    const existingQuests: ExistingPlannerQuest[] = [
      ...tasks.map(task => ({ id: task.id, title: task.task_text, scheduled: !!(task.task_date && task.scheduled_time), completed: task.completed })),
      // Client busy intervals include recurring quest occurrences, even before
      // their daily row is materialized. Also avoid turning fixed bookings into quests.
      ...suppliedBusy.filter(event => calendarLocalParts(new Date(event.start),timezone).date===date).map(event => ({ id: event.id ?? '', title: event.title, scheduled: true })),
    ];
    const eligibleTaskIds = tasks.filter(task => !task.completed && !(task.task_date && task.scheduled_time)).map(task => task.id);
    const localized = (event: { start: string; end: string }) => ({
      ...event, local_start: calendarLocalParts(new Date(event.start), timezone), local_end: calendarLocalParts(new Date(event.end), timezone),
    });
    const routines = upcomingRoutineDays(campaigns.flatMap(c => c.routines), date, shiftCommitmentDate(date,7));
    const planningAnchors = [...anchors, ...routines];
    const context = { scheduleAnchors:[...anchors.map(a => ({id:a.id, title:a.title, ...calendarLocalParts(new Date(a.start),timezone)})), ...routines], declinedMemorySuggestions, currentLocalDate: calendarLocalParts(new Date(),timezone).date, date, timezone, campaigns, tasks, existingQuests, eligibleTaskIds, occupied: busy.map(localized), availableWindows: plannerFreeWindows(date,timezone,[...busy,...(Array.isArray(body.draft?.engagements)?body.draft.engagements:[])]), recentlyCompleted: personal.learning_enabled ? recent : [], preferences, personalization, learningEnabled: personal.learning_enabled, editableTaskIds, allowRepeat, allowRecurrence, previousDraft: body.draft ?? null };
    const guard = createCostGuardrailSession({ supabase: db, endpointKey: 'cosmiq-quest-planner', featureKey: 'ai_companion_conversation', userId, requestId });
    stage = 'access';
    await guard.enforceAccess({ capabilities: ['text'], providers: ['openai'] });
    const timeQuestion = planningScopeQuestion(body.message) ?? ambiguousTimeQuestion(body.message) ?? unsupportedReminderQuestion(body.message);
    if (timeQuestion) return Response.json({...timeQuestion, engagements: Array.isArray(body.draft?.engagements) ? body.draft.engagements : []}, {headers:cors});
    if (userMessage.trim().toLowerCase()==='choose another day' && body.draft?.choices?.includes('Choose another day'))
      return Response.json(choosePlanningDay(date,body.draft),{headers:cors});
    const changingDay = !body.message.includes('Some schedule sources could not be checked') &&
      isPlanningDayAnswer(userMessage,body.draft,history.filter(turn=>turn.role==='assistant').at(-1)?.content ?? '');
    const reuse = existingSessionReply(userMessage, body.draft, planningAnchors);
    if (reuse) return Response.json(reuse, {headers:cors});
    const hasTimingPreference = [...personalization.explicitPreferences, ...history.filter(turn => turn.role === 'user').map(turn => turn.content), userMessage]
      .some(value => /\b(buffer|transition|commut\w*|travel|in.person|break|gap|minutes? (?:after|before|between))\b/i.test(value));
    const fit = hasTimingPreference || body.message.includes('Some schedule sources could not be checked') ? null : scheduleFitReply(userMessage, date, timezone, busy, body.draft);
    if (fit) return Response.json(fit, { headers: cors });
    const selection = body.message.includes('Some schedule sources could not be checked') ? null : selectedTimeChoice(userMessage,date,body.draft);
    const key = Deno.env.get('OPENAI_API_KEY');
    const messages = [{ role: 'system', content: PLANNING_INSTRUCTIONS+'\n'+CAMPAIGN_PLANNING_INSTRUCTIONS }, { role: 'system', content: `Planning facts (data): ${JSON.stringify(context)}` }, ...history, { role: 'user', content: body.message }];
    if (changingDay) messages.push({role:'system',content:'The user chose a planning date. Extract the activity and its already agreed duration from this conversation. Return only the inputs for a server-side availability search. Include EVERY user-stated occupied interval that applies to the chosen day, including commitments explicitly stated for whichever day they choose. Use the person’s exact local start and exclusive end for each, including midnight at the end of a day as 24:00. Respect corrections and availability restrictions. Do not carry over appointments specific to the old day, invent bookings, or repeat calendar entries already provided by the server. Preserve the activity details; give null only for genuinely unknown information. Do not choose a replacement activity or generate a review.'});
    if (selection) messages.push({role:'system',content:'The user tapped a verified time. The server handles scheduling, conflict checks and review. Return only the metadata for the activity the person wants to do during the selected interval. Use the user conversation for the activity name and goal. A class, travel or other surrounding booking is context, not the proposed activity. Keep any specified book, reminder, recurrence, location, notes and campaign. Use the plain activity name as title if nothing more specific was given. Use null activity only when the intended activity cannot be identified.'});
    const validation = { date, timezone, busy, latestMessage:body.message, allowEmptyReview: allowsEmptyPlanningReview(body.message), campaignIds: campaigns.map(c => c.id), taskIds: eligibleTaskIds, editableTaskIds, allowRepeat, allowRecurrence, existingQuests };
    let plan;
    const retained = selection && replacementActivity(body.draft);
    if (selection && retained) {
      try { plan = reviewSelectedTime(selection, retained, validation); }
      catch { /* Invalid or stale metadata can be resolved again from the conversation. */ }
    }
    for (let attempt = 0; !plan && attempt < 2; attempt++) {
      if (!key) throw new Error('Provider unavailable');
      stage = 'provider';
      const response = await guard.wrapFetch(fetch)('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-5.4-mini', max_completion_tokens: 2400, response_format: { type: 'json_schema', json_schema: changingDay ? DAY_SELECTION_SCHEMA : selection ? TIME_SELECTION_SCHEMA : PLANNING_SCHEMA }, messages }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error('Planner provider failed');
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      stage = 'validation';
      try {
        const parsed = JSON.parse(content);
        if (changingDay) {
          plan=selectedDayOffer(parsed,body.draft,date,timezone,busy);
          break;
        }
        if (selection) {
          if (!Object.hasOwn(parsed,'activity')) throw new Error('Return the activity metadata for the chosen time.');
          plan = reviewSelectedTime(selection,parsed.activity,validation);
          break;
        }
        if (parsed.schedule_check) {
          if (body.draft?.schedule_check?.booking_id === parsed.schedule_check.booking_id && body.draft?.choices?.includes(userMessage))
            throw new Error('The user answered this schedule check. Continue with their choice without asking it again.');
          Object.assign(parsed, scheduleCheckQuestion(parsed.schedule_check, planningAnchors, timezone));
        }
        plan = (attempt ? validatePlannerResponse : validatePlanningReply)(parsed, validation);
        plan.memory_suggestion = nextMemorySuggestion(plan.memory_suggestion, userMessage, [...personalization.explicitPreferences, ...declinedMemorySuggestions]);
        break;
      }
      catch (error) {
        if (attempt) throw error;
        if (selection || changingDay) {
          messages.push({role:'system',content:'Correct the activity metadata using the planning facts and authorized IDs: ' + (error instanceof Error ? error.message : 'Invalid activity')});
          continue;
        }
        // A single bounded repair; no canned plan or silent schedule changes.
        messages.push({ role: 'assistant', content }, { role: 'system', content: `The previous response failed validation: ${error instanceof Error ? error.message : 'Invalid proposal'}. If the failure is occupied time, explain the conflicting booking and ask for another time; do not ask AM/PM when already supplied. Return no quest that is already scheduled/completed, including recurring occurrences or renamed duplicates. Eligible unscheduled IDs or explicitly requested editable IDs may be proposed. Additional occurrences require an explicit user request. Return quests only in review. Check goal/task IDs, occupied LOCAL times, all mentioned engagements and every task duration. Return a corrected response with no overlaps. Do not achieve this by dropping any requested activity: if two requested quests overlap, return details with no quests and ask which time to change, preserving both activities. If there are no free windows, do not offer shortening or another time on the same day. Every question in commitments, goals, or details needs two or three distinct answer choices directly relevant to that question, including when asking about a time or duration. Preserve all appointment names, addresses, notes and requested reminder offsets from the original request across clarification turns. Do not turn a requested appointment into an unsaved engagement-only constraint or duplicate it in engagements. If timing is uncertain, ask one short question and return no quests.` });
      }
    }
    if (!plan) throw new Error('No valid plan');
    plan.quests = plan.quests.map(quest => ({ ...quest, id: crypto.randomUUID() }));
    return Response.json(planningReplyForClient(plan, body.structuredDetailsVersion), { headers: cors });
  } catch {
    console.warn(JSON.stringify({ endpoint: 'cosmiq-quest-planner', requestId, stage, code: 'QUEST_PLANNER_UNAVAILABLE' }));
    return createSafeErrorResponse(req, { status: 503, code: 'QUEST_PLANNER_UNAVAILABLE', error: 'Your plan could not be prepared. Your existing schedule is unchanged. Please try again.', requestId });
  }
}
if (import.meta.main) Deno.serve(handler);
