# Organization context template

Copy this file to `claude/context.md` in a **private** `.github` repository in your GitHub organization (`<org>/.github`), and give every team read access. The co-dev session-start hook reads it through GitHub, so everyone gets it with no clone needed. Keep it under about 6,000 characters: the hook cuts off anything past its share of the session context.

Keep the repository private. A public `.github` repository becomes the organization's public profile and default community files, which would publish everything below.

Delete these instructions and the `<...>` placeholders when you fill it in.

```markdown
# <Product name>

<One or two sentences: what the product does and who uses it.>

## Repositories

| Repository | Role | Talks to |
| --- | --- | --- |
| `<api-repo>` | Backend API, the contract every client follows | `<db>`, `<queue>` |
| `<web-repo>` | Web client | `<api-repo>` |
| `<ios-repo>` | iOS and tvOS client | `<api-repo>` |
| `<android-repo>` | Android client | `<api-repo>` |
| `<worker-repo>` | Background jobs | `<api-repo>` database |
| `<infra-repo>` | Infrastructure as code | |

## Keeping the clients consistent

The backend is the contract. Before building or fixing a feature in one client, read how the other clients already do it, and match the endpoints, parameters, validation, error handling and reading of each response field. Only the UI may differ. When they disagree, say so in the pull request instead of copying the difference.

## Environments

- `beta`: <URL>, <who uses it>
- `rc`: <URL>
- `prod`: <URL>

## Tracking

- Jira project `<KEY>` (or GitHub issues in `<repo>`).
- Branch and commit conventions: <anything beyond the defaults>.

## Compliance

- Cloud Officer compliance tenant: `<tenant>`.
- In scope: <ISO 27001 / ISO 13485 / IEC 62304 class X>.
- Adding a third-party service: tell `<owner>` so it is registered as a vendor in the compliance app.
- Adding or upgrading a dependency: update the SOUP list with `soup`.

## Owners

- `<area>`: `<person or team>`
```
