# Research: reproducible fitting rules and a sanity envelope for a conservative research profile

Ticket: shresthajain50/clarihear-2.0 #4. Date: 2026-09-28. Scope: a research profile only, not a clinical claim.

## TL;DR
- **NAL-R is the only candidate that is both fully published and practical to implement openly.** Its formula and constants are in the open literature, and at least one open-source implementation (Clarity Challenge, MIT) already ships it. Half-gain (Lybarger), POGO and POGO II are also simple published formulas, but they are coarser.
- **NAL-NL2 and DSL v5 should not be reimplemented.** Both are licensed software: NAL sells licences and a DLL, and Western University transfers DSL to industry as software. NAL-NL2 has no published closed-form formula (it is a neural-net fit to optimised gains). Use them only as literature reference points.
- **The current defaults are conservative relative to NAL-R and NAL-NL2** for mild to moderate losses. The +20 dB ceiling under-fits a 60 dB HL loss by about 6 to 9 dB at full NAL-R target, which is acceptable for safety. The 8 dB inter-band step would clip NAL-R's own low-frequency cut at full target, but not at 0.6x.

## 1. Licensing status

| Rule | Where it is defined | Status for an app |
|---|---|---|
| Lybarger half-gain (1944) | US patent application S.N. 543,278 (1944), long expired | Public-domain formula. Free to use. |
| Berger (Berger, Hagberg and Rane 1977, "Prescription of hearing aids: a rationale", PubMed 1002581) | Journal and book | Published formula. Divisor constants **not verified** from a primary source here (see §2.4). |
| POGO (McCandless and Lyregaard 1983, Hearing Instruments 34:16-21) | Journal | Published formula. |
| POGO II (Schwartz, Lyregaard and Lundh 1988, Hear J 41:13-17) | Journal | Published formula. |
| NAL-R (Byrne and Dillon 1986, Ear Hear 7(4):257-265) | Journal. Reproduced in Dillon, *Hearing Aids*, and in open code | Published formula. Open-source implementations exist: Clarity (MIT) and Kates' HASPI `eb_NALR.m`. |
| NAL-RP (Byrne, Parkinson and Newall 1990/91) | Journal | Published formula. Only matters when PTA > 60 or H2k ≥ 95. |
| NAL-NL1 / NAL-NL2 | NAL software and DLL. Keidser et al. 2011 (PMC4627149) describe the derivation, not a formula | **Licensed.** "Available for licensing by hearing aid and test equipment manufacturers" (nal.gov.au). There is no closed-form formula, because the prescription comes from a neural network fit to optimised gains for 240 audiograms × 7 input levels (PMC4627149). |
| DSL v5 / DSL m[i/o] | Scollie et al. 2005, Trends Amplif 9(4) | **Licensed software.** "DSL is transferred to the hearing instrument industry as software … proceeds … returned to our university" (uwo.ca/nca/dsl/History.html). The algorithm is described in the literature, and UWO also publishes "DSL v5 by Hand", but DSL® is a trademark. Reimplementing it and calling it DSL is legally risky. |

Sources: https://www.nal.gov.au/nal_products/nal-nl2/ , https://shop.nal.gov.au/NAL-NL2-Prescription-Procedure , https://pmc.ncbi.nlm.nih.gov/articles/PMC4627149 , https://www.uwo.ca/nca/dsl/History.html , https://doi.org/10.1177/108471380500900403

## 2. Published formulas

### 2.1 NAL-R (Byrne and Dillon 1986)

```
X     = 0.05 * (H500 + H1k + H2k)          # = 0.15 * H3FA, where H3FA = (H500+H1k+H2k)/3
IG(f) = X + 0.31 * H(f) + k(f)             # real-ear insertion gain, dB; clip at 0
```

