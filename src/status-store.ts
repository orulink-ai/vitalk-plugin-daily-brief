import { getPluginClient } from "./client";
import type { DailyBriefFollowUpStatus } from "./daily-brief";
const cache = new Map<string, Record<string, DailyBriefFollowUpStatus>>();
const errors = new Set<(message: string) => void>();
let writes = Promise.resolve();
function key(date: string) {
  return `follow-ups.${date}`;
}
export async function hydrateFollowUpStatuses(date: string) {
  const { value } = await getPluginClient().storage.get({ key: key(date) });
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    cache.set(date, {});
    return;
  }
  cache.set(
    date,
    Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, DailyBriefFollowUpStatus] =>
          ["pending", "completed", "dismissed"].includes(String(entry[1])),
      ),
    ),
  );
}
export function readFollowUpStatuses(date: string) {
  return cache.get(date) ?? {};
}
export function persistFollowUpStatuses(
  date: string,
  statuses: Record<string, DailyBriefFollowUpStatus>,
) {
  cache.set(date, { ...statuses });
  writes = writes
    .then(async () => {
      await getPluginClient().storage.set({ key: key(date), value: statuses });
    })
    .catch((error) => {
      for (const report of errors)
        report(
          `插件状态缓存未保存：${error instanceof Error ? error.message : String(error)}`,
        );
    });
}
export function subscribePersistenceErrors(
  listener: (message: string) => void,
) {
  errors.add(listener);
  return () => {
    errors.delete(listener);
  };
}
