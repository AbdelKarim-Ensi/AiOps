# Phase 3 — CI/CD with GitHub Actions

**Status:** ✅ Done
**Period:** 1–2 September 2026 (commits `617a5d0` to `bc531c5`)

## 1. Goal

Automate backend validation on every push and publish the Docker image to the GitHub registry (GHCR).

**Definition of Done (PRD):**
> Every push automatically triggers build + tests + image push with no manual intervention.

## 2. Deliverables

A GitHub Actions workflow that chains:

1. **lint**
2. **build**
3. **test**
4. **docker build and push** to GHCR (`ghcr.io/abdelkarim-ensi/aiops-backend`)

Phase 5 later adds the `deploy` job, and phases 9 and 10 replicate the pattern for the ML service and the frontend.

## 3. Problems encountered

| Problem | Cause | Fix |
|---|---|---|
| Push to GHCR refused | The image name contained uppercase letters; GHCR requires lowercase | Image name lowercased (`bd91389`) |
| Empty image tag | The image name computed in one step was not available in the next | Name computed inline in the command (`f963ad4`) |
| Lint / build failures | Files in CRLF after moving from Windows to Linux | Line endings normalised to LF (`bc531c5`) |

The token (PAT) used to push must also have the `workflow` scope in addition to `repo`, otherwise changes to `.github/workflows/` are rejected.
