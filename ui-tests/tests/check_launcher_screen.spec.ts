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

import { expect, test } from '@jupyterlab/galata';
import { Page } from '@playwright/test';

const TEST_TIMEOUT = 5 * 60 * 1000;

/**
 * Fetches Dataproc plugin settings from the backend endpoint.
 */
async function getPluginSettings(page: Page): Promise<{
  enable_bigquery_integration?: boolean;
  enable_metastore_integration?: boolean;
  enable_cloud_storage_integration?: boolean;
}> {
  const response = await page.request.get('http://localhost:8888/dataproc-plugin/settings');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/**
 * Ensures the JupyterLab Launcher tab is active and Dataproc Launcher sections are loaded.
 */
async function ensureLauncherVisible(page: Page): Promise<void> {
  const launcherBody = page.locator('.jp-Launcher-body:visible').first();
  if (!(await launcherBody.isVisible())) {
    const launcherTab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Launcher' }).first();
    if (await launcherTab.isVisible()) {
      await launcherTab.click();
    } else {
      await page.getByRole('button', { name: 'New Launcher' }).first().click();
    }
  }
  await expect(launcherBody).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Google Cloud Resources' }).first()).toBeVisible({
    timeout: 30000
  });
}

/**
 * Closes a tab in the main area by its label and handles any unsaved changes dialog.
 */
