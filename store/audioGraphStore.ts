import { AudioGraph } from "../audio/AudioGraph";

/**
 * Global Map shared between the audio engine and UI components.
 * Allows real‑time parameter updates without waiting for the engine loop.
 */
export const graphStore = new Map<string, AudioGraph>();
