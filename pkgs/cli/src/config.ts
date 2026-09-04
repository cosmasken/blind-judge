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

import path from "node:path";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { DEFAULT_PROOF_SERVER_URL, MIDNIGHT_NETWORK_ENDPOINTS } from "shared";
export const currentDir = path.resolve(new URL(import.meta.url).pathname, "..");

export interface Config {
  readonly logDir: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

const logDirFor = (network: string) =>
  path.resolve(
    currentDir,
    "..",
    "logs",
    network,
    `${new Date().toISOString()}.log`,
  );

export class StandaloneConfig implements Config {
  logDir = logDirFor("standalone");
  indexer = "http://127.0.0.1:8088/api/v3/graphql";
  indexerWS = "ws://127.0.0.1:8088/api/v3/graphql/ws";
  node = "http://127.0.0.1:9944";
  proofServer = DEFAULT_PROOF_SERVER_URL;
  constructor() {
    setNetworkId("undeployed");
  }
}

export class PreviewConfig implements Config {
  logDir = logDirFor("preview");
  indexer = MIDNIGHT_NETWORK_ENDPOINTS.preview.indexer;
  indexerWS = MIDNIGHT_NETWORK_ENDPOINTS.preview.indexerWS;
  node = MIDNIGHT_NETWORK_ENDPOINTS.preview.node;
  proofServer = DEFAULT_PROOF_SERVER_URL;
  constructor() {
    setNetworkId("preview");
  }
}

export class PreprodConfig implements Config {
  logDir = logDirFor("preprod");
  indexer = MIDNIGHT_NETWORK_ENDPOINTS.preprod.indexer;
  indexerWS = MIDNIGHT_NETWORK_ENDPOINTS.preprod.indexerWS;
  node = MIDNIGHT_NETWORK_ENDPOINTS.preprod.node;
  proofServer = DEFAULT_PROOF_SERVER_URL;
  constructor() {
    setNetworkId("preprod");
  }
}
