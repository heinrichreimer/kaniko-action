import { generateKanikoArgs } from '../src/run'

const defaultInputs = {
  executor: 'gcr.io/kaniko-project/executor:debug',
  cache: false,
  cacheRepository: '',
  cacheTTL: '',
  pushRetry: '',
  registryMirrors: [],
  verbosity: '',
  kanikoArgs: [],
  buildArgs: [],
  context: '',
  file: '',
  labels: [],
  push: false,
  tags: [],
  target: '',
}

test('default args', () => {
  const args = generateKanikoArgs(defaultInputs)
  expect(args).toStrictEqual(['--context', 'dir:///inputs/context', '--digest-file', '/outputs/digest', '--no-push'])
})

test('full args', () => {
  const args = generateKanikoArgs({
    executor: 'gcr.io/kaniko-project/executor:debug',
    cache: true,
    cacheRepository: 'ghcr.io/janheinrichmerker/kaniko-action/cache',
    cacheTTL: '30d',
    pushRetry: '100',
    registryMirrors: ['mirror.example.com', 'mirror.gcr.io'],
    verbosity: 'debug',
    kanikoArgs: ['--skip-tls-verify', '--help'],
    buildArgs: ['foo=1', 'bar=2'],
    context: 'foo/bar',
    file: 'foo/bar/baz/my.Dockerfile',
    labels: ['org.opencontainers.image.description=foo', 'org.opencontainers.image.url=https://example.com'],
    push: false,
    tags: ['helloworld:latest', 'ghcr.io/janheinrichmerker/kaniko-action/example:1.0.0'],
    target: 'server',
  })
  expect(args).toStrictEqual([
    '--context',
    'dir:///inputs/context',
    '--digest-file',
    '/outputs/digest',
    '--dockerfile',
    'baz/my.Dockerfile',
    '--build-arg',
    'foo=1',
    '--build-arg',
    'bar=2',
    '--label',
    'org.opencontainers.image.description=foo',
    '--label',
    'org.opencontainers.image.url=https://example.com',
    '--no-push',
    '--destination',
    'helloworld:latest',
    '--destination',
    'ghcr.io/janheinrichmerker/kaniko-action/example:1.0.0',
    '--target',
    'server',
    '--cache=true',
    '--cache-repo',
    'ghcr.io/janheinrichmerker/kaniko-action/cache',
    '--cache-ttl',
    '30d',
    '--push-retry',
    '100',
    '--registry-mirror',
    'mirror.example.com',
    '--registry-mirror',
    'mirror.gcr.io',
    '--verbosity',
    'debug',
    '--skip-tls-verify',
    '--help',
  ])
})

test('with dockerfile', () => {
  const args = generateKanikoArgs({
    ...defaultInputs,
    file: 'my.Dockerfile',
  })
  expect(args).toStrictEqual([
    '--context',
    'dir:///inputs/context',
    '--digest-file',
    '/outputs/digest',
    '--dockerfile',
    'my.Dockerfile',
    '--no-push',
  ])
})
