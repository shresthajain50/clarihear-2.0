# Clarihear Rebuild — Kickoff Brief for Claude Code

You are working in the repo `shresthajain50/clarihear-2.0` (GitHub remote `origin`,
authenticated via `GH_TOKEN`, you have push access — this is the repo owner's own
token). Two documents are the full specification, already committed at:

- `docs/product/PRD.md` — the full Product Requirements Document + technical build spec
- `docs/product/ENGINEERING_SKILL.md` — non-negotiable safety/engineering rules

Read both in full before doing anything else. They are long and authoritative —
treat every rule in ENGINEERING_SKILL.md as a hard constraint, not a suggestion.

## Available methodology (already installed as Claude Code plugins, user-scoped)

- `superpowers` (brainstorming -> writing-plans -> TDD -> executing-plans ->
  requesting-code-review -> verification-before-completion) — the mandatory process gate
- `ecc` (Everything Claude Code: 68 agents, 292 skills — planner, architect, tdd-guide,
  code-reviewer, security-reviewer, build-error-resolver, typescript-reviewer, etc.)
- `ponytail` (YAGNI/minimalism ladder — set to `full` for this greenfield-ish rebuild)
- `mattpocock-skills` (ask-matt, wayfinder, to-spec, to-tickets, tdd, code-review,
  domain-modeling, implement, grill-with-docs, etc.)

Follow the composition recipe: ECC agents supply domain expertise inside superpowers'
phases, ponytail is a continuous style filter, never stack two competing pipelines.

## Step 0 — repo setup

Run the `setup-matt-pocock-skills` skill first. This repo's GitHub remote is
`shresthajain50/clarihear-2.0` with issues enabled and currently empty — use GitHub
Issues as the issue tracker (Section A). Accept default triage labels if the `triage`
skill considerations come up. Single-context domain docs (Section C) — this is not a
monorepo. Write the `## Agent skills` block into a new root `CLAUDE.md` (none exists yet).

Set ponytail to `full` mode for this build: `/ponytail full`.

## Step 1 — chart the wayfinder map

Run the `wayfinder` skill to chart a map on GitHub Issues (label `wayfinder:map`).

**Important shortcut**: the destination and most of the scope are ALREADY fully
specified in `docs/product/PRD.md` and `docs/product/ENGINEERING_SKILL.md` — do not
run a full from-scratch grilling session re-deriving decisions the PRD already makes.
Instead:

- **Destination**: "Refactor and extend `shresthajain50/clarihear-2.0` from its current
  prototype state into the PRD-compliant MVP described in `docs/product/PRD.md`,
  correcting the six specific issues called out in PRD section 6 (fake hearing test,
  raw dB HL to EQ mapping, prototype AFC, insufficient safety limiter, unlabeled
  placeholder compressor defaults, over-exposed dashboard), and satisfying the MVP
  acceptance criteria in PRD section 46 and the Definition of Done in PRD section 56."
- **Notes**: point at `docs/product/PRD.md`, `docs/product/ENGINEERING_SKILL.md`,
  the installed skill stack above, and the fact that platform-native builds
  (Xcode/Android Studio/physical device/simulator audio testing) cannot be run in this
  headless Linux environment — every ticket touching native iOS/Android build or
  on-device audio behavior must say so explicitly and produce code + a documented
  manual verification checklist, not a false claim of having run it.
- Map the frontier breadth-first across the PRD's 7 engineering milestones
  (section 49): Milestone 1 (refactor/architecture/test harness), Milestone 2 (DIN
  screening engine), Milestone 3 (fitting engine — audiogram to bounded gain, replacing
  the current raw dB HL→EQ mapping), Milestone 4 (simplified live listening DSP chain
  with real safety limiter), Milestone 5 (user feedback loop), Milestone 6 (validation/
  test harness), Milestone 7 (deferred — do not build, PRD explicitly gates it behind
  measured baseline benefit).
- Genuinely open product/UX decisions not already answered by the PRD (there may be
  a few, e.g. exact DIN trial count/scoring algorithm source, specific fitting formula
  parameters within NAL-NL2/DSL v5 bounds) ARE real grilling/research tickets — chart
  those properly, don't invent answers.
- For anything genuinely ambiguous that would normally need a live HITL grilling
  ticket, do NOT block waiting for a live human — instead write the specific question
  to `docs/product/OPEN_QUESTIONS.md` (append, don't overwrite) with enough context to
  answer later, pick the most conservative PRD-compliant default, note that default on
  the ticket, and proceed. A supervising Hermes agent will review `OPEN_QUESTIONS.md`
  periodically and can override defaults via a follow-up commit.

## Step 2 — start resolving the map

After charting, start working the frontier: claim tickets, resolve them one at a time
following the wayfinder ticket-type rules (research/prototype/grilling/task). For
`task`-type tickets you can drive alone (AFK), do so. For genuinely HITL-required
tickets, apply the OPEN_QUESTIONS.md fallback above rather than stalling.

Once decision tickets that unblock actual code are resolved, hand implementation work
to `to-tickets` for tracer-bullet build tickets, then implement via TDD (superpowers'
`test-driven-development` skill, real fixture-based tests per ENGINEERING_SKILL.md
rule 12 — "every DSP change requires a regression test with fixed audio fixtures").

Priorities, in order:
1. Milestone 1: clean architecture, CLAUDE.md, native audio abstraction docs, C++ test
   harness (CMake + a test framework — check what's feasible headless on Linux for the
   existing `cpp/test/dsp_test.cpp` and DSP files; note clearly what needs a real
   device/simulator vs what can run in this container).
2. Milestone 3 fitting engine fix (this is the single most safety-critical correction
   called out in PRD section 6, issue 2 — replace `gain = audiogram_dBHL` with a real
   bounded fitting layer) — do this early even if UI work isn't done yet.
3. Milestone 4 safety limiter (three levels per PRD section 23) and hard bypass/mute
   path (ENGINEERING_SKILL.md rule 8).
4. Milestone 2 DIN screening engine (TypeScript, testable headlessly).
5. Everything else per the map's ticket order.

## Working rules throughout

- Never diagnose hearing loss, never map dB HL directly to dB gain, never claim
  clinical-grade calibration for arbitrary hardware, never put the JS thread in the
  real-time audio path, never allocate/lock/log/do I/O/call JS from the audio
  callback, always keep a hard bypass path, always use bounded gain + safety limiter,
  version every DSP/fitting profile, every DSP change needs a fixture-based regression
  test. These are hard invariants — enforce them in code (types, guards, tests), not
  just in comments.
- Real commits, real git history, conventional commit messages, work on a feature
  branch (e.g. `clarihear-mvp-rebuild`) — do not commit to `main` directly. Push
  regularly. A PR back to `main` will be opened once a milestone is demo-able; don't
  open the PR yet unless a milestone is genuinely complete and reviewed.
- Verification claims must be backed by real command output (test runs, build logs)
  pasted into ticket resolution comments — never a bare "done" without evidence, per
  superpowers' verification-before-completion.
- Log meaningful progress and decisions as you go so a fresh session (or a different
  agent) can pick up the map and continue: the wayfinder map + GitHub issues ARE that
  handoff mechanism, keep them current.

Work for as long and as thoroughly as useful in this session. When you reach a natural
stopping point (a milestone done, or context getting large), summarize: what's built,
what's tested, what's still open on the map, and what needs a human decision next.
