import { WebPlugin } from "@capacitor/core";
import { PRODUCT_RUNTIME } from "@/config/productRuntime";

import type {
  EvolutionShareVideoPluginInterface,
  RenderEvolutionShareVideoOptions,
  RenderEvolutionShareVideoResult,
} from "./EvolutionShareVideoPlugin";

export class EvolutionShareVideoWeb
  extends WebPlugin
  implements EvolutionShareVideoPluginInterface
{
  async renderEvolutionShareVideo(
    options: RenderEvolutionShareVideoOptions,
  ): Promise<RenderEvolutionShareVideoResult> {
    if (!options.sourceVideoUrl) {
      throw new Error("sourceVideoUrl is required");
    }

    return {
      uri: options.sourceVideoUrl,
      filename: `${PRODUCT_RUNTIME.authProductMode}-evolution-stage-${options.stage}.mp4`,
      mimeType: "video/mp4",
      width: 1080,
      height: 1920,
      durationMs: 0,
    };
  }
}
