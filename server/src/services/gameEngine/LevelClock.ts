import { GAME_CONFIG, BLIND_SCHEDULE } from '../../../../shared/constants/gameConfig';

/** Tracks the blind level and rebuy window from a (test-overridable) clock. */
export class LevelClock {
  private startedAt: number | null = null;
  private readonly levelMs: number;

  constructor(levelMinutes: number | undefined, private now: () => number) {
    this.levelMs = (levelMinutes ?? GAME_CONFIG.DEFAULT_LEVEL_MINUTES) * 60 * 1000;
  }

  // The clock starts with the first hand and keeps running afterwards
  start(): void {
    if (this.startedAt === null) this.startedAt = this.now();
  }

  currentLevel(): number {
    if (this.startedAt === null) return 1;
    return Math.floor((this.now() - this.startedAt) / this.levelMs) + 1;
  }

  isRebuyOpen(): boolean {
    return this.currentLevel() <= GAME_CONFIG.REBUY_LEVELS;
  }

  snapshot(): { levelEndsAt: number; serverTime: number; rebuyOpen: boolean } {
    const now = this.now();
    const startedAt = this.startedAt ?? now;
    return {
      levelEndsAt: startedAt + this.currentLevel() * this.levelMs,
      serverTime: now,
      rebuyOpen: this.isRebuyOpen()
    };
  }

  // Blinds double every level past the end of the schedule
  static blindsForLevel(base: number, level: number): number {
    const last = BLIND_SCHEDULE.length;
    const multiplier = BLIND_SCHEDULE[Math.min(level, last) - 1] * 2 ** Math.max(0, level - last);
    return Math.round(base * multiplier);
  }
}
