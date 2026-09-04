// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createLogger } from "./logger-utils.js";
import { run } from "./cli.js";
import { currentDir, PreprodConfig } from "./config.js";
import { isDevcontainer, isProofServerRunning } from "./proof-server-utils.js";
import { DockerComposeEnvironment, Wait } from "testcontainers";
import path from "node:path";

const config = new PreprodConfig();
const logger = await createLogger(config.logDir);

if (await isProofServerRunning(config.proofServer)) {
  logger.info(
    `A proof server is already running at ${config.proofServer}; reusing it instead of starting a new one.`,
  );
  await run(config, logger);
} else {
  const dockerEnv = new DockerComposeEnvironment(
    path.resolve(currentDir, ".."),
    isDevcontainer() ? "proof-server.devcontainer.yml" : "proof-server.yml",
  )
    .withEnvironment({ DEVCONTAINER_HOST_ID: process.env.HOSTNAME ?? "" })
    .withWaitStrategy(
      "proof-server-1",
      Wait.forLogMessage(
        "Actix runtime found; starting in Actix runtime",
        1,
      ).withStartupTimeout(300_000),
    );
  await run(config, logger, dockerEnv);
}
