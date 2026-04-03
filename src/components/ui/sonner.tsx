import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import type { ExternalToast, PromiseData, ToasterProps } from "sonner";

import { MAX_TOAST_DURATION_MS, clampToastDuration } from "@/constants/toast";

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

const scheduleDismiss = (toastId: string | number) => {
  globalThis.setTimeout(() => {
    sonnerToast.dismiss(toastId);
  }, MAX_TOAST_DURATION_MS);
};

const toast = Object.assign(
  ((message, data) => sonnerToast(message, capToastOptions(data))) as typeof sonnerToast,
  {
    success: (message, data) => sonnerToast.success(message, capToastOptions(data)),
    info: (message, data) => sonnerToast.info(message, capToastOptions(data)),
    warning: (message, data) => sonnerToast.warning(message, capToastOptions(data)),
    error: (message, data) => sonnerToast.error(message, capToastOptions(data)),
    custom: (jsx, data) => sonnerToast.custom(jsx, capToastOptions(data)),
    message: (message, data) => sonnerToast.message(message, capToastOptions(data)),
    promise: <ToastData,>(promise: Parameters<typeof sonnerToast.promise<ToastData>>[0], data?: PromiseData<ToastData>) =>
      sonnerToast.promise(promise, capPromiseData(data)),
    dismiss: sonnerToast.dismiss,
    loading: (message, data) => {
      const toastId = sonnerToast.loading(message, capToastOptions(data));
      scheduleDismiss(toastId);
      return toastId;
    },
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  },
);

const Toaster = ({ ...props }: ToasterProps) => {
  // Hardcoded dark theme - removes next-themes dependency that causes iOS WKWebView crash
  const theme = "dark";
  const { duration, toastOptions, ...restProps } = props;
  const cappedDuration = clampToastDuration(duration);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={cappedDuration}
      position="bottom-center"
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
