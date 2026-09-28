# Research: which validated Digits-in-Noise (DIN) protocol a consumer smartphone MVP should follow

GitHub issue #8 (shresthajain50/clarihear-2.0). Researched 2026-09-28.

Sources are primary papers: full text where I could get it (open access / institutional repository), otherwise the PubMed abstract. Every claim is tagged with its source. When a detail comes only from a secondary description, it says so. Paywalled full texts I could not read: Smits 2013 JASA, Watson 2012 JAAA, Potgieter 2018 Ear Hear, Smits 2016 IJA, Masalski 2024 IJA, Smits 2022 JASA. Details that exist only in those papers are marked **(abstract only)** or **(unverified)**.

---

## 1. TL;DR

- The **provisional default doesn't match any published protocol exactly.** It mixes Smits 2013 (24 triplets) with Potgieter 2016 (start 0 dB, fixed 2 dB steps). It also averages trials 5–24, which no source I found uses. In simulation, starting at 0 dB with fixed 2 dB steps makes the SRT about +1.3 dB too high (too poor) for a listener whose true SRT is around −17 dB SNR. That is the normal-hearing range for the antiphasic DIN. See §4.
- **Recommendation:** use the **University of Pretoria / hearZA antiphasic (NoSπ) smartphone procedure** (De Sousa et al. 2020, 2022). It is the most-validated **English, smartphone, self-test** DIN. It also underlies hearZA, hearWHO and hearDigits, and it is the most sensitive published DIN variant (AUROC 0.94–0.95 vs 0.77–0.79 for diotic).
  - 23 triplets, start 0 dB SNR.
  - Step rule: for the first 3 steps, go down 4 dB after a correct response and up 2 dB after an incorrect one. After that, ±2 dB.
  - Score by whole triplet. SRT = mean of the last 19 SNRs.
- **Keep `classification: 'unvalidated'`.** Every published cut-off is tied to one set of recordings and one noise, in one population. Clarihear has no licensed, normed English stimulus set, so no published cut-off transfers.
- **Licensing:** I found no validated English DIN recording set released under an open licence.
  - The SA-English and US-English (Cincinnati) sets are sold commercially by hearX Group (hearDigits).
  - The Watson US set belongs to Communication Disorders Technology, Inc. (National Hearing Test).
  - The Dutch Smits set is shared by Amsterdam UMC on request (terms not public).

---

## 2. Protocol-by-protocol comparison

### 2.1 Smits, Kapteyn & Houtgast 2004: Dutch telephone DTT (National Hearing Test)

