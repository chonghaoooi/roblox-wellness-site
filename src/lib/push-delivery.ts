import type { PushMessage } from "./push-shared";

export type PushTarget = { id: string; endpoint: string; keys: { p256dh: string; auth: string } };
type Options = {
  send: (target: PushTarget, message: PushMessage) => Promise<unknown>;
  removeExpired: (id: string) => Promise<unknown>;
  pause?: (ms: number) => Promise<void>;
};

/** One broken/expired device never prevents delivery to the remaining subscribers. */
export async function deliverPush(targets: PushTarget[], message: PushMessage, options: Options) {
  const result = { attempted: targets.length, sent: 0, expired: 0, failed: 0 };
  const pause = options.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  for (let offset = 0; offset < targets.length; offset += 10) {
    await Promise.all(targets.slice(offset, offset + 10).map(async target => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await options.send(target, message); result.sent++; return; }
        catch (error) {
          const status = Number((error as { statusCode?: number })?.statusCode);
          if (status === 404 || status === 410) {
            try { await options.removeExpired(target.id); result.expired++; }
            catch { result.failed++; }
            return;
          }
          if (attempt === 0 && (!status || status === 429 || status >= 500)) { await pause(400); continue; }
          result.failed++; return;
        }
      }
    }));
  }
  return result;
}
