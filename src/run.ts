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
}

type Outputs = {
  digest: string
}

export async function run(inputs: Inputs): Promise<Outputs> {
  const runnerTempDir = process.env.RUNNER_TEMP || tmpdir()
  const outputsDir = await mkdtemp(join(runnerTempDir, 'kaniko-action'))

  const args = generateArgs(inputs, outputsDir)

  const start = Date.now()
  await exec('go', args)
  const end = Date.now()
  const seconds = (end - start) / 1000
  info(`Built in ${seconds}s`)

  const digest = (await readFile(`${outputsDir}/digest`)).toString().trim()
  info(digest)
  return { digest }
}

function generateArgs(inputs: Inputs, outputsDir: string): string[] {
  const args = [
    // go args
    'run',
    'github.com/GoogleContainerTools/kaniko/cmd/executor@v1.19.2',
    // kaniko args
    '--context',
    `dir://${resolve(inputs.context)}`,
    '--digest-file',
    `${outputsDir}/digest`,
  ]

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
