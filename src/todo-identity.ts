import type { DailyBriefFollowUp } from "./daily-brief";
import type { SharedTaskRecord } from "./shared-tasks";

// Full source text, never the truncated display label, determines identity.
// Ambiguous / absent records cannot accidentally update an unrelated positional ID.
export function resolveTodoIdentity(
  item: DailyBriefFollowUp,
  records: SharedTaskRecord[],
): string {
  const matches = records.filter(
    (record) =>
      record.kind === "todo" &&
      record.id.startsWith("todo:") &&
      item.sourceSessionId &&
      item.sourceText &&
      record.sourceSessionId === item.sourceSessionId &&
      (record.sourceText || record.content) === item.sourceText,
  );
  return matches.length === 1 ? matches[0].id.slice(5) : `unbound:${item.id}`;
}
