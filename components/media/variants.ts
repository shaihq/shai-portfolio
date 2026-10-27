// Smaller copies of each video, in newer codecs, written by the encoder. Each was kept
// only if it scored VMAF 96 or more against the H.264 original and came out at least
// 12% smaller. LoopVideo picks AV1, else HEVC, else the original.
export const VARIANTS: Record<string, readonly ("av1" | "hevc")[]> = {
  "/projects/designfolio/solution-1a.mp4": ["av1", "hevc"],
  "/projects/designfolio/solution-3.mp4": ["av1", "hevc"],
  "/projects/mycaptain/goal-1b.mp4": ["av1", "hevc"],
  "/projects/quote-builder/solution-1-loop.mp4": ["av1", "hevc"],
  "/projects/quote-builder/solution-2-branding.mp4": ["av1", "hevc"],
  "/projects/quote-builder/solution-2-drag.mp4": ["av1", "hevc"],
  "/projects/quote-builder/solution-2-outline.mp4": ["av1", "hevc"],
  "/projects/quote-builder/solution-3-loop.mp4": ["av1", "hevc"],
  "/projects/quote-builder/thumb-loop.mp4": ["av1"],
  "/projects/sense/old-builder.mp4": ["av1", "hevc"],
  "/projects/sense/thumb-loop.mp4": ["av1", "hevc"],
  "/projects/sense/version-1.mp4": ["av1", "hevc"],
  "/projects/sense/version-2.mp4": ["av1"],
  "/projects/sense/version-3.mp4": ["av1", "hevc"],
};
