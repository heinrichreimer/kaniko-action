import { info } from '@actions/core'
import { exec } from '@actions/exec'
import { mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve, relative } from 'path'

type Inputs = {
  executor: string
  cache: boolean
  cacheRepository: string
  cacheTTL: string
  pushRetry: string
  registryMirrors: string[]
  verbosity: string
  kanikoArgs: string[]
  buildArgs: string[]
  context: string
  file: string
  labels: string[]
  push: boolean
  tags: string[]
  target: string
  kubernetesNamespace: string
}

type Outputs = {
  digest: string
}

export async function run(inputs: Inputs): Promise<Outputs> {
  const contextDir = resolve(inputs.context)
  const dockerConfigDir = resolve('~/.docker')
  const runnerTempDir = process.env.RUNNER_TEMP || tmpdir()
  const outputsDir = await mkdtemp(join(runnerTempDir, 'kaniko-action-outputs'))

  // TODO: Build kaniko args
  const args = generateArgs(inputs)

  // TODO: Start executor pod
  // kubectl create -f kaniko.k8s.yml
  await exec('kubectl', ['apply', '-f', '-'], {
    input: Buffer.from(
      `
apiVersion: v1
kind: Pod
metadata:
  name: test-kaniko
  namespace: ajjxp
spec:
  initContainers:
    - name: prepare
      image: devodev/inotify:0.1.0
      command:
      - inotifywait
      - -e
      - create
      - /ready
      resources:
        limits:
          cpu: '0.2'
          memory: '10Mi'
      volumeMounts:
        - name: ready
          mountPath: /ready
        - name: docker-config
          mountPath: /docker-config
        - name: context
          mountPath: /context
  containers:
    - name: build
      image: gcr.io/kaniko-project/executor:v1.19.2
      args:
        - --context=dir:///context
        - --dockerfile=Dockerfile
        - --no-push
      resources:
        limits:
          cpu: '1'
          memory: '10Gi'
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker
        - name: context
          mountPath: /context
  volumes:
  - name: ready
    emptyDir:
      sizeLimit: 1Ki
  - name: docker-config
    emptyDir:
      sizeLimit: 1Gi
  - name: context
    emptyDir:
      sizeLimit: 100Gi
  restartPolicy: Never
      `,
      'utf8',
    ),
  })

  // TODO: Wait for exec container
  await delay(5000)

  // TODO: Upload build context
  // tar -czf - -C tests/fixtures/ . | kubectl exec -i test-kaniko -c prepare -- tar -xzf - -C /context
  await exec('sh', [
    '-c',
    `tar -czf - -C ${contextDir} . | kubectl exec -i test-kaniko -c prepare -- tar -xzf - -C /context`,
  ])

  // TODO: Upload .docker folder
  // tar -czf - -C ~/.docker/ . | kubectl exec -i test-kaniko -c prepare -- tar -xzf - -C /docker-config
  await exec('sh', [
    '-c',
    `tar -czf - -C ${dockerConfigDir} . | kubectl exec -i test-kaniko -c prepare -- tar -xzf - -C /docker-config`,
  ])

  // TODO: Create ready file
  // kubectl exec test-kaniko -c prepare -- touch /ready/yes
  await exec('kubectl', ['exec', 'test-kaniko', '-c', 'prepare', '--', 'touch', '/ready/yes'])

  // TODO: Wait for pod completion
  // kubectl wait pod test-kaniko --for condition=Ready --timeout=5m

  // TODO: Delete pod
  // kubectl delete pod test-kaniko

  // const start = Date.now()
  // await exec('go', args)
  // const end = Date.now()
  // const seconds = (end - start) / 1000
  // info(`Built in ${seconds}s`)

  const digest = (await readFile(`${outputsDir}/digest`)).toString().trim()
  info(digest)
  return { digest }
}

export function generateArgs(inputs: Inputs): string[] {
  const args = ['--context', `dir:///context`]

  if (inputs.file) {
    // The docker build command resolves the Dockerfile from the context root:
    // https://docs.docker.com/engine/reference/commandline/build/#specify-a-dockerfile--f
    const dockerfileInContext = relative(inputs.context, inputs.file)
    args.push('--dockerfile', dockerfileInContext)
  }
  for (const buildArg of inputs.buildArgs) {
    args.push('--build-arg', buildArg)
  }
  for (const label of inputs.labels) {
    args.push('--label', label)
  }
  if (!inputs.push) {
    args.push('--no-push')
  }
  for (const tag of inputs.tags) {
    args.push('--destination', tag)
  }
  if (inputs.target) {
    args.push('--target', inputs.target)
  }

  if (inputs.cache) {
    args.push('--cache=true')
    if (inputs.cacheRepository) {
      args.push('--cache-repo', inputs.cacheRepository)
    }
  }
  if (inputs.cacheTTL) {
    args.push('--cache-ttl', inputs.cacheTTL)
  }
  if (inputs.pushRetry) {
    args.push('--push-retry', inputs.pushRetry)
  }
  for (const mirror of inputs.registryMirrors) {
    args.push('--registry-mirror', mirror)
  }
  if (inputs.verbosity) {
    args.push('--verbosity', inputs.verbosity)
  }

  args.push(...inputs.kanikoArgs)
  return args
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
