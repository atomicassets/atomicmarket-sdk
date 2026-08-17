# Releasing @atomichub/atomicmarket

How a version of this package reaches npm and GitHub. A release ends at a rendered GitHub Release, not at the npm approval.

## Checklist

1. The feature PR carries the README `## What's new in X.Y.Z` entry for the version, and squash-merges so its subject ends with `(#N)`.

2. Land a `chore(release): X.Y.Z` commit on `main` that touches `package.json` alone.

3. Tag that commit and push the tag:

    ```sh
    git tag vX.Y.Z && git push origin vX.Y.Z
    ```

    `publish.yml` starts and waits on the `npm-publish` environment. Push the tag before you create the Release, because `--target <short sha>` fails.

4. Compose the body, read it, then create the Release:

    ```sh
    scripts/release-notes.sh vX.Y.Z > notes.md
    gh release create vX.Y.Z --verify-tag --title vX.Y.Z --notes-file notes.md
    ```

    With more than one release in flight, create them in ascending version order.

5. Approve the `npm-publish` environment for the tag. With more than one release waiting, approve in ascending version order, so npm `latest` stays monotonic.

6. Verify the published version and the rendered Release:

    ```sh
    npm view @atomichub/atomicmarket version
    gh release view vX.Y.Z
    ```

## Body template

The Release title is the tag name verbatim. The body is an optional one-sentence summary, then the sections that have items, then the commit list, then the compare link as the last line. Nothing follows the link, and a section with no items is left out.

```
<one-sentence summary, optional>

## Breaking changes

- <what changed, and what the reader does about it>. (#N)

## Features

- <what is new>. (#N)

## Bug fixes

- <what was wrong and is not now>. (#N)

## Commits

- <short sha> <subject>

Full changelog: https://github.com/atomicassets/atomicmarket-sdk/compare/<PREV>...<TAG>
```

The section order is breaking changes, features, bug fixes, deprecations, other changes.

## Voice

- Neutral and factual, the register of the Node.js or esbuild release notes.
- Sectioned. The heading says what kind of change it is, so the item does not repeat it.
- One to three plain sentences per item: what changed, and what the reader does about it when action is needed. Code identifiers in backticks.
- Every item ends with its PR reference `(#N)`, or with its short sha in backticks when the change had no PR.
- No preface, no motivation essay, no clause chain explaining how the author got there. The why stays only where it changes what the reader does.
- Present tense for the new behavior, sentence-case headings, straight quotes, and no em-dash.

## Where the text comes from

`scripts/release-notes.sh vX.Y.Z` reads the README `## What's new in X.Y.Z` entry written in the feature PR, promotes its `### ` headings to `## `, appends the commit list, and appends the compare link. Write that entry with H3 section headings (`### Breaking changes`, `### Features`, and the rest) and the Release body needs no second draft.

The script needs bash, git, awk and sed. It reads the README at the tag, not from the working tree, so the body describes what the tag ships. It exits non-zero and names what is missing when the tag does not exist, when the README at the tag has no entry for the version, or when no earlier tag exists.

## Tag ranges, prereleases, and older releases

- `PREV` is the nearest earlier `v*` tag reachable from `TAG^`, which is what `git describe --tags --abbrev=0 --match 'v*' vX.Y.Z^` returns. Tags from older release lines count.
- `## Commits` lists the whole `PREV..TAG` range, oldest first, including the release commit. Its line count equals `git rev-list --count PREV..TAG`.
- A tag with no earlier tag has no `PREV`. Its body is the summary and the sentence `Initial release.`, with no commit list and no compare link, and it is written by hand.
- A prerelease tag (`vX.Y.Z-rc.1` and the like) is created with `--prerelease`.
- A Release created for a tag older than the current latest is created with `--latest=false`, so the latest marker stays on the newest version.
