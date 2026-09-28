// Versioned local profile store (PRD §35, §38). Everything loaded is validated: a corrupt
// or tampered file must never deliver out-of-range gain to the engine, so invalid data
// is rejected whole and the app falls back to setup.
//
// Storage backend is an adapter (OPEN_QUESTIONS Q8); production wiring needs a device build.

import {FITTING_LIMITS} from '../hearing/fitting';
import {BAND_COUNT, type DspProfile, type HearingProfile, type ListeningMode} from '../hearing/types';
import type {ScreeningResult} from '../hearing/din';

export const PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_KEY = 'clarihear.profile';

export interface UserPreferences {
  mode: ListeningMode;
  /** Output volume, linear 0..1. */
  volume: number;
}

export interface UserProfile {
  id: string;
  createdAt: string;
  ageConfirmed: boolean;
  hearingProfile?: HearingProfile;
  dspProfile?: DspProfile;
  lastScreening?: ScreeningResult;
  preferences: UserPreferences;
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type LoadResult = {kind: 'ok'; profile: UserProfile} | {kind: 'none'} | {kind: 'invalid'; reason: string};

export async function saveProfile(store: KeyValueStore, profile: UserProfile): Promise<void> {
  const problem = checkProfile(profile);
  if (problem) throw new Error(`refusing to save invalid profile: ${problem}`);
  await store.setItem(PROFILE_KEY, exportProfile(profile));
}

export async function loadProfile(store: KeyValueStore): Promise<LoadResult> {
  const raw = await store.getItem(PROFILE_KEY);
  if (raw === null) return {kind: 'none'};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {kind: 'invalid', reason: 'not JSON'};
  }
  if (!isObj(parsed)) return {kind: 'invalid', reason: 'not an object'};
  // ponytail: no migrations yet (v1 is the first schema); add a v→v+1 step here on the first bump.
  if (parsed.schemaVersion !== PROFILE_SCHEMA_VERSION) return {kind: 'invalid', reason: `unsupported schema ${String(parsed.schemaVersion)}`};
  const problem = checkProfile(parsed.profile);
  return problem ? {kind: 'invalid', reason: problem} : {kind: 'ok', profile: parsed.profile as UserProfile};
}

export async function deleteProfile(store: KeyValueStore): Promise<void> {
  await store.removeItem(PROFILE_KEY);
}

/** Data export (PRD §31): the same versioned envelope that is stored. */
export function exportProfile(profile: UserProfile): string {
  return JSON.stringify({schemaVersion: PROFILE_SCHEMA_VERSION, profile});
}

// ── validation ──────────────────────────────────────────────
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isArr = (v: unknown, lo: number, hi: number) => Array.isArray(v) && v.length === BAND_COUNT && v.every(x => isNum(x, lo, hi));
const MODES: readonly unknown[] = ['everyday', 'conversation', 'quiet'];

/** Returns a description of the first problem, or null if the profile is valid. */
function checkProfile(p: unknown): string | null {
  if (!isObj(p)) return 'profile missing';
  if (typeof p.id !== 'string' || !p.id) return 'id';
  if (typeof p.createdAt !== 'string' || Number.isNaN(Date.parse(p.createdAt))) return 'createdAt';
  if (typeof p.ageConfirmed !== 'boolean') return 'ageConfirmed';

  const pref = p.preferences;
  if (!isObj(pref) || !MODES.includes(pref.mode) || !isNum(pref.volume, 0, 1)) return 'preferences';

  if (p.hearingProfile !== undefined) {
    const h = p.hearingProfile;
    const {minThresholdDbHL: lo, maxThresholdDbHL: hi} = FITTING_LIMITS;
    if (!isObj(h) || !isArr(h.left, lo, hi) || !isArr(h.right, lo, hi) || typeof h.fittingVersion !== 'string') return 'hearingProfile';
  }
  if (p.dspProfile !== undefined) {
    const d = p.dspProfile;
    const max = FITTING_LIMITS.maxBandGainDb;
    if (!isObj(d) || !isArr(d.bandGainsLeft, 0, max) || !isArr(d.bandGainsRight, 0, max)) return 'dspProfile gains';
    if (typeof d.fittingVersion !== 'string' || !d.fittingVersion) return 'dspProfile version';
    if (!MODES.includes(d.mode)) return 'dspProfile mode';
    if (!isObj(d.outputLimit) || d.outputLimit.acousticCeilingCalibrated !== false) return 'dspProfile outputLimit';
    if (!isObj(d.compression) || d.compression.source !== 'engineering_placeholder') return 'dspProfile compression';
  }
  if (p.lastScreening !== undefined) {
    const s = p.lastScreening;
    if (!isObj(s) || s.classification !== 'unvalidated' || !isNum(s.srtDb, -40, 40)) return 'lastScreening';
  }
  return null;
}
