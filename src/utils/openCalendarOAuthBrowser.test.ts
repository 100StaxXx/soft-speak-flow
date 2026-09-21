import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openCalendarOAuthBrowser } from './openCalendarOAuthBrowser';
const mocks = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(), platform: 'ios' }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: mocks.open, close: mocks.close } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform } }));
describe('calendar sign-in browser recovery', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.platform = 'ios'; });
  it.each(['https://accounts.google.com/o/oauth2/v2/auth?state=signed', 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=signed'])('recovers a retained iOS controller for %s without changing the URL', async (url) => {
    const calls: string[] = [];
    mocks.open.mockImplementationOnce(async () => { calls.push('open'); throw { message: 'Unable to display URL' }; })
      .mockImplementationOnce(async () => { calls.push('reopen'); });
    mocks.close.mockImplementationOnce(async () => { calls.push('close'); });
    await openCalendarOAuthBrowser(url);
    expect(calls).toEqual(['open', 'close', 'reopen']);
    expect(mocks.open.mock.calls).toEqual([[{url}], [{url}]]);
  });
  it('leaves a healthy browser alone', async () => {
    await openCalendarOAuthBrowser('https://accounts.google.com/');
    expect(mocks.open).toHaveBeenCalledTimes(1); expect(mocks.close).not.toHaveBeenCalled();
  });
  it('does not retry indefinitely or expose raw native errors', async () => {
    mocks.open.mockRejectedValue(new Error('Unable to display URL'));
    await expect(openCalendarOAuthBrowser('https://accounts.google.com/')).rejects.toThrow('Your Cosmiq sign-in');
    expect(mocks.open).toHaveBeenCalledTimes(2); expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it('handles a concurrent callback closing the old browser', async () => {
    mocks.open.mockRejectedValueOnce(new Error('Unable to display URL'));
    mocks.close.mockRejectedValueOnce(new Error('No active window to close!'));
    await openCalendarOAuthBrowser('https://accounts.google.com/');
    expect(mocks.open).toHaveBeenCalledTimes(2);
  });
  it('does not reopen if closing fails unexpectedly', async () => {
    mocks.open.mockRejectedValueOnce(new Error('Unable to display URL'));
    mocks.close.mockRejectedValueOnce(new Error('bridge unavailable'));
    await expect(openCalendarOAuthBrowser('https://accounts.google.com/')).rejects.toThrow('could not open');
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });
  it.each(['android', 'web'])('does not apply the iOS recovery on %s', async (platform) => {
    mocks.platform = platform; mocks.open.mockRejectedValueOnce(new Error('Unable to display URL'));
    await expect(openCalendarOAuthBrowser('https://accounts.google.com/')).rejects.toThrow('could not open');
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it('rejects insecure URLs before browser actions', async () => {
    await expect(openCalendarOAuthBrowser('http://example.com')).rejects.toThrow('not secure');
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.close).not.toHaveBeenCalled();
  });
});
