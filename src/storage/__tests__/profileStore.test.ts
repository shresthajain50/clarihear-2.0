import {FITTING_VERSION, fitHearingProfile} from '../../hearing/fitting';
import {dbHL, type FrequencyThresholds} from '../../hearing/types';
import {
  PROFILE_KEY,
  PROFILE_SCHEMA_VERSION,
  deleteProfile,
  exportProfile,
  loadProfile,
  saveProfile,
  type KeyValueStore,
  type UserProfile,
} from '../profileStore';

const memoryStore = (): KeyValueStore & {data: Map<string, string>} => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async k => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async k => void data.delete(k),
  };
};

const thresholds = [30, 35, 40, 45, 50, 55].map(dbHL) as unknown as FrequencyThresholds;
const hearingProfile = {left: thresholds, right: thresholds, source: 'audiogram_import' as const, confidence: 1, fittingVersion: FITTING_VERSION};
const fit = fitHearingProfile(hearingProfile);
if (fit.kind !== 'fitted') throw new Error('fixture must fit');

const profile: UserProfile = {
  id: 'u1',
  createdAt: '2026-09-28T10:00:00.000Z',
  ageConfirmed: true,
  hearingProfile,
  dspProfile: fit.dsp,
  preferences: {mode: 'everyday', volume: 0.5},
};

const tamper = async (store: ReturnType<typeof memoryStore>, edit: (o: any) => void) => {
  const o = JSON.parse(store.data.get(PROFILE_KEY)!);
  edit(o);
  store.data.set(PROFILE_KEY, JSON.stringify(o));
  return loadProfile(store);
};

describe('profile store', () => {
  it('round-trips a versioned profile', async () => {
    const s = memoryStore();
    await saveProfile(s, profile);
    expect(JSON.parse(s.data.get(PROFILE_KEY)!).schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(await loadProfile(s)).toEqual({kind: 'ok', profile});
  });

  it('reports no profile on first launch', async () => {
    expect(await loadProfile(memoryStore())).toEqual({kind: 'none'});
  });

  it('rejects corrupt JSON', async () => {
    const s = memoryStore();
    s.data.set(PROFILE_KEY, '{not json');
    expect(await loadProfile(s)).toMatchObject({kind: 'invalid'});
  });

  it('rejects an unknown (newer) schema version instead of guessing', async () => {
    const s = memoryStore();
    await saveProfile(s, profile);
    expect(await tamper(s, o => (o.schemaVersion = 99))).toMatchObject({kind: 'invalid', reason: expect.stringMatching(/schema/)});
  });

  it.each([
    ['gain above ceiling', (o: any) => (o.profile.dspProfile.bandGainsLeft[2] = 45)],
    ['negative gain', (o: any) => (o.profile.dspProfile.bandGainsRight[0] = -3)],
    ['NaN-ish gain', (o: any) => (o.profile.dspProfile.bandGainsLeft[1] = null)],
    ['wrong band count', (o: any) => o.profile.dspProfile.bandGainsLeft.pop()],
    ['missing fitting version', (o: any) => delete o.profile.dspProfile.fittingVersion],
    ['calibrated claim', (o: any) => (o.profile.dspProfile.outputLimit.acousticCeilingCalibrated = true)],
    ['threshold out of range', (o: any) => (o.profile.hearingProfile.left[3] = 500)],
    ['bad mode', (o: any) => (o.profile.preferences.mode = 'turbo')],
    ['volume above 1', (o: any) => (o.profile.preferences.volume = 3)],
    ['missing id', (o: any) => delete o.profile.id],
  ])('never loads a tampered profile (%s)', async (_label, edit) => {
    const s = memoryStore();
    await saveProfile(s, profile);
    expect(await tamper(s, edit)).toMatchObject({kind: 'invalid'});
  });

  it('refuses to save an invalid profile', async () => {
    const s = memoryStore();
    const bad = {...profile, preferences: {mode: 'everyday' as const, volume: 7}};
    await expect(saveProfile(s, bad)).rejects.toThrow(/invalid/);
    expect(s.data.size).toBe(0);
  });

  it('deletes and exports (privacy controls, PRD §31)', async () => {
    const s = memoryStore();
    await saveProfile(s, profile);
    expect(JSON.parse(exportProfile(profile))).toMatchObject({schemaVersion: PROFILE_SCHEMA_VERSION, profile: {id: 'u1'}});
    await deleteProfile(s);
    expect(await loadProfile(s)).toEqual({kind: 'none'});
  });
});
