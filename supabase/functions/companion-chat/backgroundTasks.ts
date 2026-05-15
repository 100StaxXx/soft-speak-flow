export type CompanionChatPostResponseWorkStatus =
  | "scheduled"
  | "completed"
  | "skipped";

type EdgeRuntimeWaitUntil = (promise: Promise<unknown>) => void;

const getEdgeRuntimeWaitUntil = (): EdgeRuntimeWaitUntil | null => {
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: EdgeRuntimeWaitUntil };
  }).EdgeRuntime;

  return typeof runtime?.waitUntil === "function"
    ? runtime.waitUntil.bind(runtime)
    : null;
};

export function scheduleCompanionChatPostResponseWork(
  work: () => Promise<void>,
  options?: {
    waitUntil?: EdgeRuntimeWaitUntil | null;
    onError?: (error: unknown) => void;
  },
): CompanionChatPostResponseWorkStatus {
  const onError = options?.onError ?? ((error: unknown) => {
    console.warn("[companion-chat] post-response work failed", error);
  });
  const task = Promise.resolve()
    .then(work)
    .catch((error) => {
      onError(error);
    });
  const waitUntil = options?.waitUntil ?? getEdgeRuntimeWaitUntil();

  if (!waitUntil) {
    void task;
    return "scheduled";
  }

  try {
    waitUntil(task);
    return "scheduled";
  } catch (error) {
    onError(error);
    void task;
    return "scheduled";
  }
}
