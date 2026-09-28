import {REFERRAL_MESSAGE, SAFETY_QUESTIONS, assessEligibility, type SafetyAnswers} from '../eligibility';

const safe: SafetyAnswers = Object.fromEntries(SAFETY_QUESTIONS.map(q => [q.id, q.safeAnswer])) as SafetyAnswers;

describe('safety / eligibility questionnaire (PRD §9)', () => {
  it('asks exactly the seven PRD questions', () => {
    expect(SAFETY_QUESTIONS.map(q => q.id)).toEqual([
      'adult', 'sudden_change', 'asymmetric', 'pain_or_drainage', 'vertigo', 'one_sided_tinnitus', 'earwax',
    ]);
  });

  it('is eligible only when every answer is the safe one', () => {
    expect(assessEligibility(safe)).toEqual({kind: 'eligible'});
  });

  it.each(SAFETY_QUESTIONS.map(q => [q.id, q]))('any single red flag (%s) stops self-fitting and refers', (_id, q) => {
    const r = assessEligibility({...safe, [q.id]: !q.safeAnswer});
    expect(r).toMatchObject({kind: 'refer', reasons: [q.id], message: REFERRAL_MESSAGE, requiresAcknowledgement: true});
    expect(r.kind === 'refer' && r.options).toEqual(['find_professional', 'save_for_later', 'exit']);
  });

  it('collects every red flag, in question order', () => {
    const r = assessEligibility({...safe, vertigo: true, adult: false});
    expect(r.kind === 'refer' && r.reasons).toEqual(['adult', 'vertigo']);
  });

  it('marks sudden change as urgent', () => {
    const r = assessEligibility({...safe, sudden_change: true});
    expect(r.kind === 'refer' && r.urgent).toBe(true);
    const notUrgent = assessEligibility({...safe, earwax: true});
    expect(notUrgent.kind === 'refer' && notUrgent.urgent).toBe(false);
  });

  it('treats unanswered questions as not eligible (never as a pass)', () => {
    const partial: SafetyAnswers = {...safe};
    delete partial.vertigo;
    expect(assessEligibility(partial)).toEqual({kind: 'incomplete', missing: ['vertigo']});
    expect(assessEligibility({})).toMatchObject({kind: 'incomplete'});
  });

  it('a red flag wins over missing answers', () => {
    expect(assessEligibility({sudden_change: true}).kind).toBe('refer');
  });

  it('uses the PRD referral copy', () => {
    expect(REFERRAL_MESSAGE).toBe(
      'A professional hearing evaluation is recommended before using personalized amplification.',
    );
  });
});
