import { Router, type IRouter } from "express";
import {
  GetLanguageGamificationQueryParams,
  GetLanguageGamificationResponse,
  PurchaseLanguageStreakFreezeBody,
  PurchaseLanguageStreakFreezeResponse,
  UpdateLanguageGamificationSettingsBody,
  UpdateLanguageGamificationSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getLanguageAdminSettings } from "../lib/language-admin-settings";
import {
  getLanguageGamificationSummary,
  purchaseLanguageStreakFreeze,
  updateLanguageGamificationSettings,
} from "./language-gamification";

const router: IRouter = Router();

router.get("/languages/gamification", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = GetLanguageGamificationQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page } = await getLanguageAdminSettings();
  if (!page.enabledLanguages.includes(parsed.data.languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  const summary = await getLanguageGamificationSummary(
    res.locals.userId as string,
    parsed.data.languageCode,
  );
  res.json(GetLanguageGamificationResponse.parse(summary));
});

router.patch("/languages/gamification/settings", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = UpdateLanguageGamificationSettingsBody.safeParse(req.body);
  if (!parsed.success || (
    parsed.data.soundEnabled === undefined &&
    parsed.data.vibrationEnabled === undefined
  )) {
    res.status(400).json({ error: "At least one valid preference is required." });
    return;
  }
  const { page } = await getLanguageAdminSettings();
  if (!page.enabledLanguages.includes(parsed.data.languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  await updateLanguageGamificationSettings(
    res.locals.userId as string,
    parsed.data.languageCode,
    parsed.data,
  );
  const summary = await getLanguageGamificationSummary(
    res.locals.userId as string,
    parsed.data.languageCode,
  );
  res.json(UpdateLanguageGamificationSettingsResponse.parse(summary.profile));
});

router.post("/languages/gamification/freeze", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = PurchaseLanguageStreakFreezeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page } = await getLanguageAdminSettings();
  if (!page.enabledLanguages.includes(parsed.data.languageCode)) {
    res.status(403).json({ error: "هذه اللغة غير متاحة حاليًا." });
    return;
  }
  const result = await purchaseLanguageStreakFreeze(
    res.locals.userId as string,
    parsed.data.languageCode,
  );
  if ("error" in result) {
    res.status(400).json({
      error: result.error === "not-enough-gems"
        ? "لا تكفي الجواهر لشراء حماية السلسلة."
        : "وصلت إلى الحد الأقصى من وسائل حماية السلسلة.",
    });
    return;
  }
  const summary = await getLanguageGamificationSummary(
    res.locals.userId as string,
    parsed.data.languageCode,
  );
  res.json(PurchaseLanguageStreakFreezeResponse.parse(summary.profile));
});

export default router;
