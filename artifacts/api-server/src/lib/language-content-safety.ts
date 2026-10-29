type LanguageContentLocation = {
  languageCode: string;
  level: string;
};

type LanguageContentLocationPatch = Partial<LanguageContentLocation>;

export function changesLanguageContentLocation(
  current: LanguageContentLocation,
  next: LanguageContentLocationPatch,
) {
  return (next.languageCode !== undefined && next.languageCode !== current.languageCode)
    || (next.level !== undefined && next.level !== current.level);
}

export function canChangeLanguageContentLocation(
  current: LanguageContentLocation,
  next: LanguageContentLocationPatch,
  hasReviewHistory: boolean,
) {
  return !hasReviewHistory || !changesLanguageContentLocation(current, next);
}
