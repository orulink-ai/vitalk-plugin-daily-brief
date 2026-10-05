export type UiLanguage = "zh-CN" | "en";
export interface Session {
  id: string;
  createdAt: number;
  mode: string;
  sourceApp: string;
  durationMs: number;
  status: string;
  rawTranscript: string;
  displayText: string;
  finalText: string;
  diagnostics?: { rawTranscript?: string } | null;
}
export interface DailyBriefGenerationResult {
  summary: string;
  modelId: string;
  modelName: string;
  durationMs: number;
}
export interface DailyBriefReviewResult {
  answer: string;
  modelId: string;
  modelName: string;
  durationMs: number;
}
export interface DailyBriefConversationMessage {
  role: "assistant" | "user";
  text: string;
}
