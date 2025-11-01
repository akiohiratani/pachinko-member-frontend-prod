export const SLOT_MACHINE_CONFIG = {
  reelCount: 3,
  baseSpinMs: 2400,
  reelDelayMs: 300,
  easing: "cubic-bezier(0.17,0.67,0.23,1.03)",
  winProbability: 0.2,
  minTotalSpinMs: 5000,
  maxTotalSpinMs: 10000,
  winStartSoundProbability: 0.6,
} as const;

export type SlotMachineConfig = typeof SLOT_MACHINE_CONFIG;
