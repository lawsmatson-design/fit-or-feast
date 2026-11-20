/* Fit or Feast — global game config. Safe to load from file:// */
window.GAME_CONFIG = {
  TITLE: "Fit or Feast",
  SAVE_KEY: "fitOrFeast.save.v1",
  STARTING_COINS: 1000,
  PULL_COST: 100,
  PULL10_COUNT: 10,
  PULL10_COST: 900,
  WORK_PAY: 100,
  WORK_COOLDOWN_MS: 2000,
  DUPLICATE_PAYOUT: 200,
  FAT_WEIGHT_MULT: 1.15,
  FAT_STAGES: 5,
  FIT1_FITNESS: 10,
  FIT2_FITNESS: 24,
  MIN_WEIGHT_RATIO: 0.85,
  ODDS: {
    character: 0.04,
    food: 0.72,
    workout: 0.20,
    reroll: 0.04
  },
  STAGE_LABELS: {
    base: "Base",
    fit1: "Toned",
    fit2: "Athletic",
    fat1: "Soft",
    fat2: "Chubby",
    fat3: "Plump",
    fat4: "Heavy",
    fat5: "Very Heavy"
  },
  STAGE_ORDER: ["base", "fit1", "fit2", "fat1", "fat2", "fat3", "fat4", "fat5"]
};
