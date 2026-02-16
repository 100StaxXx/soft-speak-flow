import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number, y?: number) {
    if (typeof options === "number") {
      this.scrollLeft = options;
      this.scrollTop = typeof y === "number" ? y : this.scrollTop;
      return;
    }

    if (options && typeof options === "object") {
      if (typeof options.left === "number") {
        this.scrollLeft = options.left;
      }
      if (typeof options.top === "number") {
        this.scrollTop = options.top;
      }
    }
  };
}

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: (options?: ScrollToOptions | number, y?: number) => {
    if (typeof options === "number") {
      (window as Window & { scrollX: number; scrollY: number }).scrollX = options;
      (window as Window & { scrollX: number; scrollY: number }).scrollY =
        typeof y === "number" ? y : window.scrollY;
      return;
    }

    if (options && typeof options === "object") {
      if (typeof options.left === "number") {
        (window as Window & { scrollX: number; scrollY: number }).scrollX = options.left;
      }
      if (typeof options.top === "number") {
        (window as Window & { scrollX: number; scrollY: number }).scrollY = options.top;
      }
    }
  },
});

Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  writable: true,
  value: () => undefined,
});
