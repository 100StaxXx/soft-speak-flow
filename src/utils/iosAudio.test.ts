import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  let hidden = false;

  class FakeAudio extends EventTarget {
    paused = true;
    ended = false;
    muted = false;
    preload = "";
    src = "";
    volume = 1;
    currentTime = 0;
    duration = 0;
    error: { code?: number; message?: string } | null = null;
    playCalls = 0;

    async play() {
      this.playCalls += 1;
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
    }

    load() {
      return undefined;
    }
  }

  const setHidden = (nextHidden: boolean) => {
    hidden = nextHidden;
  };

  return {
    FakeAudio,
    setHidden,
    storage,
    get hidden() {
      return hidden;
    },
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "ios",
    isNativePlatform: () => false,
  },
}));

vi.mock("./storage", () => ({
  safeLocalStorage: {
    getItem: (key: string) => mocks.storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mocks.storage.set(key, value);
      return true;
    },
    removeItem: (key: string) => {
      mocks.storage.delete(key);
      return true;
    },
  },
}));

let iosAudioManager: typeof import("./iosAudio").iosAudioManager;

beforeAll(async () => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => mocks.hidden,
  });

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (mocks.hidden ? "hidden" : "visible"),
  });

  class FakeAudioContext {
    state: AudioContextState = "running";

    resume = vi.fn(async () => {
      this.state = "running";
      return undefined;
    });
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
  Object.defineProperty(window, "webkitAudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
  Object.defineProperty(window, "Audio", {
    configurable: true,
    value: mocks.FakeAudio,
  });
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: mocks.FakeAudio,
  });

  ({ iosAudioManager } = await import("./iosAudio"));
});

describe("iosAudio resume behavior", () => {
  const registeredAudios: Array<InstanceType<typeof mocks.FakeAudio>> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.storage.clear();
    mocks.setHidden(false);
    iosAudioManager.setMuted(false);
    registeredAudios.length = 0;
  });

  afterEach(() => {
    registeredAudios.forEach((audio) => {
      iosAudioManager.unregisterAudio(audio as unknown as HTMLAudioElement);
    });
    registeredAudios.length = 0;
    mocks.setHidden(false);
    iosAudioManager.setMuted(false);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const registerAudio = () => {
    const audio = new mocks.FakeAudio();
    registeredAudios.push(audio);
    iosAudioManager.registerAudio(audio as unknown as HTMLAudioElement);
    return audio;
  };

  it("does not auto-resume audio that has never been played", async () => {
    const audio = registerAudio();

    mocks.setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));

    mocks.setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.runAllTimersAsync();

    expect(audio.playCalls).toBe(0);
    expect(audio.paused).toBe(true);
  });

  it("resumes audio that was actively playing before the app was backgrounded", async () => {
    const audio = registerAudio();
    await audio.play();

    mocks.setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));

    audio.pause();

    mocks.setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.runAllTimersAsync();

    expect(audio.playCalls).toBe(2);
    expect(audio.paused).toBe(false);
  });
});
