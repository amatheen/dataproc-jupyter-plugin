/**
 * @license
 * Copyright 2024 Google LLC
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

import { expect, test } from '@jupyterlab/galata';
import { Locator, Page } from '@playwright/test';

test.describe('Clusters & Jobs tests', () => {
  // Set a common timeout for all tests
  const TEST_TIMEOUT = 5 * 60 * 1000;

  const CLUSTER_HEADERS = [
    'Name',
    'Status',
    'Cluster image name',
    'Region',
    'Zone',
    'Total worker nodes',
    'Scheduled deletion',
    'Actions'
  ];

  const JOB_HEADERS = [
    'Job ID',
    'Status',
    'Region',
    'Type',
    'Start time',
    'Elapsed time',
    'Labels',
    'Actions'
  ];

  // Helper function to navigate to Clusters page
  async function navigateToClusters(page: Page): Promise<void> {
    const clusterCard = page.locator('[data-category="Google Cloud Resources"][title="Clusters"]');
    await clusterCard.click();
    await page.getByText('Loading Clusters').waitFor({ state: 'detached' });
  }

  // Helper function to navigate to Jobs tab
  async function navigateToJobs(page: Page): Promise<void> {
    await navigateToClusters(page);
    await page.getByRole('tabpanel').getByText('Jobs', { exact: true }).click();
    await page.getByText('Loading Jobs').waitFor({ state: 'detached' });
  }

  // Helper function to select the first available cluster in dropdown
  async function selectCluster(page: Page): Promise<boolean> {
    await page.getByRole('combobox', { name: 'Cluster*' }).click();
    const options = page.getByRole('option');
    const count = await options.count();
    if (count > 0) {
      await options.first().click();
      return true;
    }
    return false;
  }

  // Helper function to fill the Labels section
  async function fillLabels(page: Page): Promise<void> {
    await expect(page.locator('.submit-job-label-header', { hasText: 'Labels' })).toBeVisible();
    await expect(page.locator('//label[text()="Key 1*"]/following-sibling::div/input[@value="client"]')).toBeVisible();
    await expect(page.locator('//label[text()="Value 1"]/following-sibling::div/input[@value="bigquery-jupyter-plugin"]')).toBeVisible();
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').fill('goog-dataproc-location');
    await page.getByLabel('Value 2').fill('us-central1');
  }

  // Helper function to submit the job and validate submission
  async function submitJobAndValidate(page: Page, jobId: string): Promise<void> {
    await page.getByRole('button', { name: 'SUBMIT' }).click();
    await expect(page.getByText(`Job ${jobId} successfully submitted`)).toBeVisible({ timeout: 30000 });
  }

  test('Sanity: Can verify tabs and fields on the page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    // Verify Clusters and Jobs tabs
    await expect(page.getByRole('tabpanel').getByText('Clusters', { exact: true })).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('Jobs', { exact: true })).toBeVisible();

    // Verify Create Cluster button
    await expect(page.getByRole('button', { name: 'Create cluster' })).toBeVisible();

    // Check if cluster table data is present or empty state
    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Check search filter field is present
      await expect(page.getByPlaceholder('Filter Table')).toBeVisible();

      // Check list of clusters are displayed
      const rowCount = await page.locator('table.clusters-list-table tr').count();
      expect(rowCount).toBeGreaterThan(0);
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Sanity: Can verify clusters table headers', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    // Check clusters table headers if table data is present
    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      for (const header of CLUSTER_HEADERS) {
        await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Sanity: Can click on Cluster and validate the cluster details', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    // Check if clusters table data is present
    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      const clusterLocator = page.locator('.cluster-name').first();
      const clusterName = await clusterLocator.innerText();
      await clusterLocator.click();
      await page.getByText('Loading Cluster Details').waitFor({ state: 'detached' });

      // Verify cluster details elements
      await expect(page.locator('.back-arrow-icon, [aria-label="back-arrow-icon"]').first()).toBeVisible();
      await expect(page.getByText('Cluster details')).toBeVisible();
      await expect(page.getByRole('button', { name: 'START', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'STOP', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'VIEW CLOUD LOGS', exact: true })).toBeVisible();
      await expect(page.locator('.cluster-details-label', { hasText: 'Name' })).toBeVisible();
      await expect(page.locator('.cluster-details-value', { hasText: clusterName }).first()).toBeVisible();
      await expect(page.getByText('Cluster UUID', { exact: true })).toBeVisible();
      await expect(page.getByText('Type', { exact: true })).toBeVisible();
      await expect(page.getByText('Status', { exact: true }).first()).toBeVisible();
      await expect(page.locator('.cluster-details-title', { hasText: 'Jobs' })).toBeVisible();

      // Wait for jobs sub-table to load and verify elements
      await page.getByText('Loading Jobs').waitFor({ state: 'detached' }).catch(() => {});
      await expect(page.getByRole('button', { name: 'SUBMIT JOB', exact: true })).toBeVisible();

      const noRows = await page.getByText('No rows to display').isVisible();
      if (!noRows) {
        for (const header of JOB_HEADERS) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test.skip('Can start, restart, and stop the cluster from cluster listing page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    // Check if clusters table data is present
    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      const validateStart = async (row: Locator) => {
        const startBtn = row.locator('div[title="Start Cluster"]');
        await expect(startBtn).toBeEnabled();
        await startBtn.click();
        await row.getByText('stopped').waitFor({ state: 'detached' }).catch(() => { });
        await expect(row.getByText('running')).toBeVisible({ timeout: 120000 });
      };

      const validateRestart = async (row: Locator) => {
        const restartBtn = row.locator('div[title="Restart Cluster"]');
        await expect(restartBtn).toBeEnabled();
        await restartBtn.click();
        await row.getByText('running').waitFor({ state: 'detached' }).catch(() => { });
        await expect(row.getByText('running')).toBeVisible({ timeout: 120000 });
      };

      const validateStop = async (row: Locator) => {
        const stopBtn = row.locator('div[title="Stop Cluster"]');
        await expect(stopBtn).toBeEnabled();
        await stopBtn.click();
        await row.getByText('running').waitFor({ state: 'detached' }).catch(() => { });
        await expect(row.getByText('stopped')).toBeVisible({ timeout: 120000 });
      };

      const validateFlow = async (targetRow: Locator, isStopped: boolean) => {
        const startBtn = targetRow.locator('div[title="Start Cluster"]');
        const restartBtn = targetRow.locator('div[title="Restart Cluster"]');
        const stopBtn = targetRow.locator('div[title="Stop Cluster"]');

        await expect(startBtn).toBeVisible();
        await expect(restartBtn).toBeVisible();
        await expect(stopBtn).toBeVisible();

        if (isStopped) {
          // Validate the flow in order: Start → Restart → Stop
          await validateStart(targetRow);
          await validateRestart(targetRow);
          await validateStop(targetRow);
        } else {
          // Validate the flow in order: Stop → Start → Restart
          await validateStop(targetRow);
          await validateStart(targetRow);
          await validateRestart(targetRow);
        }
      };

      const getTargetRow = async (selectedRow: Locator): Promise<Locator> => {
        const clusterName = (await selectedRow.locator('.cluster-name').innerText()).trim();
        const escapedName = clusterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return clusterName
          ? page.locator('tr.cluster-list-data-parent').filter({
              has: page.locator('.cluster-name').filter({ hasText: new RegExp(`^${escapedName}$`) })
            })
          : selectedRow;
      };

      const clusterRows = page.locator('tr.cluster-list-data-parent');
      const count = await clusterRows.count();

      if (count === 0) {
        // Case 1: 0 Clusters Present
        await expect(page.getByText('No rows to display')).toBeVisible();
      } else if (count === 1) {
        // Case 2: Exactly 1 Cluster Present
        // Check the current cluster status:
        const selectedRow = clusterRows.first();
        const targetRow = await getTargetRow(selectedRow);

        const statusText = (await targetRow.locator('.cluster-status').textContent())?.trim().toLowerCase();
        const isStartEnabled = (await targetRow.locator('div[title="Start Cluster"]').getAttribute('aria-disabled')) === 'false';
        const isStopped = statusText === 'stopped' || isStartEnabled;

        if (isStopped) {
          // If Stopped: Validate the flow in order: Start → Restart → Stop.
          await validateFlow(targetRow, true);
        } else {
          // If Running: Validate the flow in order: Stop → Start → Restart.
          await validateFlow(targetRow, false);
        }
      } else {
        // Case 3: Greater Than 1 Cluster Present
        // Inspect the status across all visible clusters:
        let stoppedRowIndex = -1;
        for (let i = 0; i < count; i++) {
          const row = clusterRows.nth(i);
          const statusText = (await row.locator('.cluster-status').textContent())?.trim().toLowerCase();
          const isStartEnabled = (await row.locator('div[title="Start Cluster"]').getAttribute('aria-disabled')) === 'false';
          if (statusText === 'stopped' || isStartEnabled) {
            stoppedRowIndex = i;
            break;
          }
        }

        if (stoppedRowIndex !== -1) {
          // If any cluster is in Stopped state: Select the first stopped cluster found, then validate: Start → Restart → Stop.
          const selectedRow = clusterRows.nth(stoppedRowIndex);
          const targetRow = await getTargetRow(selectedRow);
          await validateFlow(targetRow, true);
        } else {
          // If all clusters are running (no stopped clusters found): Select the 1st cluster in the list, then validate: Stop → Start → Restart.
          const selectedRow = clusterRows.first();
          const targetRow = await getTargetRow(selectedRow);
          await validateFlow(targetRow, false);
        }
      }
    } else {
      // Case 1: 0 Clusters Present
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can verify cluster action controls and delete popup from cluster details page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Open first cluster details
      const firstCluster = page.locator('.cluster-name').first();
      const clusterName = await firstCluster.innerText();
      await firstCluster.click();
      await page.getByText('Loading Cluster Details').waitFor({ state: 'detached' });

      // Verify START, STOP, and DELETE action buttons in header
      const startAction = page.locator('.action-cluster-section', { hasText: 'START' });
      const stopAction = page.locator('.action-cluster-section', { hasText: 'STOP' });
      const deleteAction = page.locator('.action-cluster-section', { hasText: 'DELETE' });

      await expect(startAction).toBeVisible();
      await expect(stopAction).toBeVisible();
      await expect(deleteAction).toBeVisible();

      // Click DELETE button and verify confirmation dialog
      await deleteAction.click();
      await expect(page.getByText(`This will delete ${clusterName} and cannot be undone.`)).toBeVisible();

      // Cancel deletion
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();

      // Dialog closes, back to details
      await expect(page.getByText('Cluster details')).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate Filter Table search field on cluster listing page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    // Check if clusters table data is present
    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      const firstClusterLocator = page.locator('.cluster-name').first();
      const clusterName = await firstClusterLocator.innerText();

      const filterInput = page.getByPlaceholder('Filter Table');
      await filterInput.fill(clusterName);

      // Verify filtered rows count (header row + filtered data row = 2)
      const rowCount = await page.locator('table.clusters-list-table tr').count();
      expect(rowCount).toEqual(2);

      // Clear filter
      await filterInput.fill('');
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can verify jobs table headers', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    // Verify SUBMIT JOB button
    await expect(page.getByRole('button', { name: 'SUBMIT JOB', exact: true })).toBeVisible();

    const noRows = await page.getByText('No rows to display').isVisible();
    if (noRows) {
      await expect(page.getByText('No rows to display')).toBeVisible();
    } else {
      await expect(page.locator('table.clusters-list-table')).toBeVisible();
      for (const header of JOB_HEADERS) {
        await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
      }
    }
  });

  test('Can click on Job ID and validate the details', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    // Check if jobs table data is present
    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      const firstJobLocator = page.locator('.cluster-name').first();
      const jobName = await firstJobLocator.innerText();
      await firstJobLocator.click();

      // Wait for Job Details to load
      await page.getByText('Loading Job Details').waitFor({ state: 'detached' });

      // Verify Job details elements
      await expect(page.locator('.back-arrow-icon, [aria-label="back-arrow-icon"]').first()).toBeVisible();
      await expect(page.getByText('Job details')).toBeVisible();
      await expect(page.getByRole('button', { name: 'CLONE', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'STOP', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'DELETE', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'VIEW SPARK LOGS', exact: true })).toBeVisible();
      await expect(page.getByText('Job ID', { exact: true })).toBeVisible();
      await expect(page.locator('.cluster-details-value', { hasText: jobName }).first()).toBeVisible();
      await expect(page.getByText('Job UUID', { exact: true })).toBeVisible();
      await expect(page.getByText('Type', { exact: true })).toBeVisible();
      await expect(page.getByText('Status', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Configuration', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'EDIT' })).toBeVisible();
      await expect(page.getByText('Start time:')).toBeVisible();
      await expect(page.getByText('Elapsed time:')).toBeVisible();
      await expect(page.getByText('Region')).toBeVisible();
      await expect(page.getByText('Cluster', { exact: true })).toBeVisible();
      await expect(page.getByText('Job type')).toBeVisible();
      await expect(page.getByText('Labels', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can verify clone a job from job details page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click on first Job id
      const firstJobLocator = page.locator('.cluster-name').first();
      await firstJobLocator.click();

      // Wait for Job Details to load
      await page.getByText('Loading Job Details').waitFor({ state: 'detached' });

      // Click on clone button
      await page.getByRole('button', { name: 'CLONE' }).click();

      // Capture job id and submit
      const jobId = await page.getByLabel('Job ID*').inputValue();
      await page.getByRole('button', { name: 'SUBMIT' }).click();

      await expect(page.getByText(`Job ${jobId} successfully submitted`)).toBeVisible({ timeout: 30000 });
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can verify clone a job from job listing page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click on clone button in actions column
      await page.getByRole('button', { name: 'CLONE' }).first().click();

      // Capture job id and submit
      const jobId = await page.getByLabel('Job ID*').inputValue();
      await page.getByRole('button', { name: 'SUBMIT' }).click();

      await expect(page.getByText(`Job ${jobId} successfully submitted`)).toBeVisible({ timeout: 30000 });
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can delete a job from job details page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Get the first job ID and click to open details
      const firstJobCell = page.locator('.cluster-name').first();
      const jobId = await firstJobCell.innerText();
      await firstJobCell.click();
      await page.getByText('Loading Job Details').waitFor({ state: 'detached' });

      // Click the delete button, confirm deletion, and verify success message
      await page.getByRole('button', { name: 'DELETE', exact: true }).click();
      await expect(page.getByText(`This will delete ${jobId} and cannot be undone.`)).toBeVisible();
      await page.getByRole('button', { name: 'Delete' }).click();

      await expect(page.getByText(`Job ${jobId} deleted successfully`)).toBeVisible({ timeout: 30000 });
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate fields and create a Spark job', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click the SUBMIT JOB button
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      // Select cluster
      const clusterSelected = await selectCluster(page);
      if (clusterSelected) {
        // Capture Job ID and verify default job type
        const jobId = await page.getByLabel('Job ID*').inputValue();
        const jobType = await page.getByLabel('Job type*').inputValue();
        expect(jobType).toBe('Spark');

        // Verify fields
        await expect(page.getByLabel('Main class or jar*')).toBeVisible();
        await page.getByLabel('Main class or jar*').fill('gs://dataproc-extension/DO NOT DELETE/helloworld-2.0.jar');
        await expect(page.getByLabel('Jar files')).toBeVisible();
        await expect(page.getByLabel('Files', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Archive files')).toBeVisible();
        await expect(page.getByLabel('Arguments')).toBeVisible();
        await expect(page.getByLabel('Max restarts per hour')).toBeVisible();

        // Fill the Labels section
        await fillLabels(page);

        // Submit the job and validate
        await submitJobAndValidate(page, jobId);
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate fields and create a SparkR job', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click the SUBMIT JOB button
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      const clusterSelected = await selectCluster(page);
      if (clusterSelected) {
        const jobId = await page.getByLabel('Job ID*').inputValue();

        // Change job type to SparkR
        await page.getByLabel('Open', { exact: true }).nth(1).click();
        await page.getByRole('option', { name: 'SparkR' }).click();

        // Verify fields and fill necessary inputs
        await expect(page.getByLabel('Main R file*')).toBeVisible();
        await page.getByLabel('Main R file*').fill('gs://dataproc-extension/DO NOT DELETE/helloworld.r');
        await expect(page.getByLabel('Files', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Arguments')).toBeVisible();
        await expect(page.getByLabel('Max restarts per hour')).toBeVisible();

        // Fill the Labels section
        await fillLabels(page);

        // Submit the job and validate
        await submitJobAndValidate(page, jobId);
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate fields and create a SparkSql job with Query file', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click the SUBMIT JOB button
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      const clusterSelected = await selectCluster(page);
      if (clusterSelected) {
        const jobId = await page.getByLabel('Job ID*').inputValue();

        // Change job type to SparkSql
        await page.getByLabel('Open', { exact: true }).nth(1).click();
        await page.getByRole('option', { name: 'SparkSql' }).click();

        await expect(page.getByLabel('Jar files')).toBeVisible();
        await expect(page.getByLabel('Max restarts per hour')).toBeVisible();

        // Select query source type: Query file
        await page.getByRole('combobox', { name: 'Query source type*' }).click();
        await page.getByRole('option', { name: 'Query file' }).click();
        await page.getByLabel('Query file*').fill('gs://dataproc-extension/DO NOT DELETE/sampleSQL.sql');

        // Fill the Labels section
        await fillLabels(page);

        // Submit the job and validate
        await submitJobAndValidate(page, jobId);
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate fields and create a SparkSql job with Query text', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click the SUBMIT JOB button
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      const clusterSelected = await selectCluster(page);
      if (clusterSelected) {
        const jobId = await page.getByLabel('Job ID*').inputValue();

        // Change job type to SparkSql
        await page.getByLabel('Open', { exact: true }).nth(1).click();
        await page.getByRole('option', { name: 'SparkSql' }).click();

        // Select query source type: Query text
        await page.getByRole('combobox', { name: 'Query source type*' }).click();
        await page.getByRole('option', { name: 'Query text' }).click();

        // Fill Query text field
        const queryTextInput = page.getByLabel('Query text*');
        await expect(queryTextInput).toBeVisible();
        await queryTextInput.fill('SELECT 1;');

        // Fill the Labels section
        await fillLabels(page);

        // Submit the job and validate
        await submitJobAndValidate(page, jobId);
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate fields and create a PySpark job', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click the SUBMIT JOB button
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      const clusterSelected = await selectCluster(page);
      if (clusterSelected) {
        const jobId = await page.getByLabel('Job ID*').inputValue();

        // Change job type to PySpark
        await page.getByLabel('Open', { exact: true }).nth(1).click();
        await page.getByRole('option', { name: 'PySpark' }).click();

        // Verify fields
        await expect(page.getByLabel('Additional python files')).toBeVisible();
        await expect(page.getByLabel('Jar files')).toBeVisible();
        await expect(page.getByLabel('Files', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Archive files')).toBeVisible();
        await expect(page.getByLabel('Arguments')).toBeVisible();
        await expect(page.getByLabel('Max restarts per hour')).toBeVisible();

        // Fill Main Python file and Labels
        await expect(page.getByLabel('Main Python file*')).toBeVisible();
        await page.getByLabel('Main Python file*').fill('gs://dataproc-extension/DO NOT DELETE/helloworld1.py');
        await fillLabels(page);

        // Submit the job and validate
        await submitJobAndValidate(page, jobId);
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Sanity: Can perform field validations', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click the SUBMIT JOB button
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      // Job ID field validation: Empty field should show error
      await page.getByLabel('Job ID*').fill('');
      await expect(page.getByText('ID is required')).toBeVisible();

      // Fill valid Job ID and check if error is hidden
      await page.getByLabel('Job ID*').fill('testJob');
      await expect(page.getByText('ID is required')).toBeHidden();

      // Main class or jar validation
      await page.getByLabel('Main class or jar*').fill('test');
      await page.getByText('ClusterChoose a cluster to').click();

      // Clear the field and expect an error message
      await page.getByLabel('Main class or jar*').fill('');
      await page.getByLabel('Jar files').click();
      await expect(page.getByText('Main class or jar is required')).toBeVisible();

      // Refill the field and check if the error is hidden
      await page.getByLabel('Main class or jar*').fill('test');
      await expect(page.getByText('Main class or jar is required')).toBeHidden();

      // Jar files validation
      await page.getByLabel('Jar files').fill('test');
      await page.getByText('ClusterChoose a cluster to').click();
      await expect(page.locator("//*[contains(text(),'All files must include a valid scheme prefix: ')]")).toBeVisible();

      // Clear the invalid Jar files and check if the error is hidden
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(page.locator("//*[contains(text(),'All files must include a valid scheme prefix: ')]")).toBeHidden();

      // Files validation
      await page.getByLabel('Files', { exact: true }).fill('test');
      await page.getByText('ClusterChoose a cluster to').click();
      await expect(page.locator("//*[contains(text(),'All files must include a valid scheme prefix: ')]")).toBeVisible();

      // Clear and revalidate the Files field
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(page.locator("//*[contains(text(),'All files must include a valid scheme prefix: ')]")).toBeHidden();

      // Archive files validation
      await page.getByLabel('Archive files').fill('test');
      await page.getByText('ClusterChoose a cluster to').click();
      await expect(page.locator("//*[contains(text(),'All files must include a valid scheme prefix: ')]")).toBeVisible();

      // Clear and check if the error is hidden
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect(page.locator("//*[contains(text(),'All files must include a valid scheme prefix: ')]")).toBeHidden();

      // Add property validation: Empty key should show an error
      await page.getByRole('button', { name: 'ADD PROPERTY' }).click();
      await expect(page.getByText('key is required')).toBeVisible();

      // Check if the ADD PROPERTY button is disabled
      let isDisabled = await page.getByRole('button', { name: 'ADD PROPERTY' }).getAttribute('class');
      expect(isDisabled).toContain('disabled');

      // Fill the key field and ensure the error is hidden
      await page.getByLabel('Key 1*').first().fill('key');
      await expect(page.getByText('key is required')).toBeHidden();

      // Click on the value field and ensure the ADD PROPERTY button is enabled
      await page.getByLabel('Value').first().click();
      isDisabled = await page.getByRole('button', { name: 'ADD PROPERTY' }).getAttribute('class');
      expect(isDisabled).not.toContain('disabled');
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate Filter Table search field on jobs listing page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      const firstJobLocator = page.locator('.cluster-name').first();
      const jobName = await firstJobLocator.innerText();

      const filterInput = page.getByPlaceholder('Filter Table');
      await filterInput.fill(jobName);

      // Verify filtered rows count (header row + filtered data row = 2)
      const rowCount = await page.locator('table.clusters-list-table tr').count();
      expect(rowCount).toEqual(2);

      // Clear filter
      await filterInput.fill('');
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Sanity: Check pagination in jobs tab', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const isNotificationPresent = await page.getByRole('button', { name: 'Ignore' }).isVisible();
    if (isNotificationPresent) {
      await page.getByRole('button', { name: 'Ignore' }).click();
    }

    const paginationLocator = page.locator('.pagination-parent-view');
    const isPaginationVisible = await paginationLocator.isVisible();

    const validateRowCount = async (tableRowsLocator: Locator, expectedCount: number) => {
      const rowCount = await tableRowsLocator.count();
      expect(rowCount).toBeLessThanOrEqual(expectedCount);
    };

    const changeRowsPerPageAndValidate = async (
      paginationLocator: Locator,
      tableRowsLocator: Locator,
      newRowsPerPage: number
    ) => {
      const selectDropdown = paginationLocator.locator('.MuiSelect-select, [role="combobox"]').first();
      await selectDropdown.click();
      await page.getByRole('option', { name: String(newRowsPerPage), exact: true }).click();
      await validateRowCount(tableRowsLocator, newRowsPerPage);
    };

    const navigateAndValidate = async (buttonLocator: Locator, tableRowsLocator: Locator, expectedCount: number) => {
      await buttonLocator.click();
      await validateRowCount(tableRowsLocator, expectedCount);
    };

    const validateRange = async (pageRange: Locator, expectedStart: number, expectedEnd: number) => {
      const rangeText = await pageRange.textContent();
      const [currentRange] = rangeText!.split(' of ');
      const [start, end] = currentRange.split(' - ').map(Number);
      expect(start).toBe(expectedStart);
      expect(end).toBeLessThanOrEqual(expectedEnd);
    };

    if (isPaginationVisible) {
      const tableRowsLocator = page.locator('.clusters-table-body tr[role="row"]');

      // Verify the default row count and selected pagination number
      await validateRowCount(tableRowsLocator, 50);
      const currentRowsPerPage = await paginationLocator.locator('input').getAttribute('value');
      expect(currentRowsPerPage).toBe('50');

      // Change rows per page to 100 and validate
      await changeRowsPerPageAndValidate(paginationLocator, tableRowsLocator, 100);

      // Change rows per page to 200 and validate
      await changeRowsPerPageAndValidate(paginationLocator, tableRowsLocator, 200);

      // Change rows per page back to 50
      await changeRowsPerPageAndValidate(paginationLocator, tableRowsLocator, 50);

      // Validate pagination controls
      const leftArrow = page.locator('.page-move-button').first();
      const rightArrow = page.locator('.page-move-button').nth(1);
      const pageRange = page.locator('.page-display-part');

      const rangeText = await pageRange.textContent();
      const [, totalCount] = rangeText!.split(' of ');

      if (parseInt(totalCount) > 50) {
        await validateRange(pageRange, 1, 50);
        await navigateAndValidate(rightArrow, tableRowsLocator, 50);
        await validateRange(pageRange, 51, 100);
        await navigateAndValidate(leftArrow, tableRowsLocator, 50);
        await validateRange(pageRange, 1, 50);
      }
    } else {
      expect(isPaginationVisible).toBe(false);
    }
  });

  test('Can navigate back from Cluster Details and Job Details pages', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 1. Navigate to Clusters page
    await navigateToClusters(page);

    const clusterTableExists = await page.locator('table.clusters-list-table').isVisible();
    if (clusterTableExists) {
      // Click first cluster to open details
      const firstCluster = page.locator('.cluster-name').first();
      await firstCluster.click();
      await page.getByText('Loading Cluster Details').waitFor({ state: 'detached' });
      await expect(page.getByText('Cluster details')).toBeVisible();

      // Click back arrow icon
      const backButton = page.locator('.back-arrow-icon, [aria-label="back-arrow-icon"]').first();
      await expect(backButton).toBeVisible();
      await backButton.click();

      // Verify returned to clusters list
      await expect(page.getByRole('button', { name: 'Create cluster' })).toBeVisible();
      await expect(page.locator('table.clusters-list-table')).toBeVisible();
    }

    // 2. Navigate to Jobs tab
    await page.getByRole('tabpanel').getByText('Jobs', { exact: true }).click();
    await page.getByText('Loading Jobs').waitFor({ state: 'detached' });

    const jobTableExists = await page.locator('table.clusters-list-table').isVisible();
    if (jobTableExists) {
      // Click first job to open details
      const firstJob = page.locator('.cluster-name').first();
      await firstJob.click();
      await page.getByText('Loading Job Details').waitFor({ state: 'detached' });
      await expect(page.getByText('Job details')).toBeVisible();

      // Click back arrow icon
      const backButton = page.locator('.back-arrow-icon, [aria-label="back-arrow-icon"]').first();
      await expect(backButton).toBeVisible();
      await backButton.click();

      // Verify returned to jobs list
      await expect(page.getByRole('button', { name: 'SUBMIT JOB', exact: true })).toBeVisible();
      await expect(page.locator('table.clusters-list-table')).toBeVisible();
    }
  });

  test('Can submit a job directly from Cluster Details page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Clusters page
    await navigateToClusters(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Open first cluster details
      const firstCluster = page.locator('.cluster-name').first();
      const clusterName = await firstCluster.innerText();
      await firstCluster.click();
      await page.getByText('Loading Cluster Details').waitFor({ state: 'detached' });

      // Click SUBMIT JOB inside Cluster Details
      const submitJobBtn = page.getByRole('button', { name: 'SUBMIT JOB', exact: true });
      await expect(submitJobBtn).toBeVisible();
      await submitJobBtn.click();

      // Verify Submit Job view is displayed
      await expect(page.getByLabel('Job ID*')).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Cluster*' })).toBeVisible();

      // Cancel and return to Cluster Details
      const cancelBtn = page.getByRole('button', { name: 'CANCEL' });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();

      await expect(page.getByText('Cluster details')).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can edit labels in Job Details page', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Open first job details
      const firstJob = page.locator('.cluster-name').first();
      await firstJob.click();
      await page.getByText('Loading Job Details').waitFor({ state: 'detached' });

      // Click EDIT button
      const editButton = page.getByRole('button', { name: 'EDIT' });
      await expect(editButton).toBeVisible();
      await editButton.click();

      // Verify SAVE and CANCEL buttons appear in edit mode
      const saveButton = page.getByRole('button', { name: 'SAVE' });
      const cancelButton = page.getByRole('button', { name: 'CANCEL' });
      await expect(saveButton).toBeVisible();
      await expect(cancelButton).toBeVisible();

      // Click CANCEL to exit edit mode
      await cancelButton.click();
      await expect(page.getByRole('button', { name: 'EDIT' })).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can verify Filter Table with non-matching search term shows empty state', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 1. In Clusters tab
    await navigateToClusters(page);
    const filterInputClusters = page.getByPlaceholder('Filter Table');
    await filterInputClusters.fill('nonexistent_cluster_xyz_12345');
    await expect(page.locator('tbody.clusters-table-body tr')).toHaveCount(0);
    await filterInputClusters.fill('');

    // 2. In Jobs tab
    await page.getByRole('tabpanel').getByText('Jobs', { exact: true }).click();
    await page.getByText('Loading Jobs').waitFor({ state: 'detached' });
    const filterInputJobs = page.getByPlaceholder('Filter Table');
    await filterInputJobs.fill('nonexistent_job_xyz_12345');
    await expect(page.locator('tbody.clusters-table-body tr')).toHaveCount(0);
    await filterInputJobs.fill('');
  });

  test('Can cancel submit job and return to previous view', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Navigate to Jobs tab
    await navigateToJobs(page);

    const tableExists = await page.locator('table.clusters-list-table').isVisible();
    if (tableExists) {
      // Click SUBMIT JOB
      await page.getByRole('button', { name: 'SUBMIT JOB', exact: true }).click();

      // Verify form is open
      await expect(page.getByLabel('Job ID*')).toBeVisible();

      // Click CANCEL button
      const cancelBtn = page.getByRole('button', { name: 'CANCEL' });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();

      // Verify returned to Jobs list
      await expect(page.getByRole('button', { name: 'SUBMIT JOB', exact: true })).toBeVisible();
      await expect(page.locator('table.clusters-list-table')).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });
});