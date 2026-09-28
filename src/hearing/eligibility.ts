// Safety / eligibility questionnaire (PRD §9, ENGINEERING_SKILL rule 10).
// Any red flag stops the self-fitting flow and routes to professional referral.
// Unanswered questions never count as a pass.

export const SAFETY_QUESTIONS = [
  {id: 'adult', text: 'Are you 18 or older?', safeAnswer: true},
  {id: 'sudden_change', text: 'Has your hearing changed suddenly or rapidly?', safeAnswer: false},
  {id: 'asymmetric', text: 'Is one ear noticeably worse than the other?', safeAnswer: false},
  {id: 'pain_or_drainage', text: 'Do you have significant ear pain or drainage?', safeAnswer: false},
  {id: 'vertigo', text: 'Do you have severe dizziness or vertigo?', safeAnswer: false},
  {id: 'one_sided_tinnitus', text: 'Do you have persistent ringing mainly in one ear?', safeAnswer: false},
  {id: 'earwax', text: 'Do you suspect significant earwax blockage?', safeAnswer: false},
] as const;

export type SafetyQuestionId = (typeof SAFETY_QUESTIONS)[number]['id'];
export type SafetyAnswers = Partial<Record<SafetyQuestionId, boolean>>;

export const REFERRAL_MESSAGE =
  'A professional hearing evaluation is recommended before using personalized amplification.';
/** Extra line for sudden change: sudden hearing loss is time-critical (OPEN_QUESTIONS Q7). */
export const URGENT_MESSAGE = 'If your hearing changed suddenly, please seek medical care as soon as possible.';

export type EligibilityResult =
  | {kind: 'eligible'}
  | {kind: 'incomplete'; missing: SafetyQuestionId[]}
  | {
      kind: 'refer';
      reasons: SafetyQuestionId[];
      urgent: boolean;
      message: typeof REFERRAL_MESSAGE;
      /** UI must require an explicit tap to acknowledge; never auto-dismiss (PRD §46 UX). */
      requiresAcknowledgement: true;
      options: ['find_professional', 'save_for_later', 'exit'];
    };

export function assessEligibility(answers: SafetyAnswers): EligibilityResult {
  const reasons = SAFETY_QUESTIONS.filter(q => typeof answers[q.id] === 'boolean' && answers[q.id] !== q.safeAnswer).map(q => q.id);
  if (reasons.length) {
    return {
      kind: 'refer',
      reasons,
      urgent: reasons.includes('sudden_change'),
      message: REFERRAL_MESSAGE,
      requiresAcknowledgement: true,
      options: ['find_professional', 'save_for_later', 'exit'],
    };
  }
  const missing = SAFETY_QUESTIONS.filter(q => typeof answers[q.id] !== 'boolean').map(q => q.id);
  return missing.length ? {kind: 'incomplete', missing} : {kind: 'eligible'};
}
