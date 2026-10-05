// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { DailyBriefPage } from "./DailyBrief";
import type { Session } from "./types";
const host = vi.hoisted(() => ({
  tasks: {
    list: vi.fn(),
    setStatus: vi.fn(),
    watch: vi.fn(async () => ({ ok: true })),
    onChanged: vi.fn(() => () => {}),
  },
}));
vi.mock("./client", () => ({ getPluginClient: () => host }));
vi.mock("./status-store", () => ({
  readFollowUpStatuses: () => ({}),
  persistFollowUpStatuses: vi.fn(),
  subscribePersistenceErrors: () => () => {},
}));
const session: Session = {
  id: "session-1",
  createdAt: Date.now(),
  mode: "dictation",
  sourceApp: "Desktop",
  durationMs: 60000,
  status: "completed",
  rawTranscript: "我需要确认发布结果。",
  finalText: "我需要确认发布结果。",
  displayText: "我需要确认发布结果。",
};
const task = {
  id: "todo:session-1:0",
  content: "我需要确认发布结果",
  sourceText: "我需要确认发布结果",
  sourceSessionId: "session-1",
  status: "active",
  updatedAt: 100,
};
beforeEach(() => {
  host.tasks.list.mockResolvedValue({ items: [task] });
  host.tasks.setStatus.mockResolvedValue({
    items: [{ ...task, status: "completed" }],
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("preserves original cover, statistics, highlights, task status sync and follow-up review", async () => {
  const onGenerate = vi.fn(async () => ({
    summary: "今天已梳理发布流程。",
    modelId: "configured",
    modelName: "Configured Model",
    durationMs: 10,
  }));
  const onReview = vi.fn(async () => ({
    answer: "根据当天记录，发布还需要验证。",
    modelId: "configured",
    modelName: "Configured Model",
    durationMs: 10,
  }));
  const onBack = vi.fn();
  const view = render(
    <DailyBriefPage
      language="zh-CN"
      sessions={[session]}
      onGenerate={onGenerate}
      onReview={onReview}
      onBack={onBack}
    />,
  );
  await screen.findByText("今天已梳理发布流程。");
  expect(view.container.querySelector(".daily-brief-cover")).toBeTruthy();
  expect(view.container.querySelector(".daily-brief-stats")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "今日重点" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "待确认事项" })).toBeTruthy();
  await waitFor(() => expect(host.tasks.list).toHaveBeenCalled());
  fireEvent.click(
    screen.getByRole("button", { name: "将“我需要确认发布结果”标记为已完成" }),
  );
  await waitFor(() =>
    expect(host.tasks.setStatus).toHaveBeenCalledWith({
      id: "todo:session-1:0",
      status: "completed",
    }),
  );
  await screen.findByText("已完成");
  fireEvent.change(screen.getByRole("textbox", { name: "向每日助理提问" }), {
    target: { value: "发布完成了吗？" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
  await screen.findByText("根据当天记录，发布还需要验证。");
  expect(onReview).toHaveBeenCalledWith(
    expect.any(String),
    "发布完成了吗？",
    [],
    "zh-CN",
  );
  fireEvent.change(screen.getByRole("textbox", { name: "向每日助理提问" }), {
    target: { value: "接下来呢？" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
  await waitFor(() => expect(onReview).toHaveBeenCalledTimes(2));
  expect(onReview).toHaveBeenLastCalledWith(
    expect.any(String),
    "接下来呢？",
    [
      { role: "user", text: "发布完成了吗？" },
      { role: "assistant", text: "根据当天记录，发布还需要验证。" },
    ],
    "zh-CN",
  );
  fireEvent.click(screen.getByRole("button", { name: "重新生成总结" }));
  await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
  expect(onBack).toHaveBeenCalledOnce();
});
