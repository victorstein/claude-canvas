/**
 * Agent Monitor Scenario Definition
 *
 * Defines the "monitor" scenario for the agent-monitor canvas.
 */

import type { ScenarioDefinition } from "../types";
import type { AgentMonitorConfig } from "../../canvases/agent-monitor/types";

export const agentMonitorScenario: ScenarioDefinition<
  AgentMonitorConfig,
  void
> = {
  name: "monitor",
  description: "Real-time sub-agent activity monitor with tabbed interface",
  canvasKind: "agent-monitor",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    parentSessionId: "",
    agents: {},
  },
};

export default agentMonitorScenario;
