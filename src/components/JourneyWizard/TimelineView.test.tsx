import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineView } from './TimelineView';

const feasibilityAssessment = {
  daysAvailable: 60,
  typicalDays: 90,
  feasibility: 'achievable' as const,
  message: 'This timeline can work well with steady effort.',
};

const phases = [
  {
    id: 'phase-1',
    name: 'Launch and First Steps',
    description: 'Set up the basics and start taking real action right away.',
    startDate: '2026-02-27',
    endDate: '2026-03-15',
    phaseOrder: 1,
  },
];

const milestones = [
  {
    id: 'milestone-1',
    title: 'First real progress',
    description: 'Keep the work active and moving forward.',
    targetDate: '2026-03-05',
    phaseOrder: 1,
    phaseName: 'Launch and First Steps',
    isPostcardMilestone: true,
    milestonePercent: 15,
  },
];

const rituals = [
  {
    id: 'ritual-1',
    title: 'Daily action block',
    description: 'Take one real action each day.',
    frequency: 'daily' as const,
    difficulty: 'medium' as const,
    estimatedMinutes: 30,
  },
];

describe('JourneyWizard TimelineView', () => {
  it('shows plain-English overlap guidance without exposing internal labels', () => {
    render(
      <TimelineView
        feasibilityAssessment={feasibilityAssessment}
        phases={phases}
        milestones={milestones}
        rituals={rituals}
        weeklyHoursEstimate={8}
        deadline="2026-04-28"
        executionModel="overlap_early"
        postcardCount={1}
        maxPostcards={7}
      />,
    );

    expect(
      screen.getByText('This plan starts the real work early and keeps momentum going throughout.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/overlap_early/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parallelizable/i)).not.toBeInTheDocument();
  });
});
