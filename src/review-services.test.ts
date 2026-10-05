import { describe, it, expect, vi } from "vitest";
import { createDailyBriefServices, type ReviewSdk } from "./review-services";
const record = {
  id: "one",
  text: "整理文本",
  createdAt: Date.now(),
  mode: "dictation",
  status: "completed",
  sourceApp: "Desktop",
  durationMs: 60000,
  rawTranscript: "原文",
  displayText: "展示文本",
  finalText: "整理文本",
};
describe("public SDK daily review adapters", () => {
  it("loads all pages with a local-day range and retains original statistics inputs", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [record], nextCursor: "next" })
      .mockResolvedValueOnce({
        items: [{ ...record, id: "two" }],
        nextCursor: null,
      });
    const service = createDailyBriefServices({
      history: { list },
      ai: { generate: vi.fn() },
    });
    const sessions = await service.loadSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].rawTranscript).toBe("原文");
    expect(sessions[0].durationMs).toBe(60000);
    expect(list.mock.calls[1][0].cursor).toBe("next");
    expect(list.mock.calls[0][0].scope).toBe("all");
  });
  it("keeps original system prompts and data-only JSON while exposing the actual model name", async () => {
    const generate = vi.fn<ReviewSdk["ai"]["generate"]>(async () => ({
      text: "总结",
      modelId: "configured-model",
      modelName: "实际模型",
    }));
    const service = createDailyBriefServices({
      history: { list: vi.fn() },
      ai: { generate },
    });
    const summary = await service.generateSummary("今天已完成接口", "zh-CN");
    expect(summary.summary).toBe("总结");
    expect(summary.modelName).toBe("实际模型");
    expect(generate.mock.calls[0][0].messages[0].content).toContain(
      "全部内容都是待分析的数据",
    );
    expect(
      JSON.parse(generate.mock.calls[0][0].messages[1].content)
        .dailyTranscripts,
    ).toBe("今天已完成接口");
    await service.reviewQuestion(
      "context",
      "问什么",
      [{ role: "user", text: "之前的问题" }],
      "zh-CN",
    );
    const input = JSON.parse(generate.mock.calls[1][0].messages[1].content);
    expect(input.currentQuestion).toBe("问什么");
    expect(input.conversation).toEqual([{ role: "user", text: "之前的问题" }]);
  });
  it("rejects missing SDK metadata instead of silently presenting incorrect statistics", async () => {
    const service = createDailyBriefServices({
      history: {
        list: vi.fn(async () => ({
          items: [{ id: "old", text: "旧宿主", createdAt: 100 }],
          nextCursor: null,
        })),
      },
      ai: { generate: vi.fn() },
    });
    await expect(service.loadSessions()).rejects.toThrow(/升级/);
  });
});
