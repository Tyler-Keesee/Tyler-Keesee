# Profile maintenance

The profile uses standard GitHub Markdown and two repository-owned SVGs. Its main content, links, and illustrations do not depend on third-party image services, tracking pixels, or statistics hosts.

## Editing the profile

- Update the introduction, projects, toolkit, and contact links in `README.md`.
- Edit `assets/header.svg` to change the banner. Keep its title and description meaningful.
- Keep project descriptions concise and link only to public repositories.
- Preserve the `STATS:START`/`STATS:END` and `LANGUAGES:START`/`LANGUAGES:END` comments. The updater replaces the statistics block, the language summary block, and `assets/github-snapshot.svg`. The curated skill table remains manually maintained; the detected language summary is a count of GitHub primary-language metadata from original public repositories, not a proficiency assessment.

## Public snapshot

The workflow is scheduled every five minutes (at minutes 07, 12, etc. UTC), can be triggered manually from Actions, and runs after changes to its script or workflow land on `main`. GitHub may delay or omit some scheduled runs; creation/deletion of another repository does not directly dispatch an event to this workflow. No realtime guarantee is implied. Scheduled runs may be delayed by GitHub. GitHub can disable scheduled workflows after 60 days without repository activity; re-enable the workflow in Actions if necessary.

It uses `GET /users/<account-owner>/repos` (the workflow reads `GITHUB_REPOSITORY_OWNER`; local runs default to `Tyler-Keesee`) with pagination to count public repositories, original public repositories (excluding forks), and stars received on original public repositories. It also calls `GET /users/<account-owner>/starred` with pagination for the number of repositories starred by the account. Empty or archived public repositories are included. The profile reports public repository count, starred-by-user count, and stars received, **not the signed-in GitHub total repository count (which includes private repositories)**. Private repository names and private counts require additional user-scoped authorization, intentionally not used here. It does not count private contributions, commit totals, WakaTime hours, or a coding streak.

The workflow uses GitHub's built-in `GITHUB_TOKEN`; no personal access token or extra secrets are needed. The refresh job needs repository contents write permission to commit the two generated files. Pull requests run tests with read-only permissions and never refresh or push. Protected branches may require adapting the commit step to your repository rules.

An API failure leaves the previous committed snapshot visible, with its last successful date. If repository settings disable Actions, the profile still displays normally; only the snapshot stops refreshing.

## Local checks

Requires Node.js 22 or later, with no packages to install:

```sh
node --test scripts/update-profile.test.mjs
node scripts/update-profile.mjs
```

For an offline refresh, provide a JSON object with `repos` and `starredRepos` arrays (both from GitHub public endpoints):

```sh
node scripts/update-profile.mjs --from-json /path/to/snapshot.json
```

Preview `README.md` in GitHub before merging. On a profile, GitHub serves relative images from this repository. All key information is also written as text, including the stats, so images are optional for understanding the profile.
