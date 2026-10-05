import { createPluginClient, createWindowTransport } from "@vitalk/plugin-sdk";
declare global {
  interface Window {
    __VITALK_PLUGIN_TOKEN__?: string;
  }
}
let client: ReturnType<typeof createPluginClient> | undefined;
export function getPluginClient() {
  return (client ??= createPluginClient(
    createWindowTransport(window.__VITALK_PLUGIN_TOKEN__ ?? ""),
  ));
}
export function disposePlugin() {
  client?.dispose();
  client = undefined;
}
