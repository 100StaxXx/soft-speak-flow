import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PullToRefreshContainer } from "@/components/PullToRefreshContainer";

const setScrollY = (value: number) => {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
    writable: true,
  });
};

const startPull = (element: HTMLElement, startX: number, startY: number) => {
  fireEvent.touchStart(element, {
    touches: [{ clientX: startX, clientY: startY }],
  });
};

const movePull = (element: HTMLElement, moveX: number, moveY: number) => {
  fireEvent.touchMove(element, {
    cancelable: true,
    touches: [{ clientX: moveX, clientY: moveY }],
  });
};

const endPull = (element: HTMLElement) => {
  fireEvent.touchEnd(element);
};

describe("PullToRefreshContainer", () => {
  it("does not refresh when pull distance is below threshold", async () => {
    setScrollY(0);
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    const { getByTestId } = render(
      <PullToRefreshContainer onRefresh={onRefresh} threshold={72}>
        <div data-testid="content">content</div>
      </PullToRefreshContainer>,
    );

    const container = getByTestId("content").parentElement?.parentElement as HTMLElement;

    startPull(container, 0, 0);
    movePull(container, 0, 60); // damped to 30
    await act(async () => {
      endPull(container);
    });

    await waitFor(() => {
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  it("refreshes exactly once when pull exceeds threshold", async () => {
    setScrollY(0);
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    const { getByTestId } = render(
      <PullToRefreshContainer onRefresh={onRefresh} threshold={72}>
        <div data-testid="content">content</div>
      </PullToRefreshContainer>,
    );

    const container = getByTestId("content").parentElement?.parentElement as HTMLElement;

    startPull(container, 0, 0);
    movePull(container, 0, 180); // damped to 90
    endPull(container);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores horizontal drag gestures", async () => {
    setScrollY(0);
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    const { getByTestId } = render(
      <PullToRefreshContainer onRefresh={onRefresh} threshold={72}>
        <div data-testid="content">content</div>
      </PullToRefreshContainer>,
    );

    const container = getByTestId("content").parentElement?.parentElement as HTMLElement;

    startPull(container, 0, 0);
    movePull(container, 120, 40);
    endPull(container);

    await waitFor(() => {
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  it("blocks duplicate pulls while refresh is in flight", async () => {
    setScrollY(0);

    let resolveRefresh: (() => void) | null = null;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const { getByTestId } = render(
      <PullToRefreshContainer onRefresh={onRefresh} threshold={72}>
        <div data-testid="content">content</div>
      </PullToRefreshContainer>,
    );

    const container = getByTestId("content").parentElement?.parentElement as HTMLElement;

    startPull(container, 0, 0);
    movePull(container, 0, 180);
    endPull(container);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    startPull(container, 0, 0);
    movePull(container, 0, 180);
    endPull(container);

    expect(onRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh?.();

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("updates indicator label from pull to release to refreshing", async () => {
    setScrollY(0);

    let resolveRefresh: (() => void) | null = null;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const { getByTestId, getByText } = render(
      <PullToRefreshContainer onRefresh={onRefresh} threshold={72}>
        <div data-testid="content">content</div>
      </PullToRefreshContainer>,
    );

    const container = getByTestId("content").parentElement?.parentElement as HTMLElement;

    startPull(container, 0, 0);
    movePull(container, 0, 200);
    getByText("Release to refresh");

    endPull(container);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(getByText("Refreshing...")).toBeInTheDocument();
    });

    await act(async () => {
      resolveRefresh?.();
    });
  });
});
