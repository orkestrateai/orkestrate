# Hosted Registry

`orkestrate.space` is the hosted discovery and publishing surface for the
Orkestrate ecosystem.

The CLI should stay useful without the website. The website adds publisher
identity, public discovery, submissions, and review.

## Public User Flow

Anyone can:

- browse approved profiles and extensions;
- read developer docs;
- copy install/validation commands;
- inspect manifest metadata and source URLs.

No auth is required for browsing.

## Publisher Flow

Publishing requires auth.

Day 0 auth should be GitHub through Supabase Auth. GitHub is the right default
because extension/profile authors are likely publishing from repositories.

Flow:

1. Publisher signs in with GitHub.
2. Publisher creates a publisher profile.
3. Publisher submits a repo URL plus manifest URL or pasted manifest JSON.
4. Submission is stored as `pending`.
5. Orkestrate team reviews manually.
6. Approved submissions become public registry items and versions.

## Database Shape

The website migration creates:

- `publisher_profiles` - public publisher identity tied to `auth.users`.
- `registry_items` - public approved profile packs, adapters, skill packs, MCP
  packs, and command packs.
- `registry_versions` - versioned manifests for approved registry items.
- `registry_submissions` - authenticated pending publisher submissions.

Browsing reads only approved registry rows.

Submissions are private to the submitting authenticated user until reviewed.

## RLS Model

Public:

- `publisher_profiles`: selectable by everyone.
- `registry_items`: selectable by everyone only when `status = 'approved'`.
- `registry_versions`: selectable by everyone only when the version and item are
  approved.

Authenticated:

- users can create and update their own publisher profile;
- users can create submissions;
- users can view and edit their own pending submissions.

Admin/review actions should use server-side service role code only. Never expose
the service role key to browser code.

## Website Pages To Build

Minimum:

- `/registry` - approved public profiles/extensions.
- `/registry/[slug]` - detail page with manifest, source URL, versions, and
  install/validate commands.
- `/submit` - GitHub-authenticated submission form.
- `/docs/profiles` - profile authoring.
- `/docs/extensions` - extension manifest authoring.
- `/docs/adapters` - harness adapter authoring.

## CLI Integration Later

The CLI can later add:

```sh
orkestrate registry search math
orkestrate extension install orkestrate.profile-pack.math-research
orkestrate profile install math-researcher
```

For launch, local catalog plus hosted docs/submission path is enough.
