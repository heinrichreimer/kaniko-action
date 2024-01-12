import { getInput, getBooleanInput, getMultilineInput, setOutput, setFailed } from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    executor: getInput('executor', { required: true }),
    cache: getBooleanInput('cache'),
    cacheRepository: getInput('cache-repository'),
    cacheTTL: getInput('cache-ttl'),
    pushRetry: getInput('push-retry'),
    registryMirrors: getMultilineInput('registry-mirror'),
    verbosity: getInput('verbosity'),
    kanikoArgs: getMultilineInput('kaniko-args'),
    buildArgs: getMultilineInput('build-args'),
    context: getInput('context'),
    file: getInput('file'),
    labels: getMultilineInput('labels'),
    push: getBooleanInput('push'),
    tags: getMultilineInput('tags'),
    target: getInput('target'),
  })
  setOutput('digest', outputs.digest)
}

main().catch((e: Error) => {
  setFailed(e)
  console.error(e)
})
