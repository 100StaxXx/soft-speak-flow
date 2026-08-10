export type EvolutionShareVideoTemplate = "aesthetic-reveal";

export interface RenderEvolutionShareVideoOptions {
  sourceVideoUrl: string;
  posterImageUrl?: string | null;
  stage: number;
  companionName?: string | null;
  template: EvolutionShareVideoTemplate;
}

export interface RenderEvolutionShareVideoResult {
  uri: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number;
}

export interface EvolutionShareVideoPluginInterface {
  renderEvolutionShareVideo(
    options: RenderEvolutionShareVideoOptions,
  ): Promise<RenderEvolutionShareVideoResult>;
}
