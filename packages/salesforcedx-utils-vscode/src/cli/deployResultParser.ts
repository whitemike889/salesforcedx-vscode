/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';

export const CONFLICT_ERROR_NAME = 'sourceConflictDetected';

export interface DeployResult {
  columnNumber?: string;
  error?: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  state?: string;
  type: string;
}

export interface ForceSourceDeployErrorResponse {
  message: string;
  name: string;
  result: DeployResult[];
  stack: string;
  status: number;
  warnings: any[];
}

export interface ForceSourceDeploySuccessResponse {
  status: number;
  result: {
    deployedSource: DeployResult[];
  };
}

export class ForceDeployResultParser {
  private response: any;

  constructor(stdOut: string) {
    const stdErrLines = stdOut.split(EOL);
    for (const line of stdErrLines) {
      if (line.trim().startsWith('{')) {
        this.response = JSON.parse(line);
        return;
      }
    }
    throw new Error('No JSON found in response');
  }

  public getErrors(): ForceSourceDeployErrorResponse | undefined {
    if (this.response.status === 1) {
      return this.response as ForceSourceDeployErrorResponse;
    }
  }

  public getSuccesses(): ForceSourceDeploySuccessResponse | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pushedSource } = result;
      if (pushedSource) {
        return { status, result: { deployedSource: pushedSource } };
      }
      return this.response as ForceSourceDeploySuccessResponse;
    }
    if (partialSuccess) {
      return { status, result: { deployedSource: partialSuccess } };
    }
  }

  public hasConflicts(): boolean {
    return (
      this.response.status === 1 && this.response.name === CONFLICT_ERROR_NAME
    );
  }
}
