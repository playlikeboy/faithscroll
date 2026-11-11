/** One passage to read on a plan day. Without verses it is the whole chapter. */
export interface PlanReading {
  bookId: number;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}

export interface PlanDay {
  /** 1-based day number. */
  day: number;
  /** Optional theme for curated plans (e.g. "Remembering his benefits"). */
  theme?: string;
  readings: readonly PlanReading[];
}

export interface ReadingPlan {
  id: string;
  title: string;
  /** Short line under the title, e.g. "21 days · one chapter a day". */
  summary: string;
  description: string;
  days: readonly PlanDay[];
}
