import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),invoke:vi.fn(),permission:vi.fn(),native:vi.fn(),lists:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:mocks.session},rpc:mocks.rpc,functions:{invoke:mocks.invoke}}}));
vi.mock('@/plugins/NativeCalendarPlugin',()=>({NativeCalendar:{requestReminderPermissions:mocks.permission,findOrCreateReminder:mocks.native,listReminderLists:mocks.lists}}));
import { exportQuestToTaskList } from './calendarTaskExport';
const options={userId:'owner',taskId:'quest',connectionId:'conn',provider:'google' as 'google'|'apple',listId:'list',sync:false};
const intent={id:'intent',provider:'google',list_id:'list',status:'ready',external_id:null,snapshot:{task_text:'Read',task_date:null,notes:'Notes',completed:false}};
beforeEach(()=>{
  vi.clearAllMocks();mocks.session.mockResolvedValue({data:{session:{user:{id:'owner'}}},error:null});
  mocks.permission.mockResolvedValue({granted:true});mocks.invoke.mockResolvedValue({data:{complete:true},error:null});
  mocks.lists.mockResolvedValue({lists:[{id:'list',title:'Personal',readOnly:false}]});
  mocks.native.mockResolvedValue({task:{id:'reminder'}});
  mocks.rpc.mockImplementation(async(name)=>({data:name==='prepare_calendar_task_export'?intent:name==='claim_calendar_task_export'?{...intent,provider:'apple',status:'dispatched'}:true,error:null}));
});
afterEach(()=>vi.useRealTimers());
describe('explicit task exports',()=>{
  it('prepares a durable intent before asking Google to create anything',async()=>{
    await exportQuestToTaskList(options);
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_calendar_task_export',expect.objectContaining({p_task_id:'quest',p_connection_id:'conn',p_list_id:'list',p_sync_enabled:false}));
    expect(mocks.invoke).toHaveBeenCalledWith('calendar-task-items',{body:{action:'export',intentId:'intent'}});
    expect(mocks.permission).not.toHaveBeenCalled();
  });
  it('does not resend an already completed intent',async()=>{
    mocks.rpc.mockResolvedValue({data:{...intent,status:'complete'},error:null});await exportQuestToTaskList(options);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('fails closed if the database cannot prepare the intent',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:new Error('offline')});await expect(exportQuestToTaskList(options)).rejects.toThrow(/safely/);
    expect(mocks.invoke).not.toHaveBeenCalled();expect(mocks.native).not.toHaveBeenCalled();
  });
  it('requires separate Reminders permission before preparing a native send',async()=>{
    mocks.permission.mockResolvedValue({granted:false});await expect(exportQuestToTaskList({...options,provider:'apple'})).rejects.toThrow(/access/);
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.native).not.toHaveBeenCalled();
  });
  it('rejects a read-only Reminders destination before consuming a create attempt',async()=>{
    mocks.lists.mockResolvedValue({lists:[{id:'list',readOnly:true}]});
    await expect(exportQuestToTaskList({...options,provider:'apple'})).rejects.toThrow(/writable/);
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.native).not.toHaveBeenCalled();
  });
  it('creates a reminder only when the database grants the first dispatch',async()=>{
    mocks.rpc.mockImplementation(async(name)=>({data:name==='prepare_calendar_task_export'?{...intent,provider:'apple'}:name==='claim_calendar_task_export'?{...intent,provider:'apple',status:'dispatched'}:true,error:null}));
    await exportQuestToTaskList({...options,provider:'apple'});
    expect(mocks.native).toHaveBeenCalledWith(expect.objectContaining({intentId:'intent',createIfMissing:true,listId:'list'}));
    expect(mocks.rpc).toHaveBeenCalledWith('complete_calendar_task_export',{p_id:'intent',p_user_id:'owner',p_external_id:'reminder'});
  });
  it('checks an uncertain native send without creating another reminder',async()=>{
    mocks.rpc.mockImplementation(async(name)=>({data:name==='prepare_calendar_task_export'?{...intent,provider:'apple',status:'dispatched'}:true,error:null}));
    await exportQuestToTaskList({...options,provider:'apple'});
    expect(mocks.native).toHaveBeenCalledWith(expect.objectContaining({createIfMissing:false}));
    expect(mocks.rpc).not.toHaveBeenCalledWith('claim_calendar_task_export',expect.anything());
  });
  it('does not recreate a native reminder merely because recovery found nothing',async()=>{
    mocks.rpc.mockResolvedValue({data:{...intent,provider:'apple',status:'dispatched'},error:null});mocks.native.mockResolvedValue({task:null});
    await expect(exportQuestToTaskList({...options,provider:'apple'})).rejects.toThrow(/No second copy/);
    expect(mocks.native).toHaveBeenCalledWith(expect.objectContaining({createIfMissing:false}));
  });
  it('rechecks the signed-in account after preparing a native dispatch',async()=>{
    mocks.rpc.mockResolvedValue({data:{...intent,provider:'apple'},error:null});
    mocks.session.mockResolvedValueOnce({data:{session:{user:{id:'owner'}}},error:null}).mockResolvedValue({data:{session:{user:{id:'someone-else'}}},error:null});
    await expect(exportQuestToTaskList({...options,provider:'apple'})).rejects.toThrow(/Sign in/);
    expect(mocks.native).not.toHaveBeenCalled();
  });
  it('stops showing a pending send indefinitely when a response never arrives',async()=>{
    vi.useFakeTimers();mocks.invoke.mockReturnValue(new Promise(()=>{}));
    const check=expect(exportQuestToTaskList(options)).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(30001);await check;
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
