FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl wget git jq \
    smbclient \
    ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# PowerShell Core (pwsh) — opcional, por compatibilidad con scripts existentes
RUN wget -q "https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb" -O /tmp/ms.deb \
    && dpkg -i /tmp/ms.deb \
    && apt-get update \
    && apt-get install -y powershell \
    && rm /tmp/ms.deb \
    && rm -rf /var/lib/apt/lists/*

# GitHub Actions runner
ARG RUNNER_VERSION=2.334.0
RUN useradd -m runner
WORKDIR /home/runner
RUN curl -fsSL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    | tar xzf - \
    && ./bin/installdependencies.sh \
    && chown -R runner:runner /home/runner

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

USER runner
ENTRYPOINT ["./entrypoint.sh"]
