/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test } from '@jupyterlab/galata';

test.describe('Create and run notebook', () => {
  test('Can create, attach and run print() command', async ({ page }) => {
    // This is a slow integration test because it waits for a session to spin up.
    test.setTimeout(5 * 60 * 1000);
 //   await page.getByRole('region', { name: 'notebook content' }).click();

    await page
      .locator('.jp-LauncherCard:visible', {
        hasText: 'test12thMarchBuild on Serverless Spark (Remote)'
      })
      .click();

    const firstCodeBox = page
      .getByLabel('Untitled.ipynb')
      .getByRole('textbox')
      .locator('div')
      .first();

          const startTime2 = Date.now();
    const kernelStartingIndicator = page.locator('.jp-Notebook-ExecutionIndicator[data-status="starting"]');
    await kernelStartingIndicator.waitFor({ state: 'visible', timeout: 30000 });
    await kernelStartingIndicator.waitFor({ state: 'hidden', timeout: 5 * 60 * 1000 });

      const endTime2 = Date.now(); // Capture end time
     const executionTime2 = (endTime2 - startTime2) / 1000; // Convert to seconds

     console.log(`Execution Time1 = ${executionTime2} seconds`);

    await firstCodeBox.click();
    await firstCodeBox.fill("print('test output')");

    await page.getByRole('menuitem', { name: 'Run', exact: true }).click();
    await page
      .getByRole('menuitem', { name: 'Run All Cells', exact: true })
      .click();

    await page
      .locator('.jp-OutputArea-output', { hasText: 'test output' })
      .waitFor({ timeout: 5 * 60 * 1000 });
  });
});
