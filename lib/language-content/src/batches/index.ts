import type { LanguageContentItem } from "../sample-a1.ts";
import batch1 from "./en-a1-batch-001.json" with { type: "json" };
import batch2 from "./en-a1-batch-002.json" with { type: "json" };
import batch3 from "./en-a1-batch-003.json" with { type: "json" };

export const generatedEnglishBatches: LanguageContentItem[] = [
  ...(batch1 as unknown as LanguageContentItem[]),
  ...(batch2 as unknown as LanguageContentItem[]),
  ...(batch3 as unknown as LanguageContentItem[]),
];
