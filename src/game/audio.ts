export interface AudioSettings {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  musicVolume: 0.6,
  sfxVolume: 0.8,
};

const AUDIO_STORAGE_KEY = "vortex-alchemy:audio:v1";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeAudioSettings(
  candidate: Partial<AudioSettings>,
): AudioSettings {
  return {
    muted:
      typeof candidate.muted === "boolean"
        ? candidate.muted
        : DEFAULT_AUDIO_SETTINGS.muted,
    musicVolume: clamp(
      typeof candidate.musicVolume === "number"
        ? candidate.musicVolume
        : DEFAULT_AUDIO_SETTINGS.musicVolume,
      0,
      1,
    ),
    sfxVolume: clamp(
      typeof candidate.sfxVolume === "number"
        ? candidate.sfxVolume
        : DEFAULT_AUDIO_SETTINGS.sfxVolume,
      0,
      1,
    ),
  };
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    return normalizeAudioSettings(JSON.parse(raw) as Partial<AudioSettings>);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): AudioSettings {
  const normalized = normalizeAudioSettings(settings);
  try {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
  return normalized;
}
