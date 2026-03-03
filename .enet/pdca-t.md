---
description: Method PDCA-T — Systematic quality cycle for AI-assisted coding
trigger: always_on
---

# METHOD PDCA-T — Active for all tasks in this project

You are operating under the PDCA-T quality methodology. Apply this 8-phase cycle to every coding task without exception.

## PHASE 1 — PLANNING
Before writing any code:
- State the exact objective in one sentence
- Define what IS and IS NOT in scope
- Ask clarifying questions if anything is ambiguous
- Identify external dependencies
- Define the acceptance criterion

Do not advance until the objective is unambiguous.

## PHASE 2 — REQUIREMENTS ANALYSIS
- List Functional Requirements: `FR-NN: [what the system must do]`
- List Non-Functional Requirements: `NFR-NN: [constraint or quality attribute with metric]`
- Build Risk Register: `RISK-NN: [risk] | Probability | Impact | Mitigation`

## PHASE 3 — ARCHITECTURE DESIGN
Before any implementation:
- Write ADRs: `ADR-NN: [title] | Context | Decision | Alternatives | Consequences`
- Define interface contracts (function signatures + full docstrings) before implementing bodies
- Define module structure: domain / infrastructure / interfaces

## PHASE 4 — MICRO-TASK CYCLE (≤ 50 lines per task)

**4.1** — Check available skills in `.cursor/skills/` and reusable context

**4.2** — Write tests FIRST. Required categories:
- Happy path · Error cases · Edge cases · Security · Performance (if applicable)
- Structure: Arrange / Act / Assert
- Naming: `test_[function]_[scenario]_[expected_outcome]`

**4.3** — Implement code. Standards:
- Full type hints on every parameter and return value
- Docstring with Args, Returns, Raises
- Single responsibility per function
- `Decimal` not `float` for monetary values
- Specific exception types — never bare `except:`
- Zero hardcoded configuration
- Structured logging with context fields

**4.4** — Self-review before running tests:
```
□ Type hints complete?        □ All inputs validated?
□ Docstring written?          □ No hardcoded secrets?
□ Single responsibility?      □ Semantic names?
□ No code duplication?        □ Errors logged with context?
```

**4.5** — Execute tests and show REAL complete output:
```bash
pytest tests/ -v --cov=src --cov-report=term-missing --tb=short
```
Never summarize. Never say "tests pass". Show the exact output.

**4.6** — Validate:
- All tests pass (100%)? If not → fix code, explain, re-run
- Coverage ≥ 99%? If not → identify uncovered lines → add tests → re-run
- Repeat until both conditions are met

## PHASE 5 — INTEGRAL VALIDATION
After all micro-tasks:
- **Security:** No OWASP Top 10 issues · inputs validated · outputs sanitized · no hardcoded secrets · minimum privilege
- **Tests:** 100% passed · 0 failed · coverage ≥ 99% · all categories present
- **Code quality:** Type hints 100% · cyclomatic complexity < 10 · no duplication · SRP · docstrings 100%
- **Performance:** No N+1 · indexes on filter fields · pagination in collections · timeouts configured
- **Architecture:** No circular imports · layers respected · low coupling · inward dependencies only

## PHASE 6 — TECHNICAL DEBT MANAGEMENT
Register every known issue before delivery:
```
DEBT-XXX: [Short title]
  Type: Technical | Test | Documentation | Architecture | Security | Performance
  Description: [What and why]
  Impact: High | Medium | Low — [justification]
  Effort: Xh
  Priority: High | Medium | Low
  Plan: [Specific action and target version]
```
Do not write TODO/FIXME in code — register as DEBT-XXX instead.

## PHASE 7 — REFINEMENT TO ≥ 99%
If any metric is below target:
`Identify → Classify → Plan → Execute → Verify → Confirm ≥ 99%`
Never advance to Phase 8 without confirming ≥ 99% on all 5 validation dimensions.

## PHASE 8 — DELIVERY REPORT
Always close every task with:
1. Implementation summary (2-3 sentences)
2. Test table: total / passed / failed / coverage / time
3. Full unedited pytest output
4. Key technical decisions with justifications
5. Technical debt registered (DEBT-XXX list)
6. CI/CD checklist (all items confirmed)
7. Suggested next steps

## ABSOLUTE RULES — NEVER VIOLATE
1. Tests BEFORE implementation — always, no exceptions
2. Show REAL test output — never summarize or omit
3. No hardcoded secrets — environment variables from commit 1
4. Coverage ≥ 99% before any delivery
5. ADRs for non-trivial decisions
6. All known issues as DEBT-XXX with priority and plan
