import type {
  GenerateParams,
  HistoryListParams,
  Protocol,
  RequestOptions,
} from "@vitalk/plugin-sdk";
import type {
  Session,
  UiLanguage,
  DailyBriefConversationMessage,
  DailyBriefGenerationResult,
  DailyBriefReviewResult,
} from "./types";
import { prompts } from "./prompts";
export interface ReviewSdk {
  history: {
    list(
      params: HistoryListParams,
    ): Promise<Protocol["history.list"]["result"]>;
  };
  ai: {
    generate(
      params: GenerateParams,
      options?: RequestOptions,
    ): Promise<Protocol["ai.generate"]["result"]>;
  };
}
export function createDailyBriefServices(client: ReviewSdk) {
  async function run(prompt: string, input: unknown) {
    const started = Date.now();
    const result = await client.ai.generate(
      {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(input) },
        ],
      },
      { timeoutMs: 100_000 },
    );
    if (!result.text.trim()) throw new Error("模型返回了空内容，请重试");
    if (!result.modelId || !result.modelName)
      throw new Error("宿主未提供模型信息，请升级 ViTalk");
    return {
      text: result.text.trim(),
      modelId: result.modelId,
      modelName: result.modelName,
      durationMs: Date.now() - started,
    };
  }
  return {
    async loadSessions(): Promise<Session[]> {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const sessions: Session[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      for (let page = 0; page < 20; page++) {
        const result = await client.history.list({
          scope: "all",
          from: start.getTime(),
          to: end.getTime(),
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        for (const item of result.items) {
          if (
            typeof item.status !== "string" ||
            typeof item.mode !== "string" ||
            typeof item.sourceApp !== "string" ||
            typeof item.durationMs !== "number" ||
            !Number.isFinite(item.durationMs) ||
            typeof item.rawTranscript !== "string" ||
            typeof item.displayText !== "string" ||
            typeof item.finalText !== "string"
          )
            throw new Error("宿主未提供完整历史信息，请升级 ViTalk");
          sessions.push({
            id: item.id,
            createdAt: item.createdAt,
            mode: item.mode,
            status: item.status,
            sourceApp: item.sourceApp,
            durationMs: item.durationMs,
            rawTranscript: item.rawTranscript,
            displayText: item.displayText,
            finalText: item.finalText,
          });
        }
        if (!result.nextCursor) return sessions;
        if (seen.has(result.nextCursor))
          throw new Error("历史分页游标重复，请重新加载");
        seen.add(result.nextCursor);
        cursor = result.nextCursor;
      }
      throw new Error("当天历史超过插件读取上限，未显示不完整统计");
    },
    async generateSummary(
      content: string,
      language: UiLanguage,
    ): Promise<DailyBriefGenerationResult> {
      const result = await run(prompts.summary[language], {
        dailyTranscripts: content.slice(0, 60_000),
      });
      return {
        summary: result.text,
        modelId: result.modelId,
        modelName: result.modelName,
        durationMs: result.durationMs,
      };
    },
    async reviewQuestion(
      context: string,
      question: string,
      conversation: DailyBriefConversationMessage[],
      language: UiLanguage,
    ): Promise<DailyBriefReviewResult> {
      const result = await run(prompts.review[language], {
        reviewContext: context.slice(0, 60_000),
        conversation: conversation
          .slice(-12)
          .map((message) => ({
            ...message,
            text: message.text.slice(0, 4000),
          })),
        currentQuestion: question.trim().slice(0, 4000),
      });
      return {
        answer: result.text,
        modelId: result.modelId,
        modelName: result.modelName,
        durationMs: result.durationMs,
      };
    },
  };
}