| f (Hz) | 250 | 500 | 750 | 1000 | 1500 | 2000 | 3000 | 4000 | 6000 |
|---|---|---|---|---|---|---|---|---|---|
| k(f) dB | −17 | −8 | −3 | +1 | +1 | −1 | −2 | −2 | −2 |

The total slope is 0.46 dB of gain per dB of 3FA loss (0.15 + 0.31), which is the well-known "0.46 rule". AudiologyOnline (Byrne research review) gives "0.31 … average" slope and the 0.46 average gain.

How the constants were cross-checked:
1. **Clarity Challenge `clarity/enhancer/nalr.py`** (github.com/claritychallenge/clarity) uses `bias = [-17, -8, 1, -1, -2, -2]` at [250, 500, 1k, 2k, 4k, 6k], with `x_ave = 0.05*sum(H500,H1k,H2k)`.
2. **Kates, `eb_NALR.m` (HASPI/HASQI, 2006)** has identical constants. Clarity was ported from this code, so it is not a fully independent source.
3. **Nuheara patent US11445313B2** (https://patents.google.com/patent/US11445313B2/en) is independent. It gives "H3FA=(H500+H1k+H2k)/3, X=0.15 H3FA, IGi = X + 0.31 Hi + ki" with k = 250 −17, 500 −8, 1000 +1, 2000 −1, 3000 −2, 4000 −2, 6000 −2. Its worked example also checks out numerically. For HL 15/20/30/50/60 it gives −7.35/3.2/15.3/19.5/21.6, and I recomputed exactly those values.
4. **Rajkumar et al. 2013, Univ. J. Biomed. Eng. 1(2):32-41** (hrpub.org) has the same X = 0.15·PTA and the same 7-frequency k table.
5. **Rajkumar et al. 2013, OnLine J. Biol. Sci. 13(3):82-90** (thescipub.com) lists −17, −8, −3, +1, +1, −1, −2, −2 against the labels 250, 500, 1000, 1500, 2000, 3000, 4000, 6000. That is the 9-frequency table with the 750 Hz label dropped, so its values are shifted by one column. **It is an error in a secondary source. Do not copy it.** It does confirm 750 Hz = −3 and 1500 Hz = +1.

For octave bands at 8 kHz, NAL-R defines nothing above 6 kHz. Reuse k = −2, which is what Clarity and Kates do by holding the edge value. This is an extrapolation.

### 2.2 NAL-RP extension (only for severe losses; outside our mild-moderate scope)
- The sources disagree on the X term above PTA 60:
  - Kates and Clarity use `X = 9.0 + 0.116*(sum3 − 180)` when sum3 > 180.
  - Rajkumar 2013 (hrpub) uses `X = 0.15·PTA + 0.2·(PTA − 60)` for PTA > 60.
  - These are not equal: 0.116 per dB of the sum is 0.348 per dB of PTA. **This is unresolved without the primary paper.** It is irrelevant if we cap at mild to moderate.
- There is also an additive table when H2k ≥ 95 dB HL (Rajkumar 2013, Table 2):
  - 95: +4 +3 +1 0 −1 −2 −2 −2 −2
  - 120: +15 +9 +4 0 −5 −9 −9 −9 −9
  - Columns are 0.25/0.5/0.75/1/1.5/2/3/4/6 kHz.

### 2.3 Half-gain, POGO and POGO II
- Lybarger half-gain: `IG = 0.5·HL`.
- POGO: `IG = 0.5·HL + k`, with k = −10 at 250 Hz, −5 at 500 Hz, and 0 elsewhere (Rajkumar 2013 hrpub eq. 3; also US9712931B2). The original also adds 10 dB of reserve gain, but that is volume-control headroom, not target gain.
- POGO II: same as POGO, plus `0.5·(HL − 65)` when HL > 65 (Rajkumar 2013 OJBS, citing Hawkins 1992; Schwartz et al. 1988).

### 2.4 Berger (not verified)
The literature confirms Berger is "half-gain modified to slightly augment 1–4 kHz" (US9712931B2; Hearing Review 2003). I could not retrieve the divisor constants from a primary or open source. From memory they are roughly HL/2.0 at 500 Hz, /1.6 at 1 kHz, /1.5 at 2 kHz, /1.7 at 3 kHz, /1.9 at 4 kHz and /2.0 at 6 kHz. **Treat these as unverified and do not implement them.** Berger is also the most aggressive of these rules in the mid-highs, so it is the wrong direction for a conservative profile.

## 3. Prescribed gains for two reference audiograms

These are computed insertion gains in dB, using the formulas in §2. The sloping case is my own instance of "20→60": 250:20, 500:25, 1k:35, 2k:45, 4k:55, 8k:60.

**Flat 40 dB HL**

| Rule | 250 | 500 | 1k | 2k | 4k | 8k* |
|---|---|---|---|---|---|---|
| NAL-R | 1.4 | 10.4 | 19.4 | 17.4 | 16.4 | 16.4 |
| NAL-R ×0.6 | 0.8 | 6.2 | 11.6 | 10.4 | 9.8 | 9.8 |
| Half-gain | 20 | 20 | 20 | 20 | 20 | 20 |
| POGO | 10 | 15 | 20 | 20 | 20 | 20 |

**Sloping 20→60 dB HL**

| Rule | 250 | 500 | 1k | 2k | 4k | 8k* |
|---|---|---|---|---|---|---|
| NAL-R | 0 | 5.0 | 17.1 | 18.2 | 20.3 | 21.9 |
| NAL-R ×0.6 | 0 | 3.0 | 10.3 | 10.9 | 12.2 | 13.1 |
| Half-gain | 10 | 12.5 | 17.5 | 22.5 | 27.5 | 30 |
| POGO | 0 | 7.5 | 17.5 | 22.5 | 27.5 | 30 |

\*The 8 kHz values are extrapolated (NAL-R stops at 6 kHz).

For comparison, a flat 60 dB HL loss under NAL-R gives 250:10.6, 500:19.6, 1k:28.6, 2k:26.6, 4k:25.6 dB.

**NAL-NL2 as reported in the literature** (it is licensed, so it was not computed here):
- For a 20→70 dB HL sloping loss, the prescribed insertion gain at 2 kHz for a medium input is **16 dB for a new female user and 21 dB for an experienced male user**. Source: AudiologyOnline 20Q "Same or Different: Comparing the Latest NAL and DSL Prescriptive Targets", https://www.audiologyonline.com/articles/20q-same-or-different-comparing-769
- Compared with NAL-NL1, NAL-NL2 is flatter: relatively more low- and high-frequency gain and less mid-frequency gain. Adults with mild to moderate loss preferred less overall gain for 65 dB inputs than NL1 prescribed. Source: Hearing Review, "What's New About NAL-NL2?"
- DSL m[i/o] and NAL-NL2 give roughly equal loudness and intelligibility at medium inputs. DSL gives more gain for severe losses. Source: Johnson and Dillon 2011, JAAA 22(7):441-459.

**First-fit and acclimatization evidence** (Keidser, Dillon, Carter and O'Brien 2012, "NAL-NL2 Empirical Adjustments", Trends Amplif 16(4):211-223, PMC4040825, https://pmc.ncbi.nlm.nih.gov/articles/PMC4040825/):
- "New users with a 4FA hearing loss greater than 40 dB HL will have gain increasingly reduced by **up to 7 dB for an average hearing loss of 60 dB HL** and above." They are expected to adapt to experienced-user gain over about 2 years.
- When 4FA ≤ 43 dB HL, there was no significant difference between new and experienced users.
- Across studies, preferred gain was **4.3 dB below NAL-R** and **3.2 dB below NAL-NL1** on average.
- Gender adjustment: females preferred 2.4 dB less gain. NAL-NL2 applies −1 dB for females and +1 dB for males.
- Manufacturer "acclimatization levels" are proprietary. I did not verify any published values, so none are cited.

## 4. Are the provisional defaults conservative?

| Default | Verdict |
|---|---|
| Gain onset at 20 dB HL | **More conservative than NAL-R.** NAL-R gives about 10 dB at 1 kHz for a flat 20 dB HL loss (X=3, 0.31·20=6.2, +1). Zero gain at ≤20 dB HL is reasonable for a research profile. |
| Half-gain family, NAL-R style shaping | Use **NAL-R** itself, not half-gain. Half-gain and POGO over-prescribe the highs and, for half-gain, the lows. For a flat 40 dB loss, half-gain gives 20 dB at 250 Hz versus 1.4 dB from NAL-R, and that low-frequency gain amplifies noise and occlusion. |
| First-fit factor 0.6 | **Conservative.** 0.6 × NAL-R removes about 7 to 8 dB at 1 to 2 kHz for a 40 dB HL loss. NAL-NL2 removes 0 dB at 4FA 40 and at most 7 dB at 4FA ≥ 60. Preferred gain averages about 4 dB below NAL-R. So 0.6 is roughly twice as cautious as the evidence for mild losses, but it sits inside the preference spread. Consider 0.75 later, or scale the reduction with 4FA the way NAL-NL2 does. |
| Per-band ceiling +20 dB | Does not bind at flat 40 or at the ×0.6 targets. **It under-fits 60 dB HL at full target**: NAL-R wants 25 to 29 dB at 1 to 4 kHz for a flat 60 loss, so the ceiling is 6 to 9 dB short. The sloping loss at 8 kHz wants 21.9 dB, about 2 dB short. This is acceptable as a safety cap and should be documented as "under-fits moderate-to-severe". |
| Max inter-band step 8 dB | Between adjacent octaves, **NAL-R at full target already exceeds 8 dB**: 250→500 is 9 dB (flat 40) and 500→1k is 12.1 dB (slope). At ×0.6 the steps are ≤7.3 dB and pass. If the step limit is enforced *before* the 0.6 factor it will flatten the low-frequency cut. That would *raise* gain at 250 Hz if the limiter raises the lower band rather than lowering the higher one, so the limiter should only ever pull bands down. |
| Total small-signal chain gain ≤ +20 dB | Consistent with the per-band cap. |
| User adjustment ±6 dB | Reasonable. It covers the typical preferred-gain deviation (mean −3 to −4 dB relative to NAL-R/NL1; the individual spread is wider, see Keidser 2012 Fig. 1, where 45% of people wanted less gain than NL1 and 5% wanted more). The +6 dB must still be clamped by the +20 dB ceiling and the output limiter. |

## 5. Regulatory notes (US FDA OTC hearing-aid rule, 21 CFR 800.30, final rule Aug 2022, effective Oct 2022)
- **Output limit: 111 dB SPL** at any frequency. **117 dB SPL** if input-controlled compression is active. Measured in a coupler. (eCFR 800.30(d); https://www.ecfr.gov/current/title-21/part-800/section-800.30)
- **There is no gain limit in the final rule.** The proposed rule had a gain cap, but FDA decided the output limits were sufficient (ASHA; AAO-HNS summary; DLA Piper). Our +20 dB gain cap is therefore a self-imposed safety margin, not a regulatory number.
- Other limits in 800.30(e):
  - Latency ≤ 15 ms
  - Self-noise ≤ 32 dBA
  - Bandwidth ≤ 250 Hz to ≥ 5 kHz
  - Frequency-response smoothness: no single third-octave peak more than 12 dB above neighbours
  - Distortion limits
  - A user-adjustable volume control is required
  - Adults 18+ with *perceived mild to moderate* loss
- A phone app driving earbuds that is marketed as a hearing aid would fall under this rule. A "research profile" with no hearing-aid claims might not, but that needs a regulatory opinion, not an engineering one. Either way, a hard output limiter is the real safety control, because gain caps alone cannot bound SPL. **Keep a peak output limiter well under 111 dB SPL, e.g. ≤ 100 dB SPL estimated at the eardrum**, which needs a per-device earbud calibration knob.

## Recommended constants (research profile)
```
rule                 = NAL-R (Byrne & Dillon 1986), insertion gain, clip ≥ 0
X                    = 0.05*(H500+H1k+H2k)            # PTA>60: out of scope -> clamp/refuse
k(250,500,1k,2k,4k,8k*) = (-17, -8, +1, -1, -2, -2)   # 750:-3, 1500:+1, 3000:-2, 6000:-2
onset                = 0 gain where H(f) <= 20 dB HL  (keep)
first_fit_factor     = 0.6 (keep; evidence supports ~0.75-0.85 for mild, revisit)
per_band_ceiling     = +20 dB (keep; documented under-fit for >=55-60 dB HL)
max_step_adjacent_octaves = 8 dB, applied AFTER first-fit factor, limiter only lowers bands
chain_ceiling        = +20 dB small-signal
user_trim            = +/-6 dB, post-clamp to ceiling
output_limiter       = <= 100 dB SPL est. at eardrum (FDA OTC hard limit 111/117)
scope_guard          = refuse/flag if PTA(0.5,1,2k) > 60 or any H >= 90
```

## Open questions
- NAL-RP X coefficient: 0.116 per dB of sum (Kates) versus 0.2 per dB of PTA (Rajkumar). Needs the Byrne et al. 1990 primary paper. Out of scope while we cap at PTA ≤ 60.
- Berger divisors are unverified.
- Manufacturer first-fit and acclimatization levels are proprietary and unverified.

## Sources
- Clarity NAL-R: https://github.com/claritychallenge/clarity/blob/main/clarity/enhancer/nalr.py
- Kates eb_NALR.m (mirror): https://github.com/dhimnsen/OpenSpeechPlatform-UCSD/blob/master/matlab/HASPI_HASQI/eb_NALR.m
- US11445313B2 (Nuheara): https://patents.google.com/patent/US11445313B2/en
- US9712931B2 (half-gain, Berger, POGO descriptions): https://patents.google.com/patent/US9712931B2/en
- Rajkumar et al. 2013, UJBE: https://www.hrpub.org/download/20131107/UJBE2-10601674.pdf
- Rajkumar et al. 2013, OJBS: https://thescipub.com/pdf/ojbsci.2013.82.90.pdf
- Byrne research review (0.31 / 0.46): https://www.audiologyonline.com/articles/research-denis-byrne-at-nal-1200
- Keidser et al. 2011, NAL-NL2 procedure: https://pmc.ncbi.nlm.nih.gov/articles/PMC4627149
- Keidser et al. 2012, empirical adjustments: https://pmc.ncbi.nlm.nih.gov/articles/PMC4040825/
- NAL-NL2 licensing: https://www.nal.gov.au/nal_products/nal-nl2/
- DSL: https://www.uwo.ca/nca/dsl/History.html ; Scollie 2005 https://doi.org/10.1177/108471380500900403
- 20Q NAL vs DSL: https://www.audiologyonline.com/articles/20q-same-or-different-comparing-769
- Hearing Review, NAL-NL2: https://hearingreview.com/practice-building/practice-management/whats-new-about-nal-nl2
- Johnson and Dillon 2011: https://dc.etsu.edu/etsu-works/1700/
- 21 CFR 800.30: https://www.ecfr.gov/current/title-21/part-800/section-800.30
- ASHA on the final rule: https://www.asha.org/news/2022/fda-releases-final-rule-for-otc-hearing-aids/
- AAO-HNS summary: https://www.entnet.org/advocacy/regulatory-advocacy/over-the-counter-sale-of-hearing-aids/aao-hns-summary-fda-over-the-counter-hearing-aids-final-rule/
