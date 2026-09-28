import {AMBIENT_CHECK, UNCALIBRATED_NOTICE, assessAmbient, assessChannels} from '../deviceCheck';

describe('ambient noise check (PRD §10)', () => {
  const quiet = Array(30).fill(-60);
  it('passes a quiet room', () => expect(assessAmbient(quiet)).toMatchObject({kind: 'ok'}));

  it('rejects a noisy room with the PRD copy (never silently continues)', () => {
    const r = assessAmbient(Array(30).fill(-30));
    expect(r).toMatchObject({kind: 'too_noisy', message: 'It is a little noisy here. Move somewhere quieter for a more reliable result.'});
  });

  it('uses the median, so one door slam does not fail the check but sustained noise does', () => {
    expect(assessAmbient([...quiet.slice(0, 27), -5, -5, -5]).kind).toBe('ok');
    expect(assessAmbient([...Array(16).fill(-30), ...Array(14).fill(-60)]).kind).toBe('too_noisy');
  });

  it('treats a dead or silent mic as "cannot check", not as quiet', () => {
    expect(assessAmbient(Array(30).fill(-96)).kind).toBe('no_signal');
    expect(assessAmbient([]).kind).toBe('no_signal');
    expect(assessAmbient([NaN, NaN]).kind).toBe('no_signal');
  });

  it('needs enough readings to judge', () => {
    expect(assessAmbient(Array(AMBIENT_CHECK.minReadings - 1).fill(-60)).kind).toBe('no_signal');
  });
});

describe('left/right headphone check (PRD §11)', () => {
  it('passes only when each tone is heard in the right ear', () => {
    expect(assessChannels({left: 'left', right: 'right'})).toEqual({kind: 'ok'});
  });
  it.each([
    [{left: 'right', right: 'left'}, 'swapped'],
    [{left: 'both', right: 'right'}, 'mono'],
    [{left: 'left', right: 'both'}, 'mono'],
    [{left: 'none', right: 'right'}, 'not_heard'],
    [{left: 'left', right: 'left'}, 'wrong'],
  ] as const)('%j fails as %s', (answers, kind) => {
    const r = assessChannels(answers);
    expect(r.kind).toBe(kind);
    expect(r.kind !== 'ok' && r.message.length).toBeGreaterThan(10);
  });
  it('states that consumer headphones are not calibrated', () => {
    expect(UNCALIBRATED_NOTICE).toMatch(/not calibrated/);
    expect(UNCALIBRATED_NOTICE).toMatch(/should not be treated as a clinical audiogram/);
  });
});
