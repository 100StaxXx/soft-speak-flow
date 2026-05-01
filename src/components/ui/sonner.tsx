import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import type { ExternalToast, ToasterProps } from "sonner";

import { MAX_TOAST_DURATION_MS, clampToastDuration } from "@/constants/toast";

const dismissTimeouts = new Map<string | number, ReturnType<typeof globalThis.setTimeout>>();
type PromiseData<T> = NonNullable<Parameters<typeof sonnerToast.promise<T>>[1]>;
const DEFAULT_BOTTOM_OFFSET = "var(--sonner-bottom-offset, calc(env(safe-area-inset-bottom, 0px) + 16px))";

const capToastOptions = (options?: ExternalToast): ExternalToast => ({
  ...options,
  duration: clampToastDuration(options?.duration),
});

const capPromiseData = <T,>(data?: PromiseData<T>): PromiseData<T> | undefined => {
  if (!data) return data;

  return {
    ...data,
    duration: clampToastDuration(data.duration),
  };
};

const clearScheduledDismiss = (toastId?: string | number) => {
  if (toastId === undefined) {
    dismissTimeouts.forEach((timeout) => {
      globalThis.clearTimeout(timeout);
    });
    dismissTimeouts.clear();
    return;
  }

  const timeout = dismissTimeouts.get(toastId);
  if (!timeout) return;

  globalThis.clearTimeout(timeout);
  dismissTimeouts.delete(toastId);
};

const scheduleDismiss = (toastId: string | number, duration = MAX_TOAST_DURATION_MS) => {
  clearScheduledDismiss(toastId);

  const timeout = globalThis.setTimeout(() => {
    dismissTimeouts.delete(toastId);
    sonnerToast.dismiss(toastId);
  }, duration);

  dismissTimeouts.set(toastId, timeout);
};

const createTimedToast = (
  createToast: (message: Parameters<typeof sonnerToast>[0], data?: ExternalToast) => string | number,
  message: Parameters<typeof sonnerToast>[0],
  data?: ExternalToast,
) => {
  const cappedOptions = capToastOptions(data);
  const toastId = createToast(message, cappedOptions);
  scheduleDismiss(toastId, cappedOptions.duration);
  return toastId;
};

const createTimedCustomToast = (
  jsx: Parameters<typeof sonnerToast.custom>[0],
  data?: ExternalToast,
) => {
  const cappedOptions = capToastOptions(data);
  const toastId = sonnerToast.custom(jsx, cappedOptions);
  scheduleDismiss(toastId, cappedOptions.duration);
  return toastId;
};

const toast = Object.assign(
  ((message, data) => createTimedToast(sonnerToast, message, data)) as typeof sonnerToast,
  {
    success: (message, data) => createTimedToast(sonnerToast.success, message, data),
    info: (message, data) => createTimedToast(sonnerToast.info, message, data),
    warning: (message, data) => createTimedToast(sonnerToast.warning, message, data),
    error: (message, data) => createTimedToast(sonnerToast.error, message, data),
    custom: (jsx, data) => createTimedCustomToast(jsx, data),
    message: (message, data) => createTimedToast(sonnerToast.message, message, data),
    promise: <ToastData,>(promise: Parameters<typeof sonnerToast.promise<ToastData>>[0], data?: PromiseData<ToastData>) =>
      sonnerToast.promise(promise, capPromiseData(data)),
    dismiss: (toastId) => {
      clearScheduledDismiss(toastId);
      return sonnerToast.dismiss(toastId);
    },
    loading: (message, data) => createTimedToast(sonnerToast.loading, message, data),
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  },
);

const Toaster = ({ ...props }: ToasterProps) => {
  // Hardcoded dark theme - removes next-themes dependency that causes iOS WKWebView crash
  const theme = "dark";
  const { duration, toastOptions, offset, mobileOffset, ...restProps } = props;
  const cappedDuration = clampToastDuration(duration);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={cappedDuration}
      position="bottom-center"
      offset={offset ?? { bottom: DEFAULT_BOTTOM_OFFSET }}
      mobileOffset={mobileOffset ?? { bottom: DEFAULT_BOTTOM_OFFSET, left: "1rem", right: "1rem" }}
      pauseWhenPageIsHidden={false}
      swipeDirections={['bottom', 'left', 'right']}
      toastOptions={{
        ...toastOptions,
        duration: clampToastDuration(toastOptions?.duration ?? duration),
        classNames: {
          ...toastOptions?.classNames,
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...restProps}
    />
  );
};

export { Toaster, toast };
