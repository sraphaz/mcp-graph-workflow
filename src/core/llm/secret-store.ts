/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-credential-pool — Task 1.3: SecretStore contract + EnvVarSecretStore.
 *
 * Concrete backends (AWS Secrets Manager, Vault, etc.) live in their own PRD.
 * EnvVarSecretStore is the dev-local default — reads process.env[secretRef].
 */

import { McpGraphError } from "../utils/errors.js";

export interface SecretStore {
  resolve(secretRef: string): Promise<string>;
  rotate(secretRef: string, newValue: string): Promise<void>;
}

export class EnvVarSecretStore implements SecretStore {
  async resolve(secretRef: string): Promise<string> {
    const value = process.env[secretRef];
    if (value === undefined || value === "") {
      throw new McpGraphError(`Secret not found: ${secretRef}`);
    }
    return value;
  }

  async rotate(secretRef: string, newValue: string): Promise<void> {
    process.env[secretRef] = newValue;
  }
}
