ARG VARIANT="16-buster"
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-${VARIANT}
COPY . ./src
WORKDIR /src

RUN npm install

CMD ["bin/bash"]