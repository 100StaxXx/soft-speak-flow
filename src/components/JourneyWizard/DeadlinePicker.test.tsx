import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DeadlinePicker } from './DeadlinePicker';
import { PathfinderSurfaceContext } from '@/components/companion/usePlannerSurface';

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ disabled }: { disabled: (date: Date) => boolean }) => <button disabled={disabled(new Date(2026, 8, 21))}>Tomorrow</button>,
}));

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('DeadlinePicker', () => {
  it('counts calendar dates and allows tomorrow even late in the day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 20, 23, 30));
    render(<PathfinderSurfaceContext.Provider value={true}><DeadlinePicker value={new Date(2026, 8, 21)} onChange={vi.fn()} /></PathfinderSurfaceContext.Provider>);
    expect(screen.getByText('1 day until deadline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sep 21, 2026/ }));
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toBeEnabled();
    expect(screen.getByRole('dialog').className).toContain('agenda-quest-theme');
  });

  it('does not offer shortcuts before the minimum deadline', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 20));
    render(<DeadlinePicker value={undefined} onChange={vi.fn()} minDate={new Date(2026, 10, 1)} />);
    expect(screen.getByRole('button', { name: '2 weeks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1 month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '3 months' })).toBeEnabled();
  });
});
