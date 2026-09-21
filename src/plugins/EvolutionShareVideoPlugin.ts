import { registerPlugin } from "@capacitor/core";
import type { EvolutionShareVideoPluginInterface } from "./EvolutionShareVideoTypes";

export type {
  EvolutionShareVideoPluginInterface,
  EvolutionShareVideoTemplate,
  RenderEvolutionShareVideoOptions,
  RenderEvolutionShareVideoResult,
} from "./EvolutionShareVideoTypes";

export const EvolutionShareVideo =
  registerPlugin<EvolutionShareVideoPluginInterface>("EvolutionShareVideo", {
    web: () =>
      import("./EvolutionShareVideoWeb").then(
        (module) => new module.EvolutionShareVideoWeb(),
      ),
  });
