import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { QuestPlanner } from '@/features/quest-planner/QuestPlanner';
import type { CompanionPlannerLaunchIntent, CompanionPlannerProposal } from '@/types/companionPlanner';
export interface JourneysQuestProposalEditResult { saved: boolean; savedTitle?: string | null }
export type JourneysQuestProposalEditHandoff = (proposal: CompanionPlannerProposal) => Promise<JourneysQuestProposalEditResult>;
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: 'dialog' | 'drawer';
  selectedDate?: Date | null;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (id: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
  onQuestProposalEditHandoff?: JourneysQuestProposalEditHandoff;
}
/** Agenda's planning entry point has one flow. Legacy chat menus are not mounted. */
export function JourneysCompanionPlannerModal({ open, onOpenChange, selectedDate, launchIntent, onLaunchIntentConsumed }: Props) {
  const [saving, setSaving] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}><DialogContent hideCloseButton onInteractOutside={event => event.preventDefault()}
    className="flex h-[min(780px,92dvh)] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-3xl border-amber-100/25 bg-slate-950 p-0 text-slate-100 shadow-2xl">
    <DialogTitle className="sr-only">Quest Planner</DialogTitle><DialogDescription className="sr-only">Plan around commitments, choose goal-related quests, and review their times and durations.</DialogDescription>
    {open && <QuestPlanner onSavingChange={setSaving} selectedDate={selectedDate} launchIntent={launchIntent} onLaunchIntentConsumed={onLaunchIntentConsumed} onClose={() => onOpenChange(false)}/>}
  </DialogContent></Dialog>;
}
