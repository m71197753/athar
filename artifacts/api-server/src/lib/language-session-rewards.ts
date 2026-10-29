export type RewardAnswer = {
  contentId: string;
  mode: string;
  isCorrect: boolean;
};

type StoredRewardSession = {
  answers: RewardAnswer[];
};

type GameRewardRules = {
  baseXp: number;
  accuracyBonusXp: number;
  reviewBonusXp: number;
};

export function getUtcRewardDayStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function collectRewardedContentIds(sessions: StoredRewardSession[]) {
  return new Set(
    sessions.flatMap(session => session.answers)
      .filter(answer => answer.isCorrect && answer.mode !== "pronunciation")
      .map(answer => answer.contentId),
  );
}

export function calculateLanguageSessionRewards(input: {
  answers: RewardAnswer[];
  rewardedContentIds: Set<string>;
  dueContentIds: Set<string>;
  sessionKind: "lesson" | "review";
  rules: GameRewardRules;
}) {
  const freshAnswers = input.answers.filter(
    answer => !input.rewardedContentIds.has(answer.contentId),
  );
  const gradedAnswers = freshAnswers.filter(answer => answer.mode !== "pronunciation");
  const correctCount = gradedAnswers.filter(answer => answer.isCorrect).length;
  const baseXp = input.answers.length
    ? Math.floor(input.rules.baseXp * correctCount / input.answers.length)
    : 0;
  const accuracyQualified = gradedAnswers.length >= 10
    && correctCount / gradedAnswers.length >= 0.9;
  const freshCorrectDueCount = gradedAnswers.filter(
    answer => answer.isCorrect && input.dueContentIds.has(answer.contentId),
  ).length;
  const reviewQualified = input.sessionKind === "review" && freshCorrectDueCount >= 10;

  return {
    freshQuestionCount: freshAnswers.length,
    xpEarned: baseXp
      + (accuracyQualified ? input.rules.accuracyBonusXp : 0)
      + (reviewQualified ? input.rules.reviewBonusXp : 0),
    reviewQualified,
  };
}
