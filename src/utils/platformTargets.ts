import { Capacitor } from "@capacitor/core";

export const isNativeIOS = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
};

export const isMacDesignedForIPadIOSApp = (): boolean => {
  if (!isNativeIOS()) {
    return false;
  }

  if (typeof navigator === "undefined") {
    return false;
  }

  return /Macintosh|Mac OS X/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) === 0;
};

export const isNativeIOSHandheld = (): boolean => {
  return isNativeIOS() && !isMacDesignedForIPadIOSApp();
};
