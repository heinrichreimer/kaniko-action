[![CI](https://img.shields.io/github/actions/workflow/status/heinrichreimer/kaniko-action/ci.yml?branch=main&style=flat-square)](https://github.com/heinrichreimer/kaniko-action/actions/workflows/ci.yml)
[![GitHub Tag](https://img.shields.io/github/v/tag/heinrichreimer/kaniko-action?sort=semver&style=flat-square)](https://github.com/heinrichreimer/kaniko-action/releases)
[![Issues](https://img.shields.io/github/issues/heinrichreimer/kaniko-action?style=flat-square)](https://github.com/heinrichreimer/kaniko-action/issues)
[![Commit activity](https://img.shields.io/github/commit-activity/m/heinrichreimer/kaniko-action?style=flat-square)](https://github.com/heinrichreimer/kaniko-action/commits)
[![License](https://img.shields.io/github/license/heinrichreimer/kaniko-action?style=flat-square)](LICENSE)

# 📦 kaniko-action

[GitHub Action](https://github.com/features/actions) to build and push container images with [Kaniko](https://github.com/GoogleContainerTools/kaniko).

This action uses [Go](https://go.dev/) to execute Kaniko and so neither relies on Docker to build the action (e.g., as [aevea/action-kaniko](https://github.com/aevea/action-kaniko) does) nor to execute Kaniko itself (e.g., like [int128/kaniko-action](https://github.com/int128/kaniko-action)).
Hence, it can be used with [self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners) that are scheduled in container environments such as [Kubernetes](https://kubernetes.io/).

This action is also compatible with the Docker's official actions such as [docker/login-action](https://github.com/docker/login-action) or [docker/metadata-action](https://github.com/docker/metadata-action).

## Usage

A minimal example to build a Docker image is given below:

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: heinrichreimer/kaniko-action@v1
```

### Push to registry

Push the built image to a container registry:

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: docker/login-action@v1
        with:
          registry: registry.example.com
          username: foo
          password: bar
      - uses: heinrichreimer/kaniko-action@v1
        with:
          push: true
          tags: registry.example.com/my-image
```

### Metadata

Include metadata about the repository the image is built from, using the [docker/metadata-action](https://github.com/docker/metadata-action):

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: docker/metadata-action@v3
        id: metadata
        with:
          images: registry.example.com/my-image
      - uses: heinrichreimer/kaniko-action@v1
        with:
          tags: ${{ steps.metadata.outputs.tags }}
          labels: ${{ steps.metadata.outputs.labels }}
```

### Caching

Kaniko supports layer caching with a remote repository such as GHCR or Amazon ECR.
Refer to [the Kaniko documentation](https://github.com/GoogleContainerTools/kaniko#caching) for details.

To enable caching, just set a cache repository.

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: docker/login-action@v1
        with:
          registry: registry.example.com
          username: foo
          password: bar
      - uses: heinrichreimer/kaniko-action@v1
        with:
          cache: true
          cache-repository: registry.example.com/my-image/cache
```

### Using the image digest

This action outputs the digest of the built image, for example, `${{ steps.image.outputs.digest }}` would evaluate to something like `sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` in the following example:

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: heinrichreimer/kaniko-action@v1
        id: image
      - run: echo ${{ steps.image.outputs.digest }}

```

The digest can be used to construct an image URI, if you want to [deploy your image](#build-and-deploy-to-aws).
For example, `ghcr.io/${{ github.repository }}@${{ steps.image.outputs.digest }}` would evaluate to something like `ghcr.io/username/repository@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`.

## Specification

This action runs the Kaniko executor via the `go run` command.
The exact inputs and outputs are given below.

### Inputs

This action supports the below inputs.
See also the flags of the [Kaniko executor](https://github.com/GoogleContainerTools/kaniko).

| Name | Description | Corresponding flag|
|---|---|---|
| `context`<sup>*</sup> | Path to the build context. Default to the workspace | - |
| `file`<sup>*</sup> | Path to the Dockerfile. Default to `Dockerfile`. It must be in the context. If set, this action passes the relative path to Kaniko, same as the behavior of [`docker build`](https://docs.docker.com/engine/reference/commandline/build/) | `--dockerfile` |
| `build-args`<sup>*</sup> | List of build args | `--build-arg` |
| `labels`<sup>*</sup> | List of metadata for an image | `--label` |
| `push`<sup>*</sup> | Push an image to the registry. Default to false | `--no-push` |
| `tags`<sup>*</sup> | List of tags | `--destination` |
| `target`<sup>*</sup> | Target stage to build | `--target` |
| `cache` | Enable caching layers | `--cache` |
| `cache-repository` | Repository for storing cached layers | `--cache-repo` |
| `cache-ttl` | Cache timeout | `--cache-ttl` |
| `push-retry` | Number of retries for the push of an image | `--push-retry` |
| `registry-mirror` | Use registry mirror(s) | `--registry-mirror` |
| `verbosity` | Set the logging level | `--verbosity` |
| `kaniko-version` | Version of the Kaniko executor. Default to `1.19.2` | - |
| `kaniko-args` | Extra args to the Kaniko executor | - |

<sup>*</sup> These inputs are compatible with [docker/build-push-action](https://github.com/docker/build-push-action).

### Outputs

| Name | Description | Example |
|---|---|---|
| `digest` | Image digest | `sha256:abcdef...` |

## Examples

### Build a multi-architecture image

We can build a multi-architecture image such as `amd64` and `arm64` on self-hosted runners in GitHub Actions.
For details, see @int128's fantastic [docker-manifest-create-action](https://github.com/int128/docker-manifest-create-action).

### Build and push to the GitHub Container Registry

Here is an example to build and push a container image to the [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry):

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: docker/metadata-action@v3
        id: metadata
        with:
          images: ghcr.io/${{ github.repository }}
      - uses: docker/login-action@v1
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: heinrichreimer/kaniko-action@v1
        with:
          push: true
          tags: ${{ steps.metadata.outputs.tags }}
          labels: ${{ steps.metadata.outputs.labels }}
          cache: true
          cache-repository: ghcr.io/${{ github.repository }}/cache
```

### Build and push to Amazon ECR

To build and push a container image to Amazon ECR, use:

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/ROLE
      - uses: aws-actions/amazon-ecr-login@v1
        id: ecr
      - uses: docker/metadata-action@v4
        id: metadata
        with:
          images: ${{ steps.ecr.outputs.registry }}/${{ github.repository }}
      - uses: heinrichreimer/kaniko-action@v1
        with:
          push: true
          tags: ${{ steps.metadata.outputs.tags }}
          labels: ${{ steps.metadata.outputs.labels }}
          cache: true
          cache-repository: ${{ steps.ecr.outputs.registry }}/${{ github.repository }}/cache
```

### Build and deploy to AWS

Here is an example workflow to build and deploy an application.

```yaml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/amazon-ecr-login@v1
        id: ecr
      - uses: docker/metadata-action@v4
        id: metadata
        with:
          images: ${{ steps.ecr.outputs.registry }}/${{ github.repository }}
      - uses: heinrichreimer/kaniko-action@v1
        id: build
        with:
          push: true
          tags: ${{ steps.metadata.outputs.tags }}
          labels: ${{ steps.metadata.outputs.labels }}
          cache: true
          cache-repository: ${{ steps.ecr.outputs.registry }}/${{ github.repository }}/cache
      - run: kustomize edit set image myapp=${{ steps.ecr.outputs.registry }}/${{ github.repository }}@${{ steps.build.outputs.digest }}
      - run: kustomize build | kubectl apply -f -
```

## Development

To build this package and contribute to its development you need to install [Yarn](https://yarnpkg.com/):

### Installation

Install package and test dependencies:

```shell
yarn install
```

### Testing

Verify your changes against the test suite to verify.

```shell
yarn format-check  # Code format
yarn lint  # LINT errors
yarn test  # Unit tests
```

Please also add tests for your newly developed code.

### Build package

This package can be built with:

```shell
yarn package
```

## Support

If you hit any problems using this package, please file an [issue](https://github.com/heinrichreimer/kaniko-action/issues/new).
I'm happy to help!

## License

This repository is released under the [Apache 2.0 license](LICENSE).
