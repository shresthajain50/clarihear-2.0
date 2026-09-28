import {DIN_PROTOCOL, DinScreeningEngine, SCREENING_DISCLAIMER} from '../din';

const NOW = () => new Date('2026-09-28T10:00:00Z');

/** Drive a full test, answering with `answer(trialIndex, triplet)`. */
async function runAll(seed: number, answer: (i: number, triplet: string) => string) {
  const e = new DinScreeningEngine();
  await e.start({seed, now: NOW});
  for (let i = 0; !e.getProgress().done; i++) {
    const {current} = e.getProgress();
    e.submitResponse(answer(i, current!.triplet));
  }
  return e.finish();
}

const allCorrect = (_: number, t: string) => t;
const allWrong = (_: number, t: string) => String((+t[0] + 1) % 10) + t.slice(1);

describe('DIN screening engine (provisional De Sousa antiphasic protocol)', () => {
  it('presents the protocol number of triplets, starting at the start SNR', async () => {
    const e = new DinScreeningEngine();
    await e.start({seed: 1, now: NOW});
    expect(e.getProgress()).toMatchObject({trial: 0, total: DIN_PROTOCOL.triplets, done: false});
    expect(e.getProgress().current!.snrDb).toBe(DIN_PROTOCOL.startSnrDb);
    const r = await runAll(1, allCorrect);
    expect(r.trials).toHaveLength(23);
  });

  it('uses −4/+2 dB for the first 3 steps, then ±2 dB 1-up/1-down', async () => {
    const r = await runAll(7, allCorrect);
    const snrs = r.trials.map(t => t.snrDb);
    expect(snrs.slice(0, 5)).toEqual([0, -4, -8, -12, -14]);
    const wrong = await runAll(7, (i, t) => (i < 5 ? t.replace(/./, d => String((+d + 1) % 10)) : t));
    expect(wrong.trials.map(t => t.snrDb).slice(0, 6)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('scores whole triplets and computes SRT as the mean SNR of the last 19 presented triplets', async () => {
    const r = await runAll(3, (i, t) => (i % 2 ? t : t.replace(/.$/, d => String((+d + 1) % 10))));
    const last19 = r.trials.slice(-19).map(t => t.snrDb);
    expect(r.srtDb).toBeCloseTo(last19.reduce((a, b) => a + b, 0) / 19, 10);
    expect(r.trials.filter(t => t.correct)).toHaveLength(11);
  });

  it('is deterministic for the same seed and response sequence (PRD §46)', async () => {
    const answer = (i: number, t: string) => (i % 3 ? t : '000');
    expect(await runAll(42, answer)).toEqual(await runAll(42, answer));
    const other = await runAll(43, answer);
    expect(other.trials.map(t => t.triplet)).not.toEqual((await runAll(42, answer)).trials.map(t => t.triplet));
  });

  it('never self-classifies: result is unvalidated and carries the disclaimer', async () => {
    const r = await runAll(5, allCorrect);
    expect(r.classification).toBe('unvalidated');
    expect(r.disclaimer).toBe(SCREENING_DISCLAIMER);
    expect(SCREENING_DISCLAIMER).toMatch(/does not diagnose hearing loss/);
    expect(r).toMatchObject({protocolId: DIN_PROTOCOL.id, protocolVersion: DIN_PROTOCOL.version, seed: 5});
    expect(r.completedAt).toBe('2026-09-28T10:00:00.000Z');
  });

  it('keeps SNR within bounds and flags a floor/ceiling track', async () => {
    const r = await runAll(9, allWrong);
    expect(Math.max(...r.trials.map(t => t.snrDb))).toBeLessThanOrEqual(DIN_PROTOCOL.maxSnrDb);
    expect(r.flags).toContain('snr_at_upper_bound');
  });

  it('presents triplets of three digits from the protocol digit set', async () => {
    const r = await runAll(11, allCorrect);
    for (const t of r.trials) expect(t.triplet).toMatch(/^[0-9]{3}$/);
  });

  it('rejects malformed responses without advancing', async () => {
    const e = new DinScreeningEngine();
    await e.start({seed: 1, now: NOW});
    for (const bad of ['', '12', '1234', 'abc', '1 2']) expect(() => e.submitResponse(bad)).toThrow(/3 digits/);
    expect(e.getProgress().trial).toBe(0);
  });

  it('can be cancelled, refuses input afterwards, and can be repeated', async () => {
    const e = new DinScreeningEngine();
    await e.start({seed: 1, now: NOW});
    e.submitResponse(e.getProgress().current!.triplet);
    e.cancel();
    expect(e.getProgress().cancelled).toBe(true);
    expect(() => e.submitResponse('123')).toThrow(/not running/);
    expect(() => e.finish()).toThrow(/not complete/);
    await e.start({seed: 1, now: NOW});
    expect(e.getProgress()).toMatchObject({trial: 0, cancelled: false, done: false});
  });

  it('refuses finish() before all triplets are answered', async () => {
    const e = new DinScreeningEngine();
    await e.start({seed: 1, now: NOW});
    expect(() => e.finish()).toThrow(/not complete/);
  });
});