async function closeMainAreaTab(page: Page, tabLabel: string): Promise<void> {
  const tab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: tabLabel }).first();
  if (await tab.isVisible()) {
    await tab.locator('.lm-TabBar-tabCloseIcon, .p-TabBar-tabCloseIcon').click();
    const discardButton = page.getByRole('button', { name: 'Discard' });
    const hasDiscard = await discardButton
      .waitFor({ state: 'visible', timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    if (hasDiscard) {
      await discardButton.click();
    }
  }
}

test.describe('Launcher screen', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await ensureLauncherVisible(page);
  });

  test('Sanity: Can verify all the sections', async ({ page }) => {
    const settings = await getPluginSettings(page);

    // Verify standard JupyterLab Launcher sections
    await expect(page.getByRole('heading', { name: 'Notebook', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Console', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Other', exact: true })).toBeVisible();

    // Check BigQuery Notebooks section and card based on settings
    const bqHeading = page.getByRole('heading', { name: 'BigQuery Notebooks' });
    const bqCard = page.locator('[data-category="BigQuery Notebooks"][title="BigQuery DataFrames"]');
    if (settings.enable_bigquery_integration) {
      await expect(bqHeading).toBeVisible();
      await expect(bqCard).toBeVisible();
      await expect(bqCard.locator('.jp-LauncherCard-icon svg')).toBeVisible();
      await expect(bqCard.locator('.jp-LauncherCard-label')).toHaveText('BigQuery DataFrames');
    } else {
      await expect(bqHeading).not.toBeVisible();
    }

    // Check Dataproc Serverless Spark section and New Runtime Template card
    await expect(page.getByRole('heading', { name: 'Dataproc Serverless Spark' })).toBeVisible();
    const newRuntimeCard = page.locator('.jp-LauncherCard:visible', {
      hasText: 'New Runtime Template'
    });
    await expect(newRuntimeCard).toBeVisible();
    await expect(newRuntimeCard.locator('.jp-LauncherCard-icon svg')).toBeVisible();

    // Check Dataproc Cluster Notebooks section if cluster kernels are configured
    const clusterHeading = page.getByRole('heading', { name: 'Dataproc Cluster Notebooks' });
    if (await clusterHeading.isVisible()) {
      await expect(
        page.locator('[data-category="Dataproc Cluster Notebooks"][title*="Apache Toree - Scala on"]').first()
      ).toBeVisible();
      await expect(
        page.locator('[data-category="Dataproc Cluster Notebooks"][title*="R on"]').first()
      ).toBeVisible();
      await expect(
        page.locator('[data-category="Dataproc Cluster Notebooks"][title*="PySpark on"]').first()
      ).toBeVisible();
      await expect(
        page.locator('[data-category="Dataproc Cluster Notebooks"][title*="Python 3 on"]').first()
      ).toBeVisible();
    }

    // Verify Google Cloud Resources section and cards
    await expect(page.getByRole('heading', { name: 'Google Cloud Resources' })).toBeVisible();
    for (const title of ['Clusters', 'Serverless', 'Notebook Templates']) {
      const card = page.locator(`[data-category="Google Cloud Resources"][title="${title}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator('.jp-LauncherCard-icon svg')).toBeVisible();
      await expect(card.locator('.jp-LauncherCard-label')).toHaveText(title);
    }

    const scheduledJobsCard = page.locator(
      '[data-category="Google Cloud Resources"][title="Scheduled Jobs"]'
    );
    if ((await scheduledJobsCard.count()) > 0) {
      await expect(scheduledJobsCard).toBeVisible();
    }
  });

  test('Can verify dynamic Serverless and Cluster kernel cards match kernelspecs', async ({
    page
  }) => {
    const response = await page.request.get('http://localhost:8888/api/kernelspecs');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const specs: Array<{
      name?: string;
      display_name?: string;
      resources?: { endpointParentResource?: string };
    }> = Object.values(data.kernelspecs || {});

    const serverlessKernels = specs.filter(spec =>
      spec?.resources?.endpointParentResource?.includes('/sessions')
    );
    const clusterKernels = specs.filter(
      spec =>
        spec?.resources?.endpointParentResource &&
        !spec.resources.endpointParentResource.includes('/sessions')
    );

    // Verify Dataproc Serverless Spark cards
    const serverlessCards = page.locator('.jp-LauncherCard[data-category="Dataproc Serverless Spark"]');
    const serverlessCardCount = await serverlessCards.count();
    expect(serverlessCardCount).toBeGreaterThanOrEqual(1); // At least 'New Runtime Template'

    if (serverlessKernels.length > 0) {
      const firstServerlessKernelCard = page
        .locator(
          '.jp-LauncherCard[data-category="Dataproc Serverless Spark"]:not([title="Create a new runtime template"])'
        )
        .first();
      await expect(firstServerlessKernelCard).toBeVisible();
      await expect(firstServerlessKernelCard.locator('.jp-LauncherCard-icon svg')).toBeVisible();
      const labelText = await firstServerlessKernelCard.locator('.jp-LauncherCard-label').innerText();
      expect(labelText.trim().length).toBeGreaterThan(0);
    }

    // Verify Dataproc Cluster Notebooks cards if cluster kernels exist
    if (clusterKernels.length > 0) {
      await expect(page.getByRole('heading', { name: 'Dataproc Cluster Notebooks' })).toBeVisible();
      const clusterCards = page.locator('.jp-LauncherCard[data-category="Dataproc Cluster Notebooks"]');
      expect(await clusterCards.count()).toBeGreaterThan(0);
      await expect(clusterCards.first().locator('.jp-LauncherCard-icon svg')).toBeVisible();
      const clusterLabel = await clusterCards.first().locator('.jp-LauncherCard-label').innerText();
      expect(clusterLabel.trim().length).toBeGreaterThan(0);
    }
  });

  test('Can launch Clusters page from Google Cloud Resources section', async ({ page }) => {
    const clustersCard = page.locator('[data-category="Google Cloud Resources"][title="Clusters"]');
    await expect(clustersCard).toBeVisible();
    await clustersCard.click();

    // Verify Clusters tab opens in the main area
    const clustersTab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Clusters' }).first();
    await expect(clustersTab).toBeVisible();

    // Wait for loading indicator to disappear and verify Clusters / Jobs sub-tabs
    await page.getByText('Loading Clusters').waitFor({ state: 'hidden' });
    await expect(
      page.locator('.clusters-list-overlay [role="tabpanel"]', { hasText: 'Clusters' })
    ).toBeVisible();
    await expect(
      page.locator('.clusters-list-overlay [role="tabpanel"]', { hasText: 'Jobs' })
    ).toBeVisible();

    // Close the Clusters tab and verify it is removed
    await closeMainAreaTab(page, 'Clusters');
    await expect(page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Clusters' })).toHaveCount(0);
  });

  test('Can launch Serverless page from Google Cloud Resources section', async ({ page }) => {
    const serverlessCard = page.locator('[data-category="Google Cloud Resources"][title="Serverless"]');
    await expect(serverlessCard).toBeVisible();
    await serverlessCard.click();

    // Verify Serverless tab opens in the main area
    const serverlessTab = page
      .locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Serverless' })
      .first();
    await expect(serverlessTab).toBeVisible();

    // Wait for loading indicator to disappear and verify Batches / Sessions sub-tabs
    await page.getByText('Loading Batches').waitFor({ state: 'hidden' });
    await expect(
      page.locator('.clusters-list-overlay [role="tabpanel"]', { hasText: 'Batches' })
    ).toBeVisible();
    await expect(
      page.locator('.clusters-list-overlay [role="tabpanel"]', { hasText: 'Sessions' })
    ).toBeVisible();

    // Close the Serverless tab and verify it is removed
    await closeMainAreaTab(page, 'Serverless');
    await expect(
      page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Serverless' })
    ).toHaveCount(0);
  });

  test('Can launch Notebook Templates page from Google Cloud Resources section', async ({
    page
  }) => {
    const templatesCard = page.locator(
      '[data-category="Google Cloud Resources"][title="Notebook Templates"]'
    );
    await expect(templatesCard).toBeVisible();
    await templatesCard.click();

    // Verify Notebook Templates tab opens in the main area
    const templatesTab = page
      .locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Notebook Templates' })
      .first();
    await expect(templatesTab).toBeVisible();

    // Wait for loading spinners to complete
    await page.getByText('Loading Templates').waitFor({ state: 'hidden' });
    await page.getByText('Loading Notebook Templates').waitFor({ state: 'hidden' });

    // Verify either templates table or empty message is displayed
    const tableVisible = await page.locator('table.clusters-list-table').isVisible();
    if (tableVisible) {
      await expect(page.getByPlaceholder('Filter Table')).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }

    // Close the Notebook Templates tab and verify it is removed
    await closeMainAreaTab(page, 'Notebook Templates');
    await expect(
      page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Notebook Templates' })
    ).toHaveCount(0);
  });

  test('Can launch New Runtime Template form from Dataproc Serverless Spark section', async ({
    page
  }) => {
    const newRuntimeCard = page.locator('.jp-LauncherCard:visible', {
      hasText: 'New Runtime Template'
    });
    await expect(newRuntimeCard).toBeVisible();
    await newRuntimeCard.click();

    // Verify Runtime template tab opens in the main area
    const runtimeTab = page
      .locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Runtime template' })
      .first();
    await expect(runtimeTab).toBeVisible();

    // Wait for form to load and verify key sections
    await page.getByText('Loading Runtime').waitFor({ state: 'hidden' });
    await expect(page.getByText('Serverless Runtime Template')).toBeVisible();
    await expect(page.getByText('Execution Configuration')).toBeVisible();
    await expect(page.getByLabel('Display name*')).toBeVisible();
    await expect(page.getByLabel('Runtime ID*')).toBeVisible();

    // Close the Runtime template tab and verify it is removed
    await closeMainAreaTab(page, 'Runtime template');
    await expect(
      page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Runtime template' })
    ).toHaveCount(0);
  });

  test('Can launch BigQuery DataFrames quickstart notebook from BigQuery Notebooks section', async ({
    page
  }) => {
    const settings = await getPluginSettings(page);
    test.skip(!settings.enable_bigquery_integration, 'BigQuery integration is disabled in settings');

    // Ensure the File Browser widget has been initialized so tracker.currentWidget is active
    const fileBrowserTab = page.getByRole('tab', { name: /File Browser/i }).first();
    if (await fileBrowserTab.isVisible()) {
      await fileBrowserTab.click();
      await fileBrowserTab.click(); // Collapse sidebar back after initializing tracker
    }

    const bqCard = page.locator('[data-category="BigQuery Notebooks"][title="BigQuery DataFrames"]');
    await expect(bqCard).toBeVisible();
    await bqCard.click();

    // Wait for bigframes_quickstart.ipynb notebook to be downloaded and opened
    const notebook = page.locator('.jp-Notebook').first();
    await expect(notebook).toBeVisible({ timeout: 30000 });

    // Dismiss 'Select Kernel' dialog if it appears
    const kernelDialog = page.locator('dialog[aria-modal="true"]');
    const hasKernelDialog = await kernelDialog
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (hasKernelDialog) {
      const selectKernelBtn = kernelDialog.getByRole('button', { name: 'Select Kernel' });
      const cancelBtn = kernelDialog.getByRole('button', { name: 'Cancel' });
      if (await selectKernelBtn.isVisible()) {
        await selectKernelBtn.click();
      } else if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }

    await expect(
      page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'bigframes_quickstart.ipynb' }).first()
    ).toBeVisible();
    await expect(notebook).toContainText('PROJECT_ID');

    // Clean up opened notebook tab
    await closeMainAreaTab(page, 'bigframes_quickstart.ipynb');
  });

  test('Can launch a local notebook from Launcher and verify Dataproc toolbar extension', async ({
    page
  }) => {
    const localNotebookCard = page.locator('.jp-LauncherCard[data-category="Notebook"]:visible').first();
    await expect(localNotebookCard).toBeVisible();
    await localNotebookCard.click();

    // Verify notebook opens and Dataproc NotebookButtonExtension widget is attached to toolbar
    const notebookPanel = page.locator('.jp-NotebookPanel:visible').first();
    await expect(notebookPanel).toBeVisible({ timeout: 15000 });
    await expect(notebookPanel.locator('.kernel-status-toolbar')).toBeAttached();

    // Clean up created notebook tab
    await closeMainAreaTab(page, 'Untitled');
  });

  test('Can open a new Launcher tab via New Launcher button and File menu', async ({ page }) => {
    // Open Clusters widget so Launcher is no longer the active tab
    await page.locator('[data-category="Google Cloud Resources"][title="Clusters"]').click();
    await expect(
      page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Clusters' }).first()
    ).toBeVisible();

    // Click the '+' (New Launcher) button in the main area tab bar
    const newLauncherBtn = page.getByRole('button', { name: 'New Launcher' }).first();
    if (await newLauncherBtn.isVisible()) {
      await newLauncherBtn.click();
      await expect(page.locator('.jp-Launcher-body:visible').first()).toBeVisible();
    }

    // Switch back to Clusters tab and open a Launcher via File -> New Launcher menu
    await page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: 'Clusters' }).first().click();
    await page.getByLabel('main menu', { exact: true }).getByText('File').click();
    const newLauncherMenuItem = page.getByRole('menuitem', { name: 'New Launcher' });
    await expect(newLauncherMenuItem).toBeVisible();
    await newLauncherMenuItem.click();

    const activeLauncher = page.locator('.jp-Launcher-body:visible').first();
    await expect(activeLauncher).toBeVisible();
    await expect(
      activeLauncher.getByRole('heading', { name: 'Google Cloud Resources' })
    ).toBeVisible();

    // Clean up Clusters tab
    await closeMainAreaTab(page, 'Clusters');
  });
});


