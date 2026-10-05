import type { Session } from "@vilab/contracts";

export type DailyBriefFollowUpStatus = "pending" | "completed" | "dismissed";

export interface DailyBriefHighlight {
  createdAt: number;
  id: string;
  source: string;
  text: string;
}

export interface DailyBriefFollowUp extends DailyBriefHighlight {
  sourceSessionId?: string;
  sourceText?: string;
  status: DailyBriefFollowUpStatus;
}

export interface DailyBrief {
  dateKey: string;
  followUps: DailyBriefFollowUp[];
  highlights: DailyBriefHighlight[];
  sourceApps: string[];
  stats: {
    characterCount: number;
    durationMinutes: number;
    sessionCount: number;
  };
}

const commitmentPattern =
  /^(?:我(?:要|需要|明天|计划|准备)|记得|待办[：:]|(?:今天|明天|下午|上午|晚上|待会|稍后|之后)(?:我)?(?:需要|计划|准备|要)|I (?:need to|have to|plan to|will)|remember to)/i;
const completionPattern =
  /(?:不要|不用|不需要|已经|已完成|完成了|搞定|做完|结束|可能|考虑|取消|他说|她说|done|finished|completed|maybe|might|do not|don't)/i;

export function buildDailyBrief(
  sessions: readonly Session[],
  now = new Date(),
): DailyBrief {
  const relevantSessions = getRelevantSessions(sessions, now);

  const highlights = relevantSessions.slice(0, 4).map(({ session, text }) => ({
    createdAt: session.createdAt,
    id: session.id,
    source: session.sourceApp?.trim() || "ViTalk",
    text: truncateText(text, 140),
  }));

  const followUps = extractFollowUps(relevantSessions);
  const sourceApps = Array.from(
    new Set(
      relevantSessions
        .map(({ session }) => session.sourceApp?.trim())
        .filter((source): source is string => Boolean(source)),
    ),
  ).slice(0, 4);

  return {
    dateKey: toLocalDateKey(now),
    followUps,
    highlights,
    sourceApps,
    stats: {
      characterCount: relevantSessions.reduce(
        (total, entry) => total + entry.text.replace(/\s/g, "").length,
        0,
      ),
      durationMinutes: Math.round(
        relevantSessions.reduce(
          (total, entry) => total + Math.max(0, entry.session.durationMs),
          0,
        ) / 60_000,
      ),
      sessionCount: relevantSessions.length,
    },
  };
}

export function buildDailyBriefModelContext(
  sessions: readonly Session[],
  now = new Date(),
  maxCharacters = 60_000,
): string {
  const blocks = [...getRelevantSessions(sessions, now)]
    .reverse()
    .map(({ session, text }) => {
      const time = formatContextTime(session.createdAt);
      const source = session.sourceApp?.trim() || "ViTalk";
      return `[${time}] ${source}\n${text}`;
    });
  const boundedLimit = Math.max(0, Math.floor(maxCharacters));
  return blocks.join("\n\n").slice(0, boundedLimit).trim();
}

function getRelevantSessions(sessions: readonly Session[], now: Date) {
  return sessions
    .filter(
      (session) =>
        session.mode !== "english_expression" &&
        session.status === "completed" &&
        isSameLocalDay(new Date(session.createdAt), now),
    )
    .map((session) => ({ session, text: getSessionSummaryText(session) }))
    .filter((entry) => entry.text.length > 0)
    .sort((left, right) => right.session.createdAt - left.session.createdAt);
}

function extractFollowUps(
  entries: Array<{ session: Session; text: string }>,
): DailyBriefFollowUp[] {
  const seen = new Set<string>();
  const followUps: DailyBriefFollowUp[] = [];

  for (const { session, text } of entries) {
    const raw = session.rawTranscript?.trim() || session.diagnostics?.rawTranscript?.trim() || "";
    const originalCommitments = new Set(raw.split(/[。！？!?\n]+/)
      .map(normalizeSentence)
      .filter(value => value.length >= 4 && commitmentPattern.test(value) && !completionPattern.test(value)));
    for (const [sentenceIndex, sentence] of text
      .split(/[。！？!?\n]+/)
      .entries()) {
      const normalized = normalizeSentence(sentence);
      const dedupeKey = normalized.toLocaleLowerCase();
      if (
        !normalized ||
        normalized.length < 4 ||
        !commitmentPattern.test(normalized) ||
        completionPattern.test(normalized) ||
        !originalCommitments.has(normalized) ||
        seen.has(dedupeKey)
      ) {
        continue;
      }

      seen.add(dedupeKey);
      followUps.push({
        createdAt: session.createdAt,
        id: `${session.id}:${sentenceIndex}`,
        sourceSessionId: session.id,
        sourceText: normalized,
        source: session.sourceApp?.trim() || "ViTalk",
        status: "pending",
        text: truncateText(normalized, 90),
      });

      if (followUps.length >= 5) {
        return followUps;
      }
    }
  }

  return followUps;
}

function normalizeSentence(value: string): string {
  return value.trim().replace(/^[，,、\s]+|[，,、\s]+$/g, "");
}

function getSessionSummaryText(session: Session): string {
  return (
    session.displayText?.trim() ||
    session.finalText?.trim() ||
    session.rawTranscript?.trim() ||
    ""
  );
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toLocalDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatContextTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
