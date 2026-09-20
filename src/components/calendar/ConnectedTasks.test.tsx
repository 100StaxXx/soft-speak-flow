import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn(),rpc:vi.fn(),permission:vi.fn(),lists:vi.fn(),connections:[] as any[]}));
vi.mock("@tanstack/react-query",()=>({useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock("@/hooks/useCalendarIntegrations",()=>({useCalendarIntegrations:()=>({connections:mocks.connections})}));
vi.mock("@/hooks/useCalendarQuestImports",()=>({useCalendarQuestImports:()=>({links:[],invalidate:vi.fn()})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke:mocks.invoke},rpc:mocks.rpc}}));
vi.mock("@/plugins/NativeCalendarPlugin",()=>({NativeCalendar:{requestReminderPermissions:mocks.permission,listReminderLists:mocks.lists}}));
vi.mock('./ExportQuestToTaskList',()=>({ExportQuestToTaskList:()=>null}));
import { ConnectedTasks } from "./ConnectedTasks";
beforeEach(()=>{vi.clearAllMocks();mocks.connections=[{id:"conn",provider:"google"}];mocks.rpc.mockResolvedValue({error:null});});
it("does not request task permissions automatically",()=>{
  render(<ConnectedTasks/>);expect(mocks.invoke).not.toHaveBeenCalled();expect(mocks.permission).not.toHaveBeenCalled();
});
it("requires Apple Reminders consent before reading lists",async()=>{
  mocks.connections=[{id:"apple",provider:"apple"}];mocks.permission.mockResolvedValue({granted:false});
  render(<ConnectedTasks/>);fireEvent.click(screen.getByText("Connected tasks and reminders"));fireEvent.click(screen.getByRole("button",{name:"Apple Reminders"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("wasn't granted");expect(mocks.lists).not.toHaveBeenCalled();
});
it("imports one selected task without bulk-importing the list",async()=>{
  mocks.invoke.mockResolvedValueOnce({data:{items:[{id:"list",title:"Personal"}]},error:null})
    .mockResolvedValueOnce({data:{items:[{id:"task",listId:"list",title:"Read",dueDate:null,completed:false,notes:null}]},error:null});
  render(<ConnectedTasks/>);fireEvent.click(screen.getByText("Connected tasks and reminders"));fireEvent.click(screen.getByRole("button",{name:"Google Tasks"}));
  fireEvent.change(await screen.findByRole("combobox"),{target:{value:"list"}});
  fireEvent.click(await screen.findByRole("button",{name:"Add to Goals"}));
  await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith("import_calendar_quest",expect.objectContaining({p_kind:"task",p_external_id:"task",p_calendar_id:"list",p_connection_id:"conn",p_sync_enabled:true})));
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
