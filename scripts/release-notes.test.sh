#!/usr/bin/env bash
# Paired test for scripts/release-notes.sh. Builds a throwaway git repository
# under mktemp -d, runs the script inside it, and asserts the six propositions
# the release checklist rests on.
#
# Usage: bash scripts/release-notes.test.sh
set -euo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-notes.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

CASES=0
PASSED=0

ok() {
    CASES=$((CASES + 1))
    PASSED=$((PASSED + 1))
    printf 'ok %s %s\n' "$CASES" "$1"
}

no() {
    CASES=$((CASES + 1))
    printf 'not ok %s %s\n    %s\n' "$CASES" "$1" "$2"
}

# The script under test runs as a separate process through its own shebang and
# executable bit, the way the checklist invokes it, so its errexit is not
# suppressed by this capture; RUN_RC carries the status explicitly.
RUN_OUT=""
RUN_RC=0
run() {
    RUN_RC=0
    RUN_OUT="$(scripts/release-notes.sh "$@" 2>&1)" || RUN_RC=$?
}

commit() {
    printf '%s\n' "$1" >>history.txt
    git add -A
    git commit -q -m "$1"
}

# --- fixture -----------------------------------------------------------------

mkdir -p "$WORK/repo/scripts"
cp "$SCRIPT" "$WORK/repo/scripts/release-notes.sh"
cd "$WORK/repo"

git -c init.defaultBranch=main init -q .
git config user.name "release-notes test"
git config user.email "release-notes-test@example.com"
git config commit.gpgsign false
git remote add origin https://github.com/example/repo.git

cat >README.md <<'EOF'
# example

## What's new in 1.1.0

### Features

- A builder consumers can call without hand-rolling the payload. (#7)

## What's new in 1.0.0

- The first stable release.

## Install

Nothing here; the heading terminates the entry above it.
EOF

commit "feat: the first cut"
git tag v0.9.0
commit "fix: correct the coder"
git tag v1.0.0
commit "feat: add the builder (#7)"
commit "chore(release): 1.1.0"
git tag v1.1.0

# The 1.2.0 line: one README entry, a candidate tag, then the stable tag.
cat >README.md <<'EOF'
# example

## What's new in 1.2.0

### Bug fixes

- The defect the candidate was cut to find. (#9)

## What's new in 1.1.0

### Features

- A builder consumers can call without hand-rolling the payload. (#7)

## What's new in 1.0.0

- The first stable release.

## Install

Nothing here; the heading terminates the entry above it.
EOF
commit "docs: the 1.2.0 entry"
commit "chore(release): 1.2.0-rc.1"
git tag v1.2.0-rc.1
commit "fix: repair what the candidate found (#9)"
commit "chore(release): 1.2.0"
git tag v1.2.0

commit "chore: a version the README does not document"
git tag v1.3.0

commit_lines() {
    printf '%s\n' "$RUN_OUT" |
        awk '/^## Commits$/ { inside = 1; next } inside && /^- / { n++ } END { print n + 0 }'
}

# --- 1: happy path -----------------------------------------------------------

run v1.1.0
want="$(git rev-list --count v1.0.0..v1.1.0)"
got="$(commit_lines)"
last="$(printf '%s\n' "$RUN_OUT" | tail -n 1)"
if [ "$RUN_RC" -eq 0 ] &&
    printf '%s\n' "$RUN_OUT" | grep -qx '## Features' &&
    ! printf '%s\n' "$RUN_OUT" | grep -qx '### Features' &&
    [ "$got" = "$want" ] &&
    [ "$last" = "Full changelog: https://github.com/example/repo/compare/v1.0.0...v1.1.0" ]; then
    ok "v1.1.0 promotes the heading, lists $want commits, and ends with the compare link"
else
    no "v1.1.0 body" "rc=$RUN_RC commits=$got want=$want last='$last'"
fi

# --- 2: unknown tag ----------------------------------------------------------

run v9.9.9
if [ "$RUN_RC" -ne 0 ] && printf '%s\n' "$RUN_OUT" | grep -q 'v9\.9\.9'; then
    ok "an unknown tag exits non-zero and names the tag"
else
    no "unknown tag" "rc=$RUN_RC out='$RUN_OUT'"
fi

# --- 3: no README entry ------------------------------------------------------

run v1.3.0
if [ "$RUN_RC" -ne 0 ] &&
    printf '%s\n' "$RUN_OUT" | grep -q 'README' &&
    printf '%s\n' "$RUN_OUT" | grep -q '1\.3\.0'; then
    ok "a version with no README entry exits non-zero and names the version"
else
    no "missing README entry" "rc=$RUN_RC out='$RUN_OUT'"
fi

# --- 4: no earlier tag -------------------------------------------------------

run v0.9.0
if [ "$RUN_RC" -ne 0 ] && printf '%s\n' "$RUN_OUT" | grep -q 'by hand'; then
    ok "the first tag exits non-zero and sends the body to be written by hand"
else
    no "first tag" "rc=$RUN_RC out='$RUN_OUT'"
fi

# --- 5: a legacy tag is a valid PREV -----------------------------------------

run v1.0.0
want="$(git rev-list --count v0.9.0..v1.0.0)"
got="$(commit_lines)"
last="$(printf '%s\n' "$RUN_OUT" | tail -n 1)"
if [ "$RUN_RC" -eq 0 ] &&
    [ "$got" = "$want" ] &&
    [ "$last" = "Full changelog: https://github.com/example/repo/compare/v0.9.0...v1.0.0" ]; then
    ok "v1.0.0 resolves PREV to the older v0.9.0 and lists the $want commit since it"
else
    no "legacy PREV" "rc=$RUN_RC commits=$got want=$want last='$last'"
fi

# --- 6: a stable tag skips the candidate, which reads the same entry ---------

run v1.2.0
stable_rc=$RUN_RC
want="$(git rev-list --count v1.1.0..v1.2.0)"
got="$(commit_lines)"
last="$(printf '%s\n' "$RUN_OUT" | tail -n 1)"
run v1.2.0-rc.1
rc_last="$(printf '%s\n' "$RUN_OUT" | tail -n 1)"
if [ "$stable_rc" -eq 0 ] &&
    [ "$got" = "$want" ] &&
    [ "$last" = "Full changelog: https://github.com/example/repo/compare/v1.1.0...v1.2.0" ] &&
    [ "$RUN_RC" -eq 0 ] &&
    printf '%s\n' "$RUN_OUT" | grep -qx '## Bug fixes' &&
    [ "$rc_last" = "Full changelog: https://github.com/example/repo/compare/v1.1.0...v1.2.0-rc.1" ]; then
    ok "v1.2.0 skips v1.2.0-rc.1 and lists $want commits, and the candidate reads the 1.2.0 entry"
else
    no "prerelease PREV rule" "rc=$stable_rc commits=$got want=$want last='$last' rc_rc=$RUN_RC rc_last='$rc_last'"
fi

printf 'passed %s/%s\n' "$PASSED" "$CASES"
[ "$PASSED" -eq "$CASES" ]
