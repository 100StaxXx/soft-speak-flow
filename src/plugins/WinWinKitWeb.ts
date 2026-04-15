import { WebPlugin } from "@capacitor/core";
import type {
  WinWinKitPluginInterface,
  WinWinKitUser,
} from "./WinWinKitPlugin";

export class WinWinKitWeb extends WebPlugin implements WinWinKitPluginInterface {
  async configure(): Promise<{ configured: boolean }> {
    return { configured: false };
  }

  async setAppUserId(_options: { appUserId: string }): Promise<{ user: WinWinKitUser | null }> {
    return { user: null };
  }

  async setFirstSeenAt(_options: { isoDate: string }): Promise<{ user: WinWinKitUser | null }> {
    return { user: null };
  }

  async setIsPremium(_options: { isPremium: boolean }): Promise<{ user: WinWinKitUser | null }> {
    return { user: null };
  }

  async getUser(): Promise<{ user: WinWinKitUser | null }> {
    return { user: null };
  }

  async claimCode(_options: { code: string }): Promise<{ user: WinWinKitUser | null; rewardsGranted: boolean }> {
    throw new Error("WinWinKit native referrals are only available on iOS devices");
  }
}
