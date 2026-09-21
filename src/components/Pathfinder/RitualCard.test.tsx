import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RitualCard } from './RitualCard';
import { PathfinderSurfaceContext } from '@/components/companion/usePlannerSurface';
const ritual = { id: 'test-ritual', title: 'Practice Spanish', description: '', frequency: 'daily' as const, difficulty: 'easy' as const, estimatedMinutes: 15 };
afterEach(cleanup);
describe('RitualCard mobile editing', () => {
  it('shows named edit and remove controls without a hover gesture', () => {
    render(<RitualCard ritual={ritual} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    const edit = screen.getByRole('button', {name: 'Edit Practice Spanish'});
    expect(edit.parentElement?.className).not.toContain('opacity-0');
    expect(screen.getByRole('button', {name: 'Remove Practice Spanish'})).toBeVisible();
  });
  it('rejects empty ritual names and saves trimmed edits', () => {
    const onUpdate = vi.fn();
    render(<PathfinderSurfaceContext.Provider value={true}><RitualCard ritual={ritual} onUpdate={onUpdate} onDelete={vi.fn()} isEditing /></PathfinderSurfaceContext.Provider>);
    fireEvent.change(screen.getByPlaceholderText('Ritual name'), {target: {value: '   '}});
    expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Ritual name'), {target: {value: '  Read a chapter  '}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({title:'Read a chapter'}));
  });
});
