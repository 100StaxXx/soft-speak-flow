import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({importEvent:vi.fn(),links:[] as any[]}));
vi.mock("@/hooks/useCalendarQuestImports",()=>({useCalendarQuestImports:()=>({links:mocks.links,importEvent:{mutateAsync:mocks.importEvent,isPending:false,isSuccess:false}})}));
import { ExternalEventDetails } from "./ExternalEventDetails";
import { normalizeExternalCalendarEvent } from "@/types/externalCalendar";
const event=normalizeExternalCalendarEvent({id:"e",title:"Meeting",calendarId:"cal",startDate:"2026-09-19T10:00Z",endDate:"2026-09-19T11:00Z",location:"City Hall",meetingUrl:"https://meet.google.com/example"},"google","Work")!;
beforeEach(()=>{vi.clearAllMocks();mocks.links=[];mocks.importEvent.mockResolvedValue("quest");});
it("does not import or edit anything merely by opening details",()=>{
  render(<ExternalEventDetails event={event} events={[event]} onClose={()=>{}}/>);
  expect(mocks.importEvent).not.toHaveBeenCalled();
  expect(screen.getByRole("link",{name:"Join meeting"})).toHaveAttribute("href","https://meet.google.com/example");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
it("imports only after an explicit action and respects two-way consent",async()=>{
  render(<ExternalEventDetails event={event} events={[event]} onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Turn into a quest"}));
  await waitFor(()=>expect(mocks.importEvent).toHaveBeenCalledWith({event,sync:true}));
});
it("does not offer duplicate conversion for an existing link",()=>{
  mocks.links=[{provider:"google",calendar_id:"cal",external_id:"e"}];
  render(<ExternalEventDetails event={event} events={[event]} onClose={()=>{}}/>);
  expect(screen.queryByRole("button",{name:"Turn into a quest"})).not.toBeInTheDocument();
});
it('quietly shows quest conflicts in details without adding calendar overlays',()=>{
  const start = new Date(event.startDate);
  const scheduledTime = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
  render(<ExternalEventDetails event={event} events={[event]} quests={[{id:'q',task_text:'Prepare slides',task_date:event.taskDate,scheduled_time:scheduledTime,estimated_duration:30}]} onClose={()=>{}}/>);
  expect(screen.getByText('Overlaps on this agenda: Prepare slides.')).toBeInTheDocument();
});
