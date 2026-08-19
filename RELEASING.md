# Releasing @atomichub/atomicmarket

How a version of this package reaches npm and GitHub. A release ends at a rendered GitHub Release, not at the npm approval.

## Checklist

1. The feature PR carries the README `## What's new in X.Y.Z` entry for the version, and squash-merges so its subject ends with `(#N)`.

2. Land a `chore(release): X.Y.Z` commit on `main` that touches `package.json` alone. CI's `test/packaging.test.ts` on that commit proves the tarball ships only the files the package metadata section expects.

3. Tag that commit and push the tag:

    ```sh
    git tag vX.Y.Z && git push origin vX.Y.Z
    ```

    `publish.yml` starts; its build job runs the release gates (tag matches version, tag on main), the install, the tests, and packs the tarball; its publish job waits on the `npm-publish` environment. Push the tag before you create the Release, because `--target <short sha>` fails.

4. Compose the body, read it, then create the Release:

    ```sh
    scripts/release-notes.sh vX.Y.Z > notes.md
    gh release create vX.Y.Z --verify-tag --title vX.Y.Z --notes-file notes.md
    ```

    With more than one release in flight, create them in ascending version order.

5. Approve the `npm-publish` environment for the tag once the run is green through the build gates, the tag-on-main check included, which proves the tagged commit sits on `main`. With more than one release waiting, approve in ascending version order, so npm `latest` stays monotonic.

6. Verify the published version and the rendered Release:

    ```sh
    npm view @atomichub/atomicmarket version
    gh release view vX.Y.Z
    ```

## Publish auth

The publish job authenticates through npm trusted publishing (OIDC). It holds
no npm token and sets no registry URL on the setup step, so nothing writes an
`.npmrc` auth entry and npm 11.5.1 or later exchanges the job's OIDC identity
for a short-lived credential of its own. The `npm-publish` environment is the
gate on that identity: the build job runs immediately on the pushed tag, and
the publish job waits until a maintainer approves it.

`publishConfig.provenance` in `package.json` makes a default local npm publish
fail, because no OIDC identity is available outside CI to satisfy it. It is
data inside the manifest being published, not an access control. The durable
control is the npm-side package setting that requires trusted publishing,
which closes the classic-token path that no workflow change can reach.

## Body template

The Release title is the tag name verbatim. The body is an optional one-sentence summary, then the sections that have items, then the commit list, then the compare link as the last line. Nothing follows the link, and a section with no items is left out.

```
<one-sentence summary, optional>

## Breaking changes

- <what changed, and what the reader does about it>. (#N)

## Upgrading

- <what the move from the previous stable release takes: migrations, configuration keys, image tags>.

## Features

- <what is new>. (#N)

## Bug fixes

- <what was wrong and is not now>. (#N)

## Security

- <the advisory or the dependency lift, named>. (#N)

## Deprecations

- <what is deprecated and what replaces it>. (#N)

## Other changes

- <a change a consumer notices that fits no section above>. (#N)

## Commits

- <short sha> <subject>

Full changelog: https://github.com/atomicassets/atomicmarket-sdk/compare/<PREV>...<TAG>
```

The section order is breaking changes, upgrading, features, bug fixes, security, deprecations, other changes. The two optional ones:

- `## Upgrading` says what the move from the previous stable release takes: renamed exports, configuration to set, a step to run. It is written against that release rather than against the tag range, and a candidate body may confine it to what changed since the previous candidate that carries a Release.
- `## Security` carries the advisories and the dependency lifts, each named by its GHSA or CVE.

A release with neither leaves both out, which is the normal case here.

## Voice

- Neutral and factual, the register of the Node.js or esbuild release notes.
- Sectioned. The heading says what kind of change it is, so the item does not repeat it.
- One to three plain sentences per item: what changed, and what the reader does about it when action is needed. Code identifiers in backticks.
- Every item ends with its PR reference `(#N)`, or with its short sha in backticks when the change had no PR.
- No preface, no motivation essay, no clause chain explaining how the author got there. The why stays only where it changes what the reader does.
- Present tense for the new behavior, sentence-case headings, straight quotes, and no em-dash.

## Where the text comes from

`scripts/release-notes.sh vX.Y.Z` reads the README `## What's new in X.Y.Z` entry written in the feature PR, promotes its `### ` headings to `## `, appends the commit list, and appends the compare link. Write that entry with H3 section headings (`### Breaking changes`, `### Features`, and the rest) and the Release body needs no second draft.

The script needs bash, git, awk and sed. It reads the README at the tag, not from the working tree, so the body describes what the tag ships. A prerelease tag reads the entry for its base version, so `vX.Y.Z-rc.1` reads `## What's new in X.Y.Z` as that entry stands at the candidate tag. It exits non-zero and names what is missing when the tag does not exist, when the README at the tag has no entry for the version, or when no earlier tag exists.

## Package metadata

`package.json` carries the fields the npm page and a consumer read, and a release does not change them by accident:

- `name` and `version`.
- `description`: one sentence on what the package does and for whom.
- `license`, with the `LICENSE` file shipped.
- `homepage`.
- `repository`: an object with `type: git` and the `git+https` URL of this repository.
- `bugs`: an object with the issues URL.
- `author`: an object with `name` and `url`.
- `keywords`.
- `engines`.
- `main`, `module`, `types` and the `exports` map.
- `files`: the build output and the notices that must ship.
- `sideEffects`.
- `publishConfig` with `access: public` and `provenance: true`, so a publish outside `publish.yml` either carries the same access and provenance or fails, instead of publishing without them.

The README opens with the package name, the npm version, CI and license badges, a short introduction on what the package is for, and an install line, because that README is the npm page. `npm pack --dry-run` lists what the tarball ships; the build output, its type declarations and source maps, the README, the license and the notices are expected, anything else is a `files` mistake. `test/packaging.test.ts` runs that check in CI, so the tarball is proven before the tag.

## Tag ranges, prereleases, and older releases

- `PREV` for a stable tag is the nearest earlier stable `v*` tag reachable from `TAG^`, which is what `git describe --tags --abbrev=0 --match 'v*' --exclude 'v*-*' vX.Y.Z^` returns, so a stable release lists every commit since the last stable release. For a prerelease tag `PREV` is the nearest earlier tag of any kind, so each candidate lists what it adds to the tag before it. A stable tag whose only earlier tags are prereleases takes the nearest of them. Tags from older release lines count.
- `## Commits` lists the whole `PREV..TAG` range, oldest first, including the release commit. Its line count equals `git rev-list --count PREV..TAG`.
- A tag with no earlier tag has no `PREV`. Its body is the summary and the sentence `Initial release.`, with no commit list and no compare link, and it is written by hand.
- A prerelease tag (`vX.Y.Z-rc.1` and the like) is created with `--prerelease`.
- A Release created for a tag older than the current latest is created with `--latest=false`, so the latest marker stays on the newest version.
