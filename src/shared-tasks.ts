import type { PluginTask } from "@vitalk/plugin-sdk";
import { getPluginClient } from "./client";
export type SharedTaskRecord = PluginTask & { kind: "todo" };
export interface SharedTaskSnapshot {
  records: SharedTaskRecord[];
}
function snapshot(value: { items: PluginTask[] }): SharedTaskSnapshot {
  return { records: value.items.map((item) => ({ ...item, kind: "todo" })) };
}
export async function readSharedTasks() {
  return snapshot(await getPluginClient().tasks.list());
}
export async function syncSharedTaskStatus(
  id: string,
  status: "active" | "completed" | "dismissed",
) {
  return snapshot(
    await getPluginClient().tasks.setStatus({ id: `todo:${id}`, status }),
  );
}
export function subscribeSharedTasks(
  callback: () => void,
  onError: (message: string) => void,
) {
  const client = getPluginClient();
  let disposed = false;
  const remove = client.tasks.onChanged(() => {
    if (!disposed) callback();
  });
  void client.tasks.watch().catch((error) => {
    if (!disposed)
      onError(
        `事项通知不可用：${error instanceof Error ? error.message : String(error)}`,
      );
  });
  return () => {
    disposed = true;
    remove();
  };
}
