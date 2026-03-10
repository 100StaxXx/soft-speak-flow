import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  badgesMountCount: 0,
  postcardsMountCount: 0,
  lootMountCount: 0,
}));

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");

  interface TabsContextValue {
    value?: string;
    onValueChange?: (value: string) => void;
  }

  const TabsContext = React.createContext<TabsContextValue>({});

  const Tabs = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );

  const TabsList = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  );

  const TabsTrigger = ({
    value,
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;

    return (
      <button
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? "active" : "inactive"}
        onClick={(event) => {
          onClick?.(event);
          context.onValueChange?.(value);
        }}
        {...props}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({
    value,
    forceMount,
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { value: string; forceMount?: boolean }) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;
    if (!isActive && !forceMount) return null;

    return (
      <div data-state={isActive ? "active" : "inactive"} hidden={!isActive} {...props}>
        {children}
      </div>
    );
  };

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock("@/components/BadgesCollectionPanel", async () => {
  const React = await import("react");
  return {
    BadgesCollectionPanel: () => {
      const [count, setCount] = React.useState(0);

      React.useEffect(() => {
        mocks.badgesMountCount += 1;
      }, []);

      return (
        <div>
          <div data-testid="badges-count">Badges count {count}</div>
          <button onClick={() => setCount((previous) => previous + 1)}>Badges increment</button>
        </div>
      );
    },
  };
});

vi.mock("@/components/companion/CompanionPostcards", async () => {
  const React = await import("react");
  return {
    CompanionPostcards: () => {
      const [count, setCount] = React.useState(0);

      React.useEffect(() => {
        mocks.postcardsMountCount += 1;
      }, []);

      return (
        <div>
          <div data-testid="postcards-count">Postcards count {count}</div>
          <button onClick={() => setCount((previous) => previous + 1)}>Postcards increment</button>
        </div>
      );
    },
  };
});

vi.mock("@/components/RewardInventory", async () => {
  const React = await import("react");
  return {
    RewardInventory: () => {
      const [count, setCount] = React.useState(0);

      React.useEffect(() => {
        mocks.lootMountCount += 1;
      }, []);

      return (
        <div>
          <div data-testid="loot-count">Loot count {count}</div>
          <button onClick={() => setCount((previous) => previous + 1)}>Loot increment</button>
        </div>
      );
    },
  };
});

import { CollectionTab } from "@/components/companion/CollectionTab";

describe("CollectionTab mount persistence", () => {
  beforeEach(() => {
    mocks.badgesMountCount = 0;
    mocks.postcardsMountCount = 0;
    mocks.lootMountCount = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps badges/postcards/loot panels mounted after first visit", async () => {
    render(<CollectionTab />);

    expect(mocks.badgesMountCount).toBe(1);
    expect(mocks.postcardsMountCount).toBe(0);
    expect(mocks.lootMountCount).toBe(0);

    fireEvent.click(screen.getByRole("tab", { name: /postcards/i }));
    await waitFor(() => {
      expect(screen.getByTestId("postcards-count")).toBeInTheDocument();
    });
    expect(mocks.postcardsMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: /loot/i }));
    await waitFor(() => {
      expect(screen.getByTestId("loot-count")).toBeInTheDocument();
    });
    expect(mocks.lootMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: /badges/i }));
    fireEvent.click(screen.getByRole("tab", { name: /postcards/i }));
    fireEvent.click(screen.getByRole("tab", { name: /loot/i }));

    expect(mocks.badgesMountCount).toBe(1);
    expect(mocks.postcardsMountCount).toBe(1);
    expect(mocks.lootMountCount).toBe(1);
  });

  it("preserves section-local state when switching between collection tabs", async () => {
    render(<CollectionTab />);

    fireEvent.click(screen.getByRole("tab", { name: /postcards/i }));
    await waitFor(() => {
      expect(screen.getByTestId("postcards-count")).toHaveTextContent("Postcards count 0");
    });

    fireEvent.click(screen.getByText("Postcards increment"));
    expect(screen.getByTestId("postcards-count")).toHaveTextContent("Postcards count 1");

    fireEvent.click(screen.getByRole("tab", { name: /badges/i }));
    fireEvent.click(screen.getByRole("tab", { name: /postcards/i }));

    expect(screen.getByTestId("postcards-count")).toHaveTextContent("Postcards count 1");
    expect(mocks.postcardsMountCount).toBe(1);
  });

  it("prewarms postcards and loot panels on idle after collection tab mounts", async () => {
    const originalRequestIdle = (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback;
    const originalCancelIdle = (window as Window & { cancelIdleCallback?: unknown }).cancelIdleCallback;
    (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback = undefined;
    (window as Window & { cancelIdleCallback?: unknown }).cancelIdleCallback = undefined;

    try {
      render(<CollectionTab />);

      expect(mocks.postcardsMountCount).toBe(0);
      expect(mocks.lootMountCount).toBe(0);

      await waitFor(() => {
        expect(mocks.postcardsMountCount).toBe(1);
        expect(mocks.lootMountCount).toBe(1);
      }, { timeout: 1500 });
    } finally {
      (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback = originalRequestIdle;
      (window as Window & { cancelIdleCallback?: unknown }).cancelIdleCallback = originalCancelIdle;
    }
  });
});
