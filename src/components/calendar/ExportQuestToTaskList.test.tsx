import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({from:vi.fn(),send:vi.fn(),busy:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'owner'}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:mocks.from}}));
vi.mock('@/services/calendarTaskExport',()=>({exportQuestToTaskList:mocks.send}));
import { ExportQuestToTaskList } from './ExportQuestToTaskList';
beforeEach(()=>{
  vi.clearAllMocks();mocks.send.mockResolvedValue(undefined);
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:async()=>({data:[{id:'q',task_text:'Read',task_date:null}],error:null})};mocks.from.mockReturnValue(chain);
});
function mount(){const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={cache}><ExportQuestToTaskList connectionId="conn" provider="google" listId="list" listName="Personal" onBusyChange={mocks.busy}/></QueryClientProvider>);}
async function chooseQuest(){fireEvent.click(screen.getByText('Send a quest to Google Tasks'));await screen.findByRole('option',{name:'Read'});fireEvent.change(screen.getByRole('combobox'),{target:{value:'q'}});}
it('does not load quests or send anything when the section is closed',()=>{mount();expect(mocks.from).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();});
it('requires an explicit send and leaves two-way sync opt-in',async()=>{
  mount();await chooseQuest();expect(screen.getByRole('checkbox')).not.toBeChecked();expect(mocks.send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Send selected quest'}));await waitFor(()=>expect(mocks.send).toHaveBeenCalledWith({userId:'owner',taskId:'q',connectionId:'conn',provider:'google',listId:'list',sync:false}));
  expect(await screen.findByRole('status')).toHaveTextContent('Sent to Google Tasks');
});
it('shows status recovery after failure and preserves the original destination',async()=>{
  mocks.send.mockRejectedValueOnce(new Error('Check status; no second copy was sent.'));mount();await chooseQuest();
  fireEvent.click(screen.getByRole('button',{name:'Send selected quest'}));await screen.findByRole('button',{name:'Check send status'});
  expect(screen.getByRole('combobox')).toBeDisabled();expect(screen.getByRole('checkbox')).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Check send status'}));await waitFor(()=>expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[0]).toEqual(mocks.send.mock.calls[1]);
});
