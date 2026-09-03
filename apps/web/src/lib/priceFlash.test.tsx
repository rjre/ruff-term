// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePriceFlashes } from "./priceFlash";

/**
 * Mirrors how real panels call the hook: the entries array is rebuilt inline
 * on every render, so it is a new object identity each time. That is exactly
 * what broke the original implementation.
 */
function Probe({ prices }: { prices: Record<string, number> }) {
  const flashes = usePriceFlashes(
    Object.entries(prices).map(([key, value]) => ({ key, value })),
  );
  return (
    <div data-testid="flashes">
      {Object.keys(prices)
        .map((k) => `${k}:${flashes.get(k) ?? "none"}`)
        .join(" ")}
    </div>
  );
}

function state() {
  return screen.getByTestId("flashes").textContent;
}

afterEach(() => {
  // Auto-cleanup only registers itself when vitest runs with `globals: true`,
  // which this config does not, so unmount explicitly between tests.
  cleanup();
  vi.useRealTimers();
});

describe("usePriceFlashes", () => {
  it("does not flash on the first render", () => {
    render(<Probe prices={{ AAPL: 100 }} />);
    expect(state()).toBe("AAPL:none");
  });

  it("flashes up and down according to the direction of the move", () => {
    const { rerender } = render(<Probe prices={{ AAPL: 100, MSFT: 50 }} />);
    rerender(<Probe prices={{ AAPL: 101, MSFT: 49 }} />);
    expect(state()).toBe("AAPL:up MSFT:down");
  });

  it("leaves unchanged keys alone", () => {
    const { rerender } = render(<Probe prices={{ AAPL: 100, MSFT: 50 }} />);
    rerender(<Probe prices={{ AAPL: 101, MSFT: 50 }} />);
    expect(state()).toBe("AAPL:up MSFT:none");
  });

  it("flashes a newly added key only once it moves", () => {
    const { rerender } = render(<Probe prices={{ AAPL: 100 }} />);
    rerender(<Probe prices={{ AAPL: 100, MSFT: 50 }} />);
    expect(state()).toBe("AAPL:none MSFT:none");
    rerender(<Probe prices={{ AAPL: 100, MSFT: 51 }} />);
    expect(state()).toBe("AAPL:none MSFT:up");
  });

  // Regression: the effect used to key off the inline-built entries array, so
  // the re-render that setFlashes triggered re-ran the effect and cleared its
  // own timer. The flash class then stuck on the cell forever.
  it("clears the flash after the timeout", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe prices={{ AAPL: 100 }} />);
    rerender(<Probe prices={{ AAPL: 101 }} />);
    expect(state()).toBe("AAPL:up");

    act(() => void vi.advanceTimersByTime(3000));
    expect(state()).toBe("AAPL:none");
  });

  // The user-visible consequence of the bug above: with the class stuck on,
  // a second tick in the same direction produced no new animation.
  it("re-flashes on a second move in the same direction", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe prices={{ AAPL: 100 }} />);

    rerender(<Probe prices={{ AAPL: 101 }} />);
    expect(state()).toBe("AAPL:up");
    act(() => void vi.advanceTimersByTime(3000));
    expect(state()).toBe("AAPL:none");

    rerender(<Probe prices={{ AAPL: 102 }} />);
    expect(state()).toBe("AAPL:up");
  });

  // A re-render with identical prices must not restart the clear timer,
  // otherwise a busy parent keeps a flash alive indefinitely.
  it("does not extend the flash on an unrelated re-render", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe prices={{ AAPL: 100 }} />);
    rerender(<Probe prices={{ AAPL: 101 }} />);

    act(() => void vi.advanceTimersByTime(2000));
    rerender(<Probe prices={{ AAPL: 101 }} />);
    expect(state()).toBe("AAPL:up");

    act(() => void vi.advanceTimersByTime(1000));
    expect(state()).toBe("AAPL:none");
  });
});
