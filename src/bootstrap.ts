import { supportsDailyBriefHost } from "./host-version";
import type { Session, UiLanguage } from "./types";
interface BootstrapDependencies {
  client: {
    host: {
      info(
        params: Record<string, never>,
      ): Promise<{ appVersion: string; language?: string }>;
    };
    history: {
      watch(): Promise<unknown>;
      onChanged(listener: () => void): () => void;
    };
  };
  load(): Promise<Session[]>;
  hydrate(date: string): Promise<void>;
  render(state: {
    language: UiLanguage;
    sessions: Session[];
    error?: string;
  }): void;
}
export async function startDailyBrief({
  client,
  load,
  hydrate,
  render,
}: BootstrapDependencies) {
  const info = await client.host.info({});
  if (!supportsDailyBriefHost(info.appVersion))
    throw new Error("今日简报需要 ViTalk 0.6.11 或更新版本");
  const language: UiLanguage = info.language === "en" ? "en" : "zh-CN";
  const date = new Date();
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  await hydrate(key);
  let active = true;
  let running = false;
  let pending = false;
  let sessions: Session[] = [];
  async function refresh() {
    if (!active) return;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      sessions = await load();
      if (active) render({ language, sessions });
    } catch (error) {
      if (active)
        render({
          language,
          sessions,
          error: error instanceof Error ? error.message : String(error),
        });
    } finally {
      running = false;
      if (pending && active) {
        pending = false;
        void refresh();
      }
    }
  }
  const unsubscribe = client.history.onChanged(() => {
    void refresh();
  });
  try {
    await client.history.watch();
    await refresh();
  } catch (error) {
    active = false;
    unsubscribe();
    throw error;
  }
  return () => {
    active = false;
    unsubscribe();
  };
}
