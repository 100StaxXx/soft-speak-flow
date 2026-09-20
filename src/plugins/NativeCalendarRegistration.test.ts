import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const swift = read("ios/App/App/Plugins/NativeCalendar/NativeCalendarPlugin.swift");
const objc = read("ios/App/App/Plugins/NativeCalendar/NativeCalendarPlugin.m");
const types = read("src/plugins/NativeCalendarTypes.ts");
const methodNames = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((match) => match[1]).sort();

describe("NativeCalendar iOS bridge contract", () => {
  it("exposes every TypeScript method in both native registrations", () => {
    const interfaceBody = types.split("export interface NativeCalendarPlugin {")[1].split("export interface NativeReminder")[0];
    const expected = methodNames(interfaceBody, /^ {2}(\w+)\(/gm);
    // CAP_PLUGIN supplies an Objective-C category that can override the Swift method list.
    expect(methodNames(objc, /CAP_PLUGIN_METHOD\((\w+),/g)).toEqual(expected);
    expect(methodNames(swift, /CAPPluginMethod\(name: "(\w+)"/g)).toEqual(expected);
    expect(methodNames(swift, /@objc public (?:override )?func (\w+)\(_ call: CAPPluginCall\)/g)).toEqual(expected);
  });

  it("includes both legacy and modern Reminders permission descriptions", () => {
    const plist = read("ios/App/App/Info.plist");
    for (const key of ["NSRemindersUsageDescription", "NSRemindersFullAccessUsageDescription"]) {
      expect(plist).toMatch(new RegExp(`<key>${key}</key>\\s*<string>[^<]+</string>`));
    }
  });
});
