import { describe, expect, it } from "vitest";
import type { Session } from "./types";
import { buildDailyBrief, buildDailyBriefModelContext } from "./daily-brief";

function session(
  overrides: Partial<Session> & Pick<Session, "id" | "createdAt">,
): Session {
  return {
    mode: "dictation",
    sourceApp: "Unknown app",
    rawTranscript: "",
    finalText: "",
    displayText: "",
    activeOutputId: null,
    outputs: [],
    durationMs: 0,
    status: "completed",
    diagnostics: null,
    ...overrides,
  } as Session;
}

describe("buildDailyBrief", () => {
  const now = new Date(2026, 7, 30, 21, 0, 0);

  it("excludes English practice from statistics and model context", () => {
    const records = [
      session({
        id: "english",
        createdAt: now.getTime(),
        mode: "english_expression",
        displayText: "I need to buy groceries tomorrow.",
        durationMs: 60_000,
      }),
    ];
    const brief = buildDailyBrief(records, now);
    expect(brief.stats.sessionCount).toBe(0);
    expect(brief.highlights).toEqual([]);
    expect(brief.followUps).toEqual([]);
    expect(buildDailyBriefModelContext(records, now)).toBe("");
  });

  it("only summarizes successful sessions from the selected local day", () => {
    const brief = buildDailyBrief(
      [
        session({
          id: "today-1",
          createdAt: new Date(2026, 7, 30, 9, 0, 0).getTime(),
          displayText: "上午梳理了今日简报的基本范围。",
          durationMs: 60_000,
          sourceApp: "Notion",
        }),
        session({
          id: "yesterday",
          createdAt: new Date(2026, 7, 29, 23, 59, 0).getTime(),
          displayText: "这条内容不应进入今天的简报。",
        }),
        session({
          id: "failed",
          createdAt: new Date(2026, 7, 30, 10, 0, 0).getTime(),
          displayText: "provider error",
          status: "error",
        }),
      ],
      now,
    );

    expect(brief.stats.sessionCount).toBe(1);
    expect(brief.stats.durationMinutes).toBe(1);
    expect(brief.stats.characterCount).toBe(15);
    expect(brief.highlights).toHaveLength(1);
    expect(brief.highlights[0]?.source).toBe("Notion");
  });

  it("extracts unconfirmed commitments without claiming they are unfinished", () => {
    const brief = buildDailyBrief(
      [
        session({
          id: "commitment",
          createdAt: new Date(2026, 7, 30, 14, 20, 0).getTime(),
          rawTranscript:
            "下午需要把新版本发给老王。发布说明已经整理完成。明天计划复盘数据。",
          displayText:
            "下午需要把新版本发给老王。发布说明已经整理完成。明天计划复盘数据。",
        }),
      ],
      now,
    );

    expect(brief.followUps.map((item) => item.text)).toEqual([
      "下午需要把新版本发给老王",
      "明天计划复盘数据",
    ]);
    expect(brief.followUps.every((item) => item.status === "pending")).toBe(
      true,
    );
  });

  it("returns a useful empty brief when there is no speech today", () => {
    const brief = buildDailyBrief([], now);

    expect(brief.stats.sessionCount).toBe(0);
    expect(brief.highlights).toEqual([]);
    expect(brief.followUps).toEqual([]);
    expect(brief.sourceApps).toEqual([]);
  });

  it("builds bounded model context from today without including older sessions", () => {
    const context = buildDailyBriefModelContext(
      [
        session({
          id: "today-context",
          createdAt: new Date(2026, 7, 30, 14, 20, 0).getTime(),
          displayText: "今天讨论了总结功能。",
          sourceApp: "Figma",
        }),
        session({
          id: "old-context",
          createdAt: new Date(2026, 7, 29, 14, 20, 0).getTime(),
          displayText: "昨天的内容不应发送给模型。",
        }),
      ],
      now,
    );

    expect(context).toContain("[14:20] Figma");
    expect(context).toContain("今天讨论了总结功能。");
    expect(context).not.toContain("昨天的内容");
  });
});

describe("follow-up intent boundaries", () => {
  it("does not turn tentative, negative or third-party statements into my todos", () => {
    const now = new Date();
    const brief = buildDailyBrief(
      [
        session({
          id: "boundary",
          createdAt: now.getTime(),
          rawTranscript:
            "可能明天需要考虑改版。不要提交这个报告。老王需要准备资料。他计划明天发布。我要提交最终报告。",
          displayText:
            "可能明天需要考虑改版。不要提交这个报告。老王需要准备资料。他计划明天发布。我要提交最终报告。",
        }),
      ],
      now,
    );
    expect(brief.followUps.map((item) => item.text)).toEqual([
      "我要提交最终报告",
    ]);
  });
});

describe("follow-up source fidelity", () => {
  it("rejects generated commitments, missing originals and reported speech", () => {
    const now = new Date();
    for (const rawTranscript of ["先讨论是否要发报告", "", "他说我要发报告"]) {
      const brief = buildDailyBrief(
        [
          session({
            id: "source",
            createdAt: now.getTime(),
            rawTranscript,
            displayText: "我要发报告",
          }),
        ],
        now,
      );
      expect(brief.followUps).toEqual([]);
    }
  });
  it("preserves the existing display sentence id when original speech proves it", () => {
    const now = new Date();
    const brief = buildDailyBrief(
      [
        session({
          id: "source",
          createdAt: now.getTime(),
          rawTranscript: "我明天发送报告。",
          displayText: "收到。 我明天发送报告。",
        }),
      ],
      now,
    );
    expect(brief.followUps.map((item) => [item.id, item.text])).toEqual([
      ["source:1", "我明天发送报告"],
    ]);
  });
});
