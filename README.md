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
- A GitHub token with read access to the organization (for catalog discovery)

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

Then start the app:

```bash
export GITHUB_TOKEN=<your-token>
yarn start
```

The frontend is served at http://localhost:3000 and the backend at http://localhost:7007.

## Configuration

| File | Purpose | Committed |
|---|---|---|
| `app-config.yaml` | Base configuration shared by all environments | ✅ |
| `app-config.production.yaml` | Overrides for in-cluster deployments | ✅ |
| `app-config.local.yaml` | Local overrides and credentials | ❌ |

Secrets are never stored in this repository. Configuration references them through environment variables (`${GITHUB_TOKEN}`), which are injected at runtime from Kubernetes secrets managed in Central Dogma.

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