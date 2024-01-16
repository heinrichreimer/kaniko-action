#!/usr/bin/env sh

mkdir -p /tmp/kaniko-inputs && \
rm -r /tmp/kaniko-inputs && \
mkdir /tmp/kaniko-inputs && \
cp -r /home/heinrich/Repositories/kaniko-action/tests/fixtures /tmp/kaniko-inputs/context && \
cp -r /home/heinrich/.docker /tmp/kaniko-inputs/docker-config && \
tar -czf - -C /tmp/kaniko-inputs . | \
kubectl run kaniko \
    --rm \
    --stdin \
    --image='gcr.io/kaniko-project/executor:v1.19.2-debug' \
    --restart='Never' \
    --output yaml \
    --command -- \
    sh -c '
        mkdir /inputs && \
        tar -xzf - -C /inputs && \
        cp -r /inputs/docker-config /kaniko/.docker && \
        /kaniko/executor \
            --context=dir:///inputs/context \
            --dockerfile=Dockerfile \
            --no-push \
            --digest-file /outputs/digest && \
        cat /outputs/digest && \
        echo'
