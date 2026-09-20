import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn(),rpc:vi.fn(),permission:vi.fn(),lists:vi.fn(),reminders:vi.fn(),connections:[] as any[]}));
vi.mock("@tanstack/react-query",()=>({useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock("@/hooks/useCalendarIntegrations",()=>({useCalendarIntegrations:()=>({connections:mocks.connections})}));
vi.mock("@/hooks/useCalendarQuestImports",()=>({useCalendarQuestImports:()=>({links:[],invalidate:vi.fn()})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke:mocks.invoke},rpc:mocks.rpc}}));
vi.mock("@/plugins/NativeCalendarPlugin",()=>({NativeCalendar:{requestReminderPermissions:mocks.permission,listReminderLists:mocks.lists,listReminders:mocks.reminders}}));
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

it("opens Apple lists after consent and imports only the chosen reminder", async () => {
  mocks.connections = [{ id: "apple", provider: "apple" }];
  mocks.permission.mockResolvedValue({ granted: true });
  mocks.lists.mockResolvedValue({ lists: [{ id: "personal", title: "Personal" }] });
  mocks.reminders.mockResolvedValue({ tasks: [
    { id: "one", listId: "personal", title: "Read", dueDate: null, completed: false, notes: null },
    { id: "two", listId: "personal", title: "Walk", dueDate: null, completed: false, notes: null },
  ] });
  render(<ConnectedTasks />);
  fireEvent.click(screen.getByText("Connected tasks and reminders"));
  fireEvent.click(screen.getByRole("button", { name: "Apple Reminders" }));
  fireEvent.change(await screen.findByRole("combobox"), { target: { value: "personal" } });
  fireEvent.click((await screen.findAllByRole("button", { name: "Add to Goals" }))[0]);
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("import_calendar_quest", expect.objectContaining({
    p_connection_id: "apple", p_calendar_id: "personal", p_external_id: "one", p_kind: "task",
  })));
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.reminders).toHaveBeenCalledWith({ listId: "personal" });
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("replaces the missing iOS method error with update guidance and allows retry", async () => {
  mocks.connections = [{ id: "apple", provider: "apple" }];
  mocks.permission.mockRejectedValueOnce(new Error('"NativeCalendar.requestReminderPermissions()" is not implemented on ios'))
    .mockResolvedValueOnce({ granted: true });
  mocks.lists.mockResolvedValue({ lists: [{ id: "personal", title: "Personal" }] });
  render(<ConnectedTasks />);
  fireEvent.click(screen.getByText("Connected tasks and reminders"));
  fireEvent.click(screen.getByRole("button", { name: "Apple Reminders" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Update Cosmiq");
  expect(alert).not.toHaveTextContent("NativeCalendar");
  expect(mocks.lists).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apple Reminders" }));
  await screen.findByRole("combobox");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not expose native implementation errors when loading reminders", async () => {
  mocks.connections = [{ id: "apple", provider: "apple" }];
  mocks.permission.mockResolvedValue({ granted: true });
  mocks.lists.mockResolvedValue({ lists: [{ id: "personal", title: "Personal", readOnly: true }] });
  mocks.reminders.mockRejectedValue({ message: '"NativeCalendar.listReminders()" is not implemented on ios' });
  render(<ConnectedTasks />);
  fireEvent.click(screen.getByText("Connected tasks and reminders"));
  fireEvent.click(screen.getByRole("button", { name: "Apple Reminders" }));
  fireEvent.change(await screen.findByRole("combobox"), { target: { value: "personal" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Update Cosmiq");
  expect(screen.getByRole("alert")).not.toHaveTextContent("NativeCalendar");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
