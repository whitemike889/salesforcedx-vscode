/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  DirFileNameSelection
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';
import {
  CompositeParametersGatherer,
  LightningFilePathExistsChecker,
  SelectFileName,
  SelectStrictDirPath,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

const LIGHTNING_EVT_EXTENSION = '.evt';

class ForceLightningEventCreateExecutor extends SfdxCommandletExecutor<
  DirFileNameSelection
> {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_event_create_text'))
      .withArg('force:lightning:event:create')
      .withFlag('--eventname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_event_create')
      .build();
  }

  public execute(response: ContinueResponse<DirFileNameSelection>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      if (
        data !== undefined &&
        data.toString() === '0' &&
        hasRootWorkspace()
      ) {
        vscode.workspace
          .openTextDocument(
            path.join(
              getRootWorkspacePath(),
              response.data.outputdir,
              // fileName is also used to create a subdirectory for the event in the aura directory
              response.data.fileName,
              response.data.fileName + LIGHTNING_EVT_EXTENSION
            )
          )
          .then(document => vscode.window.showTextDocument(document));
      }
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new SelectFileName();
const lightningFilePathExistsChecker = new LightningFilePathExistsChecker();

export async function forceLightningEventCreate(explorerDir?: any) {
  const outputDirGatherer = new SelectStrictDirPath(explorerDir, 'aura');
  const parameterGatherer = new CompositeParametersGatherer<
    DirFileNameSelection
  >(fileNameGatherer, outputDirGatherer);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceLightningEventCreateExecutor(),
    lightningFilePathExistsChecker
  );
  await commandlet.run();
}
