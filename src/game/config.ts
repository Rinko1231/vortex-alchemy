export interface RunConfig {
  startingTimeSec: number;
  gainTier2: number;
  gainTier3: number;
  gainTier4: number;
  gainGrail: number;
  chainStep: number;
  chainCap: number;
  tier1Weight: number;
  tier2Weight: number;
  wildcardWeight: number;
  reverseRotation: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_CONFIG: RunConfig = {
  startingTimeSec: 90,
  gainTier2: 2,
  gainTier3: 4,
  gainTier4: 7,
  gainGrail: 45,
  chainStep: 0.25,
  chainCap: 2.5,
  tier1Weight: 88,
  tier2Weight: 10,
  wildcardWeight: 2,
  reverseRotation: true,
  reducedMotion: false,
};

const CONFIG_STORAGE_KEY = "vortex-alchemy:config:v1";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeConfig(candidate: Partial<RunConfig>): RunConfig {
  return {
    startingTimeSec: clamp(asNumber(candidate.startingTimeSec, DEFAULT_CONFIG.startingTimeSec), 30, 300),
    gainTier2: clamp(asNumber(candidate.gainTier2, DEFAULT_CONFIG.gainTier2), 0, 10),
    gainTier3: clamp(asNumber(candidate.gainTier3, DEFAULT_CONFIG.gainTier3), 0, 20),
    gainTier4: clamp(asNumber(candidate.gainTier4, DEFAULT_CONFIG.gainTier4), 0, 30),
    gainGrail: clamp(asNumber(candidate.gainGrail, DEFAULT_CONFIG.gainGrail), 0, 120),
    chainStep: clamp(asNumber(candidate.chainStep, DEFAULT_CONFIG.chainStep), 0, 0.5),
    chainCap: clamp(asNumber(candidate.chainCap, DEFAULT_CONFIG.chainCap), 1, 5),
    tier1Weight: clamp(asNumber(candidate.tier1Weight, DEFAULT_CONFIG.tier1Weight), 0, 100),
    tier2Weight: clamp(asNumber(candidate.tier2Weight, DEFAULT_CONFIG.tier2Weight), 0, 100),
    wildcardWeight: clamp(asNumber(candidate.wildcardWeight, DEFAULT_CONFIG.wildcardWeight), 0, 100),
    reverseRotation:
      typeof candidate.reverseRotation === "boolean"
        ? candidate.reverseRotation
        : DEFAULT_CONFIG.reverseRotation,
    reducedMotion:
      typeof candidate.reducedMotion === "boolean"
        ? candidate.reducedMotion
        : DEFAULT_CONFIG.reducedMotion,
  };
}

export function loadConfig(): RunConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return normalizeConfig(JSON.parse(raw) as Partial<RunConfig>);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: RunConfig): RunConfig {
  const normalized = normalizeConfig(config);
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
  return normalized;
}

export function isDefaultConfig(config: RunConfig): boolean {
  const normalized = normalizeConfig(config);
  return (Object.keys(DEFAULT_CONFIG) as Array<keyof RunConfig>).every(
    (key) => normalized[key] === DEFAULT_CONFIG[key],
  );
}

