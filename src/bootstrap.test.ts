import { it, expect, vi } from "vitest";
import { startDailyBrief } from "./bootstrap";
it("hydrates before showing the page, refreshes from history events and retires on close", async () => {
  let event = () => {};
  const unsubscribe = vi.fn();
  const render = vi.fn();
  const client = {
    host: {
      info: vi.fn(async () => ({ appVersion: "0.6.11", language: "en" })),
    },
    history: {
      watch: vi.fn(async () => ({ ok: true })),
      onChanged: vi.fn((fn) => {
        event = fn;
        return unsubscribe;
      }),
    },
  };
  const load = vi.fn(async () => []);
  const hydrate = vi.fn(async () => {});
  const close = await startDailyBrief({ client, load, hydrate, render });
  expect(hydrate).toHaveBeenCalledOnce();
  expect(render).toHaveBeenLastCalledWith({ language: "en", sessions: [] });
  event();
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  close();
  event();
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(2);
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it("rejects old hosts before reading data", async () => {
  const load = vi.fn();
  await expect(
    startDailyBrief({
      client: {
        host: { info: async () => ({ appVersion: "0.6.10" }) },
        history: { watch: vi.fn(), onChanged: vi.fn() },
      },
      load,
      hydrate: vi.fn(),
      render: vi.fn(),
    }),
  ).rejects.toThrow("0.6.11");
  expect(load).not.toHaveBeenCalled();
});
