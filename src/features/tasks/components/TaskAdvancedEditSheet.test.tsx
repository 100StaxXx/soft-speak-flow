import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseNaturalLanguage } from '@/shared/naturalLanguageTaskParser';
import { TaskAdvancedEditSheet } from './TaskAdvancedEditSheet';

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open?: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/QuestAttachmentPicker', () => ({
  QuestAttachmentPicker: () => <div data-testid="quest-attachment-picker" />,
}));

function renderSheet(onSave = vi.fn()) {
  const parsed = parseNaturalLanguage('Write report tomorrow at 9am');

  render(
    <TaskAdvancedEditSheet
      open
      onOpenChange={vi.fn()}
      parsed={parsed}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );

  return { onSave };
}

describe('TaskAdvancedEditSheet reminders', () => {
  it('offers longer quest reminder presets and a custom option', () => {
    renderSheet();

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: '15 minutes before' }));

    expect(screen.getByRole('button', { name: '1 day before' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 days before' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 week before' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
  });

  it('saves custom quest reminder minutes as normalized offsets', async () => {
    const onSave = vi.fn();
    renderSheet(onSave);

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: '15 minutes before' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Minutes before'), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        reminderEnabled: true,
        reminderMinutesBefore: 180,
        reminderOffsetsMinutes: [180],
      }));
    });
  });
});