| Item | Finding | Source |
|---|---|---|
| Purpose | Fully automatic telephone speech-in-noise screening. Measures triplet SRT(n) adaptively in about 3 min | [Smits 2004, PMID 14974624](https://pubmed.ncbi.nlm.nih.gov/14974624/) (abstract) |
| Adaptive rule | Simple 1-up/1-down ("simple up-down procedure with fixed step-size"). Its statistics (SD increases with hearing loss; bias vs start level, slope, heterogeneity) are modelled in Smits & Houtgast 2006 | [Smits & Houtgast 2006, PMID 17004483](https://pubmed.ncbi.nlm.nih.gov/17004483/) (abstract) |
| Accuracy | Sensitivity 0.91, specificity 0.93 "when proper SRT(n) values were chosen". Correlation with PTA(0.5,1,2) r = 0.732 and with PTA(0.5,2,4) r = 0.770. Measurement error < 1 dB. Sample: 76 ears of 38 hearing-impaired listeners | Smits 2004 abstract |
| Channel | Telephone bandwidth (300–3400 Hz). The later DIN uses bandwidth up to 16 kHz | [Kaldi-NL DIN paper, arXiv 2312.12269](https://arxiv.org/pdf/2312.12269) |
| Relevance | Historical. Telephone band, Dutch. Superseded by Smits 2013 | — |

### 2.2 Smits, Goverts & Festen 2013: Dutch DIN (broadband, clinical/diagnostic)

| Item | Finding | Source |
|---|---|---|
| Stimuli | Single digits from a **male** speaker, concatenated into triplets, with per-digit level corrections to homogenise them. 120 triplets in 10 lists of 24 | [Smits 2013, PMID 23464039](https://pubmed.ncbi.nlm.nih.gov/23464039/) (abstract); list structure from arXiv 2312.12269 |
| Noise | Stationary long-term-average-speech-spectrum noise. Unique noise token per triplet | abstract; arXiv 2312.12269 |
| Rule | 1-up/1-down, 2 dB. The **first triplet is repeated with +4 dB until it is correct**, then the SNR drops 2 dB | arXiv 2312.12269, which reimplements the procedure using stimuli supplied by Smits |
| Triplets | 24 per list | arXiv 2312.12269 |
| Scoring | Whole triplet ("correct" = all digits match) | arXiv 2312.12269 |
| SRT | The arXiv reimplementation gives SRT = Σ SNR_j for j = 5…25, divided by 21. That is **triplets 5–24 plus the virtual 25th**, the SNR the 24th response would set. A secondary description (Tandfonline 2025 search snippet, full text blocked) says "the last 20 digit triplets, including the theoretical SNR of the 25th". **The window is 20 or 21 values; I could not verify which from Smits 2013 itself.** Both versions include the virtual 25th | arXiv 2312.12269; (unverified vs original) |
| Start SNR | Not confirmed from the primary paper. The Kaldi-NL implementation initialises the first triplet at about −5 dB SNR (as rendered in its pseudo-code) | (unverified) |
| Practice | "One training list is needed for naive listeners. No further learning effects were observed in 24 subsequent SRT measurements" | Smits 2013 abstract |
| Precision | Measurement error 0.7 dB | Smits 2013 abstract |
| Norms | Reference SRTs from 1386 listeners aged over 60. The paper doesn't give a single pass/refer cut-off | abstract |
| Licensing | Recordings owned by Amsterdam UMC (Smits). Shared with researchers on request: the Kaldi-NL authors thank "Cas Smits from Amsterdam University Medical Center, for sharing the DIN test stimuli". No public licence | arXiv 2312.12269 |
| Language | Dutch only | — |

### 2.3 Watson, Kidd, Miller, Smits & Humes 2012: US-English telephone DIN

| Item | Finding | Source |
|---|---|---|
| Stimuli | Digit triplets spoken in a **Middle American** dialect, recorded as whole triplets (not concatenated). 64 homogeneous triplets kept from 160, adjusted to equal 50%-SNR using 10 young normal-hearing listeners | [Watson 2012, PMID 23169193](https://pubmed.ncbi.nlm.nih.gov/23169193/) (abstract) |
| Rule | 1-down/1-up adaptive | abstract |
| Triplets | 40 per test in the study. The deployed National Hearing Test uses "a set of 25 sequences … about four minutes … per ear. Both right and left ears are tested", so it is **monaural** | abstract; [nationalhearingtest.org](https://www.nationalhearingtest.org/science-national-hearing-test/) |
| SRT | "Thresholds based on the average of only 21 trials (**trials five through 25** of the 40-trial tracking history)" | abstract |
| Accuracy | Sensitivity 0.80, specificity 0.83 for PTA(0.5,1,2 kHz) > 20 dB HL. r = 0.74 with PTA. n = 90 (49 with hearing loss) | abstract |
| Comparability | NL DIN and US DIN SRTs don't differ in steady-state noise in normal-hearing Dutch listeners. Diotic gives about a 1 dB advantage over monotic, and antiphasic about a further 5 dB | [Smits et al. 2016, PMID 26940045](https://pubmed.ncbi.nlm.nih.gov/26940045/) (abstract + search summary) |
| Licensing | Communication Disorders Technology, Inc. (Bloomington, IN) with Indiana University. Offered as the paid National Hearing Test service. I found no stimulus licence terms published | nationalhearingtest.org; Watson affiliation watson@comdistec.com |

Related US-English work: **Motlagh Zadeh et al. 2021** (Cincinnati Children's), "US-English digits 0 to 9, homogenized for audibility", presented binaurally in broadband and low-pass (2/4/8 kHz) speech-shaped noise. A 4 kHz low-pass masker gave sensitivity 92% and specificity 90% for PTA_HF (4–12.5 kHz) ≥ 20 dB. n = 60 normal hearing + 40 mild SNHL. Two authors are hearX shareholders ([PMID 33928924](https://pubmed.ncbi.nlm.nih.gov/33928924/), abstract). hearX says its American-English hearDigits was "developed in collaboration with Cincinnati Children's Hospital" ([hearX hearDigits](https://www.hearxgroup.com/products/heardigits)).

### 2.4 Vlaming, MacKinnon, Jansen & Moore 2014: UK "HF-triplet" (this is what "ED-DIN" most likely refers to)

I found no paper titled "ED-DIN" by Vlaming. The 2014 Vlaming paper is the British-English high-frequency digit-triplet test ([PMC4212007](https://pmc.ncbi.nlm.nih.gov/articles/PMC4212007/), full text read via NCBI BioC).

| Item | Finding |
|---|---|
| Stimuli | One female speaker with a southern English accent. Digits 0–9 **excluding 7** (disyllabic). Each digit recorded in first/middle/last position, giving 27 tokens plus the carrier "The numbers …". Homogenised on 10 normal-hearing listeners |
| Noise | Speech-shaped. The HF version is **low-pass filtered at 1500 Hz** (10th-order Butterworth) and summed with the original noise attenuated by 15 dB. The BB-triplet version is unfiltered. Noise starts 500 ms before the speech |
| Rule | "25 triplets … Following a correct response, the SNR is reduced by 2 dB … incorrect … increased by 2 dB". 1-up/1-down, 2 dB, whole-triplet |
| Start SNR | **−14 dB** ("about 8–10 dB above the expected SRT for NH listeners"), because the low-pass noise makes SRTs very low (NH mean −21.3 dB, SD 2.4) |
| SRT | "Mean SNR of the **last 19** stimulus presentations", i.e. triplets 7–25 |
| Level | "The speech level is varied while the background noise is kept at a constant level." Lab noise fixed at 65 dBA. For home/internet use: "It is not practical to prescribe a fixed sound level". A demo triplet at −4 dB SNR is played and the user sets a "comfortable volume" |
| Cut-offs | Chosen at the ROC point where marginal TPR gain = marginal FPR gain. HF-triplet: **87% true-positive and 7% false-positive for PTA_HF (3,4,6,8 kHz) ≥ 20 dB**. For the BB-triplet in this study, cut-offs were −9.2 / −8.2 dB SRT for PTA_HF > 20 / > 60 dB HL, and −7.2 / −9.1 dB for PTA_LF criteria (AUROC 0.91 / 0.90). Table 8 HF-triplet values weren't extractable. Sample: 24 normal hearing, 50 hearing impaired |
| Transducers | Cheap loudspeakers were about 1.1–1.5 dB worse for hearing-impaired listeners. The paper recommends headphones for home testing |
| Licensing | Funded by NIHR, MRC and Action on Hearing Loss (now RNID). No public licence found |
| Relevance | British English. More sensitive to high-frequency loss, but very small validation sample and no smartphone data |

### 2.5 Potgieter, Swanepoel, Myburgh (Hopper), Smits 2016/2018: SA-English smartphone diotic DIN (hearZA)

Source: [Potgieter et al. 2016 IJA, PMID 27121117](https://pubmed.ncbi.nlm.nih.gov/27121117/). Author manuscript read in full from the [UP repository](https://repository.up.ac.za/bitstream/2263/55987/1/Potgieter_Development_2016.pdf).

| Item | Finding |
|---|---|
| Stimuli | Digits 0–9 from **one native SA-English female speaker**, with the carrier "the number" for natural intonation. RMS-equalised, then level-corrected so each digit has 50% intelligibility at the same SNR. Stored as OGG. 120 triplets (the Smits 2013 list) assembled at runtime: 500 ms silence at start and end, 200 ms ± 100 ms jitter between digits |
| Noise | White noise shaped to the LTASS of the digits. Noise level = average level of the digits without silences (following Smits 2013) |
| Presentation | **Diotic** over smartphone earphones. Triplet speech-recognition slope 20%/dB |
| Level setting | The user sets a comfortable level with a scroll bar while triplets loop. "Fixed noise level and a varying speech level when triplets with negative SNRs are presented … positive SNRs … speech level becomes fixed and the noise level varies", which keeps overall level constant and prevents clipping |
| Rule | 1-up/1-down, 2 dB, "similar to Smits et al (2004)". Whole-triplet ("A triplet is judged to be correct when all digits are entered correctly") |
| SRT | "The SRT is calculated as the average SNR of the triplets presented (**4 to 23**)", i.e. 23 triplets, 20 values averaged |
| Headphones | Five headphone types gave mean SRTs from −11.4 to −11.7 dB, not significantly different |
| Norms / cut-offs | Upper 95th percentile of native SA-English normal hearing: **−8.4 dB** (normal hearing in the better ear, n = 96) and **−8.9 dB** (both ears, n = 90). Mean −10.6 / −10.7 dB, SD 1.0 / 0.9 |
| 2018 update | [Potgieter 2018 Ear Hear, PMID 29189432](https://pubmed.ncbi.nlm.nih.gov/29189432/) (abstract): n = 454. SRT predicted by 4FPTA, age, and self-reported English competence. Separate cut-offs for native + non-native (≥6/10 competence) vs non-native (≤5/10). A logistic model with age gave AUROC 0.962 / 0.903. The cut-off **−9.55 dB** for "N or NN with high self-reported English competence" is quoted in [Potgieter et al. 2018 SAJCD](https://scielo.org.za/scielo.php?script=sci_arttext&pid=S2225-47652018000100005). That paper also gives sensitivity 0.88 / specificity 0.88 vs abnormal 4FPTA (n = 109). hearWHO's "dynamic cut-off values" derive from this approach |
| Deployment | hearZA launched March 2016. 24,072 tests analysed. Overall referral rate 22.4% ([De Sousa 2018 AJA, PMID 30452748](https://pubmed.ncbi.nlm.nih.gov/30452748/)) |
| Later procedure change | By 2019 the hearZA procedure had changed to the one in §2.6: "going down in 4 dB steps for the first three responses … thereafter, continuing in 2 dB steps. Each test uses 23-digit triplets and averages the last 19 responses" ([Brown et al. 2019, UP repository](https://repository.up.ac.za/bitstream/2263/73122/1/Brown_Performance_2019.pdf)). The same paper reports sound-field test-retest differences of −0.1 to +0.2 dB |

### 2.6 De Sousa, Swanepoel, Moore, Myburgh, Smits 2020/2022: antiphasic (NoSπ) + diotic DIN (recommended)

Sources: [De Sousa 2020 Ear Hear, PMC7015780](https://pmc.ncbi.nlm.nih.gov/articles/PMC7015780/) (full text via BioC) with the [bioRxiv preprint](https://www.biorxiv.org/content/10.1101/677609v1.full); [De Sousa 2022 Ear Hear, PMC9010337 / PMID 34799493](https://pubmed.ncbi.nlm.nih.gov/34799493/) (author manuscript read in full from the [UP repository](https://repository.up.ac.za/server/api/core/bitstreams/20d27e5c-2c4a-4716-b812-2b7e1c479c41/content)).

| Item | Finding |
|---|---|
| Stimuli | The same SA-English female digits and 120-triplet list as Potgieter 2016. For NoSπ the "original homogenized diotic digits" are phase-reversed in one ear. Noise stays in phase |
| Noise | Speech-weighted, diotic (in phase). Noise "freshness" comes from taking successive fragments of a long noise file from a random offset in the first 5 s |
| Triplets | **23**, drawn at random from 120 |
| Start SNR | **0 dB** |
| Steps | "4 dB SNR for the first 3 steps, thereafter continuing in 2 dB steps … For the first three steps, SNR became progressively more negative by 4 dB per step for correct responses but increased by 2 dB per step for incorrect responses" |
| Rule / scoring | 1-up/1-down on **whole triplet** ("only considered correct when all digits were entered correctly") |
| SRT | "averaging the **last 19 SNRs**, in line with the currently used hearZA test". The papers don't say whether the virtual 24th SNR is among the 19 (that is, triplets 5–23 vs 6–24). See §4 |
| Level | Fixed noise with variable speech when SNR < 0. Fixed speech with variable noise when SNR ≥ 0. The user self-selects the overall level |
| Devices | Samsung smartphones with the manufacturer's wired earbuds, or Sennheiser HDA 220/280 |
| Accuracy (2020) | n = 145 (41 normal hearing, 57 symmetric SNHL, 24 asymmetric SNHL, 23 CHL), aged 18–84. AUROC for PTA > 25 dB HL: antiphasic 0.94, diotic 0.77. Test-retest ICC > 0.89. Measurement error: diotic 1.1 dB, antiphasic 1.4 dB |
| Cut-offs (2022, n = 489, aged 18–92) | **Antiphasic:** poorer-ear PTA > 25 dB HL → **−15.7 dB** (sensitivity 90.1%, specificity 84.6%, AUROC 0.94). PTA > 40 dB HL → **−13.7 dB** (90.7% / 87.4%, AUROC 0.95). **Diotic:** > 25 dB HL → −10.3 dB (85.4% / 49.8%). > 40 dB HL → −9.9 dB (80.7% / 60.1%). Age-corrected cut-offs are not recommended. Sequential antiphasic-then-diotic triage classified 75–79% into normal / bilateral SNHL / unilateral-or-CHL |
| Other languages | French antiphasic DIN (Höra app, [PMC8551565](https://pmc.ncbi.nlm.nih.gov/articles/PMC8551565/)) uses the identical procedure: 0 dB start, 4 dB for 3 steps then 2 dB, 23 triplets, last 19. Its cut-offs differ: −12.9 / −11.7 / −10.9 dB for PTA > 20 / 25 / 40 dB HL. That shows **cut-offs don't carry across recordings or languages** |

### 2.7 hearWHO (WHO, built on hearX technology)

- "The app presents **23 sets of three digits** over background noise". The score is 0–100: < 50 means likely hearing loss, 50–75 means check annually, > 75 means good hearing. Earphones are required. The WHO claims sensitivity and specificity "over 85%" and cites Potgieter 2016–2018 and De Sousa 2020 ([WHO Q&A](https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-hearing-checks-and-the-hearwho-app)).
- **The mapping from SRT to the 0–100 score is not published** in anything I found, and neither is whether the current build is diotic or antiphasic. **(unverified)**
- Treat hearWHO as a product that implements the hearZA procedure. It is not a separately published protocol.

### 2.8 Other variants worth knowing

- **Digit-level scoring with variable steps** (Denys et al. 2019, Flemish DTT, [PMID 31187664](https://pubmed.ncbi.nlm.nih.gov/31187664/)). Targeting 79% (D79) matches triplet scoring with 2 dB steps and improves test-retest reliability, so fewer trials are needed. This is also the method in the **Masalski & Morawski 2024 multilingual DIN**: 17 languages, female speech, digit scoring, variable step, Android "Hearing Test" app. Normative SRTs from −14.2 (Chinese) to −11.2 (Japanese) dB. Test-retest SD 0.48–0.91 dB ([PMID 39207918](https://pubmed.ncbi.nlm.nih.gov/39207918/), abstract). The abstract doesn't say whether it includes English, what the stimulus licence is, or whether it has pass/refer cut-offs. **Worth following up as a possible licensable multilingual source.**
- **2-down/1-up tracks** (Arabic/English online DINs, [PMC11930467](https://pmc.ncbi.nlm.nih.gov/articles/PMC11930467/)) converge on 70.7%, not 50%. Their SRTs are not comparable with 1-up/1-down norms.

---

## 3. Cross-cutting findings

### 3.1 Cut-offs are tied to recordings, noise and population
- For the same diotic procedure, SA-English normal-hearing SRT is about −10.7 dB ([Potgieter 2016](https://repository.up.ac.za/bitstream/2263/55987/1/Potgieter_Development_2016.pdf)).
- Antiphasic moves it by about 5–7 dB ([Smits 2016](https://pubmed.ncbi.nlm.nih.gov/26940045/); [PMC8551565](https://pmc.ncbi.nlm.nih.gov/articles/PMC8551565/)).
- Low-pass noise moves it to about −21 dB ([Vlaming 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4212007/)).
- Normative SRTs vary by 3 dB across languages under one method ([Masalski 2024](https://pubmed.ncbi.nlm.nih.gov/39207918/)).
- Cut-offs also depend on non-native competence and age ([Potgieter 2018](https://pubmed.ncbi.nlm.nih.gov/29189432/)).
- **Conclusion:** without the exact validated stimulus set (and ideally norms re-checked on our playback chain), a pass/refer label isn't defensible. Keep `unvalidated`.

### 3.2 Level setting
- Every smartphone/internet DIN I found uses **user-selected comfortable level** rather than calibrated SPL. Across the adaptive track, the rule is: **noise fixed / speech varies below 0 dB SNR, speech fixed / noise varies at or above 0 dB SNR** (Potgieter 2016; De Sousa 2020/2022; PMC8551565).
- Lab versions fix the noise level: 65 dBA in Vlaming 2014, 70 dB SPL during Potgieter's homogenisation.
- The level-independence of SRT is the basis for skipping calibration. Vlaming 2014 says "the SRT is largely independent of the absolute presentation level over a wide dynamic range … testing can be performed without level calibration".

### 3.3 Reliability / validity checks
- Published reliability data is test-retest: ICC > 0.89 (De Sousa 2020); measurement error 0.7 dB (Smits 2013), 1.1 dB diotic and 1.4 dB antiphasic (De Sousa 2020). The SD of SRT increases with hearing loss (Smits & Houtgast 2006).
- **Track SD (SDtrack) is a poor reliability flag.** Smits et al. 2022 ([PMID 36319224](https://pubmed.ncbi.nlm.nih.gov/36319224/)) found that inattention, fatigue and giving up only slightly raise SDtrack, and "SDtrack, however, poorly discriminates between reliable and unreliable SRT estimates". **Don't make an SRT-SD gate the main invalidation rule.**
- I found no published "false-response detection" rule for hearZA/hearWHO. hearX's hearDigits training manual (Confluence) exists but I couldn't access it. **(unverified)**
- Checks that are defensible as heuristics, clearly labelled non-normative:
  - require headphones;
  - for antiphasic, confirm stereo output. A mono downmix (mono-audio accessibility setting, single earbud) cancels or distorts the phase-inverted speech and invalidates NoSπ. This follows from the physics of NoSπ; I found no paper that tests it;
  - flag a track that hits an SNR ceiling (for example, many incorrect responses at ≥ +X dB);
  - flag empty or incomplete responses.

### 3.4 Practice
- Smits 2013: one training list is needed for naive listeners.
- hearZA/hearWHO use a volume-setting preview (looping triplets) plus a tutorial, and no scored practice (Potgieter 2016).
- Vlaming 2014 plays a demo triplet at −4 dB and notes a training effect "can either be corrected for, or an extra training trial can be given".

---

## 4. Sanity check of the provisional default

Provisional default: 1-up/1-down, whole triplet, 2 dB, start 0 dB, 24 triplets, SRT = mean of trials 5–24, no cut-off.

| Parameter | Provisional | Closest published | Verdict |
|---|---|---|---|
| 1-up/1-down, whole triplet | yes | all of Smits 2004/2013, Watson 2012, Vlaming 2014, Potgieter 2016, De Sousa 2020 | OK |
| Start 0 dB | yes | Potgieter 2016, De Sousa 2020/2022, French antiphasic | OK, **but only when paired with the initial 4 dB steps** (see below) |
| Fixed 2 dB from trial 1 | yes | Potgieter 2016 (diotic only). Smits 2013 instead repeats the first triplet +4 dB until correct. Vlaming starts near the SRT (−14 dB) | **Problem for antiphasic.** From 0 dB, 2 dB steps take about 8 trials to reach a normal NoSπ SRT (about −16 to −18 dB). Discarding 4 trials leaves the descent in the average |
| 24 triplets | yes | Smits 2013 (24), but hearZA/hearWHO/De Sousa use 23 | Hybrid |
| Mean of trials 5–24 (20 presented, no virtual trial) | yes | Smits 2013: 5–25 incl. virtual. Watson: 5–25. Potgieter 2016: 4–23. De Sousa: last 19 of 23. Vlaming: last 19 of 25 | **Matches no published protocol** |

Monte Carlo check (ideal listener, logistic triplet psychometric function with 20%/dB slope from Potgieter 2016, 20,000 runs; script: `/tmp/wf/sim.py`):

| Config | bias @ true SRT −10 | bias @ −17 | SD |
|---|---|---|---|
| Provisional (24, 0 dB, 2 dB, mean 5–24) | +0.19 | **+1.32** | ~0.6 |
| hearZA/De Sousa (23, 0 dB, 4 dB × 3, mean 5–23) | −0.02 | +0.29 | ~0.67 |
| Same, incl. virtual (6–24) | −0.02 | +0.13 | ~0.67 |
| Potgieter 2016 (23, 2 dB, 4–23) | +0.40 | +1.88 | ~0.6 |

This models only the start-up transient, not real listener behaviour. It confirms why the Pretoria group added the initial 4 dB steps when they moved to antiphasic.

---

## 5. Recommendation

**Follow the De Sousa et al. 2020/2022 hearZA antiphasic smartphone DIN procedure** (Ear Hear 41:442–450; Ear Hear 43:1037–1048), and keep diotic as an optional second test.

Why:
1. It is the most-validated **English smartphone self-test** DIN: n = 489 with PTA gold standard, 24k field users (hearZA), and WHO adoption (hearWHO).
2. Antiphasic is clearly more sensitive (AUROC 0.94 vs 0.77) and detects unilateral SNHL and CHL, which diotic misses.
3. If Clarihear later licenses hearX stimuli (SA or US English), its norms and cut-offs apply only if the procedure matches exactly.

```yaml
din:
  protocol: "desousa2020-antiphasic"   # De Sousa et al. 2020 Ear Hear 41:442; hearZA procedure
  presentation: antiphasic              # NoSπ: digits phase-inverted in one ear, noise in phase (NoSo optional 2nd test)
  triplets: 23                          # drawn at random from the 120-triplet list (Smits 2013 list)
  practice_scored_triplets: 0           # volume-setting preview with looping triplets + tutorial, as in hearZA
  start_snr_db: 0
  rule: 1up1down
  scoring: whole_triplet                # correct only if all 3 digits correct
  step_db:
    initial_steps: 3                    # first 3 step decisions:
    initial_down_db: 4                  #   correct   -> SNR -4 dB
    initial_up_db: 2                    #   incorrect -> SNR +2 dB
    down_db: 2                          # thereafter +/-2 dB
    up_db: 2
  srt: mean_of_last_19_presented        # triplets 5..23; virtual 24th NOT included (see note)
  include_virtual_trial: false
  noise: speech_shaped_stationary       # LTASS of the digit recordings, RMS = mean digit level; fresh random-offset segment per triplet
  level_rule: fixed_noise_below_0dB_fixed_speech_at_or_above_0dB
  level_setting: user_comfortable       # uncalibrated; headphones required; stereo required for antiphasic
  classification: unvalidated           # no pass/refer until a licensed, normed stimulus set is adopted
```

Notes on the config:
- **Virtual trial:** De Sousa/hearZA say "last 19 SNRs" of 23 triplets without saying whether the unplayed 24th is included. I chose the literal reading, presented triplets 5–23. In simulation the two readings differ by ≤ 0.2 dB. **Confirm with the authors (Smits, Swanepoel) or hearX before claiming norm compatibility.**
- If Clarihear instead adopts the Smits 2013 Dutch procedure (for example, through an Amsterdam UMC licence), use its own rules: 24 triplets, first triplet repeated +4 dB until correct, then ±2 dB, and **include the virtual 25th** (triplets 5–25). Don't mix the two.
- **Don't publish cut-offs.** The De Sousa antiphasic cut-offs (−15.7 / −13.7 dB) and the diotic ones (−10.3 / −9.9 dB, or Potgieter's −8.4 / −8.9 / −9.55 dB) are valid only for the SA-English female recordings, speech-weighted noise, the hearZA app, and similar earbuds, in a South African adult clinical population.

## 6. Per-language / English-first implications

- **SA English (hearX / University of Pretoria):** the best-validated English smartphone set, both diotic and antiphasic. Commercial, via hearX (hearDigits / hearWHO). Contact is sales@hearxgroup.com; no public licence terms.
- **US English:** two lineages.
  - Watson/CDT: whole-triplet recordings, telephone, monaural, 5–25 averaging; National Hearing Test.
  - Cincinnati/hearX: US-English digits used in the Motlagh Zadeh 2021 low-pass work; hearDigits American English.
  - For a US launch, the Cincinnati/hearX set is the natural choice if we license. No published antiphasic US-English pass/refer cut-off turned up in this search.
- **UK English:** Vlaming 2014 HF-triplet (RNID / Action on Hearing Loss funded). Excludes "7", uses low-pass noise, starts at −14 dB. Different norms entirely.
- **Self-recorded English:** if Clarihear records its own speaker, it has to repeat the full chain before any cut-off exists:
  - per-digit homogenisation (Potgieter 2016: 4 lists × 10 SNRs from −2 to −20 dB on normal-hearing listeners, level corrections);
  - a normative study;
  - an ROC study against PTA.
  - Accent and non-native competence shift SRTs by about 1.7 dB (Potgieter 2018), so norms must be per accent and population.
- **Multilingual later:** the Masalski 2024 17-language set (digit scoring) is methodologically uniform but uses a different scoring rule. Adopting it means switching protocol, not just stimuli.

## 7. Open questions to close before assigning any pass/refer

1. Exact SRT window in De Sousa/hearZA: triplets 5–23 or 6–24 incl. virtual? And in Smits 2013: 20 or 21 values?
2. hearX licensing terms for SA/US-English stimuli (SDK or recordings), and whether the norms transfer to iOS/Android playback chains and Bluetooth earbuds.
3. hearWHO's SRT→score mapping, and whether the current build is antiphasic.
4. Masalski 2024 multilingual DIN: is English included, what is the stimulus licence, are there cut-offs?
5. Any published false-response / catch-trial rule in hearX products (the training manual was inaccessible).
