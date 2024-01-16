import { info } from '@actions/core'
import { exec } from '@actions/exec'
import { mkdtemp, readFile, cp, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve, relative } from 'path'
import { c as compress } from 'tar'

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
  const contextDir = resolve(inputs.context)
  const dockerConfigDir = resolve('~/.docker')
  await mkdir(dockerConfigDir, {recursive: true})

  const tempDir = process.env.RUNNER_TEMP || tmpdir()
  const runnerTempDir = await mkdtemp(join(tempDir, 'kaniko-action'))
  const runnerTempFile = join(tempDir, 'kaniko-action.tar.gz')

  const startCp = Date.now()
  await cp(
    contextDir, join(runnerTempDir, 'context'), 
    { recursive: true}
    )
  await cp(
    dockerConfigDir, join(runnerTempDir, 'docker-config'),
     { recursive: true}
    )
  const endCp = Date.now()
  const secondsCp = (endCp - startCp) / 1000
  info(`Copied build context and Docker config in ${secondsCp}s.`)

  const startTar = Date.now()
  await compress( {
    gzip: true,
    cwd: runnerTempDir,
    file: runnerTempFile,
    },
    ['.'],
  )
  const endTar = Date.now()
  const secondsTar = (endTar - startTar) / 1000
  info(`Compressed build context and Docker config in ${secondsTar}s.`)

  const args = generateKubectlArgs(inputs)
  const start = Date.now()
  let output = '';
  await exec(
    'kubectl', 
    args, 
    {
      input: await readFile(runnerTempFile),
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
    },
  )
  const end = Date.now()
  const seconds = (end - start) / 1000
  info(`Built image in ${seconds}s.`)

  const digest = output.split('\n').filter(line => line.startsWith("sha256:"))[-1].trim()
  info(digest)
  return { digest }
}

export function generateKubectlArgs(inputs: Inputs): string[] {
  const kubectlRunCommands = generateKubectlRunCommands(inputs)
  const args = [
    'run',
    'kaniko',
    '--rm',
    '--stdin',
    `--image='${inputs.executor}'`,
    `--restart='Never'`,
    '--command',
    '--',
    'sh',
    '-c',
    kubectlRunCommands.join(' && ')
  ]
  return args
}

export function generateKubectlRunCommands(inputs: Inputs): string[] {
  const kanikoArgs = generateKanikoArgs(inputs)
  const commands = [
    "mkdir /inputs",
    "tar -xzf - -C /inputs",
    "cp -r /inputs/docker-config /kaniko/.docker",
    `/kaniko/executor ${kanikoArgs.join(' ')}`,
    'cat /outputs/digest',
    'echo',
  ]
  return commands
}

export function generateKanikoArgs(inputs: Inputs): string[] {
  const args = [
    '--context',
    'dir:///inputs/context',
    '--digest-file',
    '/outputs/digest',
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
