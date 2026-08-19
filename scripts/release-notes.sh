#!/usr/bin/env bash
# Compose the GitHub Release body for a released tag: the README entry for the
# version, the commit list for the tag range, and the compare link.
#
# Usage: scripts/release-notes.sh vX.Y.Z   (the body goes to stdout)
set -euo pipefail

die() {
    printf 'release-notes: %s\n' "$*" >&2
    exit 1
}

TAG="${1-}"
[ -n "$TAG" ] || die "no tag given; usage: scripts/release-notes.sh vX.Y.Z"
# A prerelease reads the entry for the version it is a candidate for, so
# vX.Y.Z-rc.1 and vX.Y.Z compose from one README entry.
VERSION="${TAG#v}"
VERSION="${VERSION%%-*}"

git rev-parse -q --verify "refs/tags/$TAG" >/dev/null ||
    die "tag $TAG does not exist in this repository"

ORIGIN="$(git remote get-url origin 2>/dev/null)" ||
    die "this repository has no origin remote"
# Only the GitHub URL forms git emits or accepts; anything else is refused
# rather than parsed into a compare link that points at the wrong host.
case "$ORIGIN" in
    git@github.com:*) SLUG="${ORIGIN#git@github.com:}" ;;
    ssh://git@github.com/*) SLUG="${ORIGIN#ssh://git@github.com/}" ;;
    https://github.com/*) SLUG="${ORIGIN#https://github.com/}" ;;
    https://*@github.com/*) SLUG="${ORIGIN#https://*@github.com/}" ;;
    *) die "the origin remote is not a GitHub URL" ;;
esac
SLUG="${SLUG%/}"
SLUG="${SLUG%.git}"

# A stable release lists everything since the last stable release, so the
# lookup excludes prerelease tags; a prerelease lists what it adds to the tag
# before it, of any kind.
MATCH=(--match 'v*')
case "${TAG#v}" in *-*) : ;; *) MATCH+=(--exclude 'v*-*') ;; esac
# git describe exits non-zero when no tag matches. That is the first-release
# case rather than a failure, so the status is read here instead of aborting.
# A stable tag whose only earlier tags are prereleases falls back to the
# nearest tag of any kind, so the first stable release after a candidate line
# still lists what it adds to the last candidate.
PREV="$(git describe --tags --abbrev=0 "${MATCH[@]}" "$TAG^" 2>/dev/null || true)"
[ -n "$PREV" ] || PREV="$(git describe --tags --abbrev=0 --match 'v*' "$TAG^" 2>/dev/null || true)"
[ -n "$PREV" ] || die "no v* tag reachable before $TAG; the first-release body is written by hand"

# The README is read at the tag, not from the working tree, so the body
# describes what the tag ships even when the script runs from another branch.
# The entry runs from its own heading to the next H2. sed drops the blank lines
# above the first line of content, and the command substitution ($(...)) drops
# the trailing ones, so the entry ends on its last line of content.
ENTRY="$(git show "$TAG:README.md" | awk -v h="## What's new in $VERSION" '
    $0 == h { inside = 1; next }
    inside && /^## / { exit }
    inside { print }
' | sed '/./,$!d')"
[ -n "$ENTRY" ] || die "README.md at $TAG has no \"## What's new in $VERSION\" entry"

printf '%s\n' "$ENTRY" | sed 's/^### /## /'
printf '\n## Commits\n\n'
git --no-pager log --no-decorate --no-show-signature --reverse --oneline "$PREV..$TAG" | sed 's/^/- /'
printf '\nFull changelog: https://github.com/%s/compare/%s...%s\n' "$SLUG" "$PREV" "$TAG"
