import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('framer-motion', () => {
  const passthrough = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const {
      animate: _animate,
      exit: _exit,
      initial: _initial,
      layout: _layout,
      transition: _transition,
      variants: _variants,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...domProps
    } = props;

    return <div {...domProps}>{children}</div>;
  };

  const motionProxy = new Proxy(
    {},
    {
      get: () => passthrough,
    },
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});
import { OrbMatchGame } from './OrbMatchGame';

describe('OrbMatchGame smoke', () => {
  it('renders the Starburst HUD without crashing', () => {
    render(
      <OrbMatchGame
        companionStats={{ mind: 50, body: 50, soul: 50 }}
        onComplete={vi.fn()}
        difficulty="easy"
        isPractice
      />,
    );

    expect(screen.getByText('Starburst - Level 1')).toBeInTheDocument();
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
  });
});
