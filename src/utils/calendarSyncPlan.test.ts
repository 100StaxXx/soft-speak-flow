import { describe, it, expect } from "vitest";
import { eventQuestSnapshot, planCalendarSync, type SyncEvent, type SyncLink } from "../../supabase/functions/_shared/calendarSyncPlan.ts";
const event: SyncEvent = { title:"Walk",startDate:"2026-09-19T10:00:00Z",endDate:"2026-09-19T11:00:00Z",isAllDay:false,location:null,notes:"Private invitation" };
const base = eventQuestSnapshot(event,"UTC");
const link: SyncLink = { baseline:base,timezone:"UTC",resource_kind:"event",sync_status:"linked" };
describe("shared foreground/background sync decisions", () => {
  it("merges independent edits without copying outside notes over local notes", () => {
    const plan=planCalendarSync(link,{...base,task_text:"Local title",notes:"My private notes"},{...event,location:"Park",notes:"Changed invitation"});
    expect(plan.status).toBe("linked");
    if(plan.status!=="linked") return;
    expect(plan.snapshot).toMatchObject({task_text:"Local title",location:"Park",notes:"My private notes"});
    expect(plan.event).toMatchObject({title:"Local title",location:"Park",notes:"Changed invitation"});
  });
  it("preserves exact instants in the repeated daylight-saving hour for a title edit", () => {
    const repeated={...event,startDate:"2026-11-01T09:30:00Z",endDate:"2026-11-01T10:30:00Z"};
    const baseline=eventQuestSnapshot(repeated,"America/Los_Angeles");
    const plan=planCalendarSync({...link,baseline,timezone:"America/Los_Angeles"},{...baseline,task_text:"New title"},repeated);
    expect(plan.status==="linked" && plan.event?.startDate).toBe(repeated.startDate);
    expect(plan.status==="linked" && plan.event?.endDate).toBe(repeated.endDate);
  });
  it("preserves a multi-day all-day span when moving it", () => {
    const allDay={...event,startDate:"2026-09-19",endDate:"2026-09-23",isAllDay:true};
    const baseline=eventQuestSnapshot(allDay,"UTC");
    const plan=planCalendarSync({...link,baseline},{...baseline,task_date:"2026-09-21"},allDay);
    expect(plan.status==="linked" && plan.event).toMatchObject({startDate:"2026-09-21",endDate:"2026-09-25",isAllDay:true});
  });
  it("rejects scheduling into the missing daylight-saving hour", () => {
    const baseline=eventQuestSnapshot(event,"America/Los_Angeles");
    expect(()=>planCalendarSync({...link,baseline,timezone:"America/Los_Angeles"},{...baseline,task_date:"2026-03-08",scheduled_time:"02:30"},event)).toThrow("daylight saving");
  });
  it("clears local clock time when an outside task loses its due date", () => {
    const baseline={...base,completed:false};
    const plan=planCalendarSync({...link,baseline,resource_kind:"task"},baseline,{title:"Walk",dueDate:null,completed:false});
    expect(plan.status==="linked" && plan.snapshot).toMatchObject({task_date:null,scheduled_time:null,estimated_duration:60});
    expect(plan.status==="linked" && plan.task).toBeUndefined();
  });
  it("keeps simultaneous scheduling edits in conflict until the user chooses", () => {
    const local={...base,task_date:"2026-09-20"};
    const remote={...event,startDate:"2026-09-19T12:00Z",endDate:"2026-09-19T13:00Z"};
    expect(planCalendarSync(link,local,remote).status).toBe("conflict");
    const chosen=planCalendarSync(link,local,remote,"remote");
    expect(chosen.status==="linked" && chosen.snapshot.scheduled_time).toBe("12:00");
    expect(chosen.status==="linked" && chosen.event).toBeUndefined();
  });
  it("canonicalizes provider whitespace identically and advances lost-ack baselines", () => {
    expect(eventQuestSnapshot({...event,title:"  Walk  ",location:"  ",notes:" Private invitation "},"UTC")).toEqual(base);
    const agreed={...base,task_text:"Already sent"};
    const plan=planCalendarSync(link,agreed,{...event,title:"Already sent"});
    expect(plan.status==="linked" && plan.snapshot).toEqual(agreed);
    expect(plan.status==="linked" && plan.event).toBeUndefined();
  });
});
