import { createRoot } from "react-dom/client";
import { DailyBriefPage } from "./DailyBrief";
import { getPluginClient, disposePlugin } from "./client";
import { createDailyBriefServices } from "./review-services";
import { hydrateFollowUpStatuses } from "./status-store";
import { startDailyBrief } from "./bootstrap";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
const client = getPluginClient();
const services = createDailyBriefServices(client);
let close: undefined | (() => void);
let disposed = false;
root.render(<p role="status">正在加载今日简报…</p>);
void startDailyBrief({
  client,
  load: services.loadSessions,
  hydrate: hydrateFollowUpStatuses,
  render: (state) => {
    document.documentElement.lang = state.language;
    root.render(
      <>
        {state.error && <p role="alert">{state.error}</p>}
        <DailyBriefPage
          language={state.language}
          sessions={state.sessions}
          onGenerate={services.generateSummary}
          onReview={services.reviewQuestion}
          onBack={() => {
            void client.host
              .navigateHome()
              .catch((error) =>
                root.render(<p role="alert">{error.message}</p>),
              );
          }}
        />
      </>,
    );
  },
})
  .then((cleanup) => {
    if (disposed) cleanup();
    else close = cleanup;
  })
  .catch((error) => {
    if (!disposed)
      root.render(
        <p role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>,
      );
  });
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    close?.();
    root.unmount();
    disposePlugin();
  },
  { once: true },
);
