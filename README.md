# MAGI

> The system that sees everything in Nerv. One portal to discover services, scaffold new ones and track their deployments.

**MAGI** is the developer portal of **Nerv**, an internal developer platform (IDP) built on Kubernetes, Backstage and ArgoCD. It is a [Backstage](https://backstage.io/) application that gives development teams a single place to:

- **Discover** every service, API and team through the software catalog
- **Create** new services from golden path templates, with no tickets and no waiting
- **Observe** the state of their workloads in Kubernetes and their deployments in ArgoCD
- **Read** documentation that lives next to the code, via TechDocs

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (Active LTS)
- [Yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/) (to build the container image)
- A GitHub token for `GITHUB_TOKEN` that can read the catalog, create repositories, push workflow files and open pull requests. `gh auth token` works if your GitHub CLI login has the `repo` and `workflow` scopes.
- The Central Dogma dispatch token for `DOGMA_DISPATCH_TOKEN` (see [Release bot connection](#release-bot-connection))

### Run locally

```bash
git clone https://github.com/camnoss/magi.git
cd magi
yarn install
```

Create a local configuration file for your credentials. It is ignored by Git and must never be committed:

```yaml
# app-config.local.yaml
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
```

Then set both tokens and start the app:

```bash
export GITHUB_TOKEN=$(gh auth token)
export DOGMA_DISPATCH_TOKEN=<dispatch-token>
yarn start
```

On Windows PowerShell:

```powershell
$env:GITHUB_TOKEN = gh auth token
$env:DOGMA_DISPATCH_TOKEN = "<dispatch-token>"
yarn start
```

The frontend is served at http://localhost:3000 and the backend at http://localhost:7007.

## Configuration

| File | Purpose | Committed |
|---|---|---|
| `app-config.yaml` | Base configuration shared by all environments | ✅ |
| `app-config.production.yaml` | Overrides for in-cluster deployments | ✅ |
| `app-config.local.yaml` | Local overrides and credentials | ❌ |

Secrets are never stored in this repository. Configuration references them through environment variables, which are injected at runtime from Kubernetes secrets managed in Central Dogma.

| Variable | Used for | Required |
|---|---|---|
| `GITHUB_TOKEN` | GitHub integration: catalog discovery, and creating repositories and pull requests from templates | Yes |
| `DOGMA_DISPATCH_TOKEN` | `nerv.releaseBot.dispatchToken`: copied into new service repositories so every merge deploys right away | Recommended |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database, in `app-config.production.yaml` only | In production |

## Release bot connection

Services created from Eva Templates deploy to `dev` on every merge to `main`. Their CI tells the [Central Dogma release bot](https://github.com/camnoss/central-dogma#automatic-dev-deployments) about each new image with a `repository_dispatch`, which needs a token stored in the service repository as the `DOGMA_DISPATCH_TOKEN` Actions secret.

**You don't set that secret by hand.** When MAGI creates a repository, the `nerv:release-bot:connect` step of the template copies `DOGMA_DISPATCH_TOKEN` from MAGI's environment into the new repository.

- **The token:** a fine-grained personal access token with access to only `camnoss/central-dogma` and **Contents: read and write**. That is the permission `repository_dispatch` requires. Create it under GitHub → Settings → Developer settings → Fine-grained tokens.
- **If MAGI starts without it,** the step logs a warning and the service is created without the secret. It still deploys, but only on the release bot's hourly run instead of right after each merge. Set the secret later with the command below.
- **Repositories created before the step existed** (`greeting`) need it once:
  ```bash
  gh secret set DOGMA_DISPATCH_TOKEN -R camnoss/<service>
  ```
- **Rotating the token:** update `DOGMA_DISPATCH_TOKEN` for MAGI, then re-set the secret on every existing service with the loop in the [Central Dogma README](https://github.com/camnoss/central-dogma#the-dispatch-token).

`camnoss` is a personal account, which has no shared Actions secrets, so every service repository holds its own copy. Moving the repositories to a GitHub organization would allow a single organization secret instead.

## Registering a component in the catalog

Add a `catalog-info.yaml` to the root of your repository:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: example-service
  description: Short description of what the service does
  annotations:
    github.com/project-slug: nerv-platform/example-service
    backstage.io/kubernetes-id: example-service
    argocd/app-name: example-service
spec:
  type: service
  lifecycle: experimental
  owner: group:team-example
```

Then register it from the MAGI UI (**Create → Register Existing Component**) or add its URL to the `catalog.locations` section of `app-config.yaml`. Repositories created from Eva Templates are registered automatically.

---

## Building the container image

```bash
yarn install --immutable
yarn tsc
yarn build:backend
yarn build-image
```

In CI, the image is built and pushed on every merge to `main`. Deploying a new version is a pull request to Central Dogma that updates the image tag in `platform/magi/`.

## Useful links

- [Backstage documentation](https://backstage.io/docs/)
- [Central Dogma](https://github.com/camnoss/central-dogma): GitOps repository for the Nerv platform