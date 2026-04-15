import { registerPlugin } from "@capacitor/core";

export interface WinWinKitReferredBy {
  code: string | null;
  type: "affiliate" | "promo" | "referral" | string | null;
}

export interface WinWinKitUser {
  appUserId: string | null;
  referralCode: string | null;
  referredBy: WinWinKitReferredBy | null;
  isPremium: boolean;
  metadata: Record<string, string>;
  stats: Record<string, unknown> | null;
}

export interface WinWinKitPluginInterface {
  configure(): Promise<{ configured: boolean }>;
  setAppUserId(options: { appUserId: string }): Promise<{ user: WinWinKitUser | null }>;
  setFirstSeenAt(options: { isoDate: string }): Promise<{ user: WinWinKitUser | null }>;
  setIsPremium(options: { isPremium: boolean }): Promise<{ user: WinWinKitUser | null }>;
  getUser(): Promise<{ user: WinWinKitUser | null }>;
  claimCode(options: { code: string }): Promise<{ user: WinWinKitUser | null; rewardsGranted: boolean }>;
}

export const WinWinKit = registerPlugin<WinWinKitPluginInterface>("WinWinKit", {
  web: () => import("./WinWinKitWeb").then((module) => new module.WinWinKitWeb()),
});
