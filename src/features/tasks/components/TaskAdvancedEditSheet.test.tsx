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

function renderSheet(onSave = vi.fn(), text = 'Write report tomorrow at 9am') {
  const parsed = parseNaturalLanguage(text);

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
    expect(screen.getByTestId('task-early-reminder-options')).toHaveClass('overflow-hidden');
    expect(screen.getByTestId('task-early-reminder-options-scroll')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('task-early-reminder-options-scroll').className).toContain('calc(100dvh-12rem)');
  });

  it('saves custom quest reminder date and time as normalized offsets', async () => {
    const onSave = vi.fn();
    renderSheet(onSave);

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: '15 minutes before' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByText('Custom reminder date')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Custom reminder time'), { target: { value: '07:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        reminderEnabled: true,
        reminderMinutesBefore: 90,
        reminderOffsetsMinutes: [90],
      }));
    });
  });

  it('keeps custom reminder minutes as a fallback without a concrete quest date', async () => {
    const onSave = vi.fn();
    renderSheet(onSave, 'Write report');

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
