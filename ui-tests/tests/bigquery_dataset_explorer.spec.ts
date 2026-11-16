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
import { Page } from '@playwright/test';

// Constants for test timeouts and UI headers
const TEST_TIMEOUT = 5 * 60 * 1000;

const DATASET_ROW_HEADERS = [
  'Dataset ID',
  'Created',
  'Default table expiration',
  'Last modified',
  'Data location',
  'Description',
  'Default collation',
  'Default rounding mode',
  'Time travel window',
  'Storage billing model',
  'Case insensitive'
];

const TABLE_HEADERS = [
  'Table ID',
  'Created',
  'Last modified',
  'Table expiration',
  'Data location',
  'Default collation',
  'Default rounding mode',
  'Description',
  'Case insensitive'
];

const SCHEMA_HEADERS = [
  'Field name',
  'Type',
  'Mode',
  'Key',
  'Collation',
  'Default Value',
  'Policy Tags',
  'Data Policies',
  'Description'
];

/**
 * Checks if BigQuery integration is enabled in plugin settings.
 */
async function isBigQueryIntegrationEnabled(page: Page): Promise<boolean> {
  const response = await page.request.get('http://localhost:8888/dataproc-plugin/settings');
  expect(response.ok()).toBeTruthy();
  const settings = await response.json();
  return Boolean(settings.enable_bigquery_integration);
}

/**
 * Navigates to the Dataset Explorer - BigQuery tab and waits for the tree view to load.
 */
async function openDatasetExplorer(page: Page): Promise<void> {
  const isEnabled = await isBigQueryIntegrationEnabled(page);
  test.skip(!isEnabled, 'BigQuery integration is disabled in settings');

  const tab = page.getByRole('tab', { name: 'Dataset Explorer - BigQuery' });
  await expect(tab).toBeVisible();
  await tab.click();

  // Wait for initial datasets loading indicator to disappear and tree to populate
  await page.getByText('Loading datasets').first().waitFor({ state: 'hidden' });
  await expect(page.locator('div[role="treeitem"].caret-icon.down').first()).toBeVisible();

  // Wait for network activity to settle to ensure consistency and avoid flaky issues
    await page.waitForLoadState('networkidle');
}

/**
 * Expands the first project (e.g. bigquery-public-data) in the tree.
 */
async function expandFirstProject(page: Page): Promise<void> {
  const projectCaret = page.locator('div[role="treeitem"].caret-icon.down').first();
  await projectCaret.click();
  // await page.waitForLoadState('networkidle');
  const firstDataset = page.locator('div[role="treeitem"][aria-level="2"]').first();
  await expect(firstDataset).toBeVisible();
}

/**
 * Expands the first dataset under the first project in the tree.
 */
async function expandFirstDataset(page: Page): Promise<void> {
  await expandFirstProject(page);
  const datasetRow = page.locator('div[role="treeitem"][aria-level="2"]').first();
  const datasetCaret = datasetRow.locator('.caret-icon.down');
  await datasetCaret.click();
  await page.getByTestId('loader').first().waitFor({ state: 'detached' }).catch(() => {});
  const firstTable = page.locator('div[role="treeitem"][aria-level="3"]').first();
  await expect(firstTable).toBeVisible();
}

/**
 * Expands the first table under the first dataset in the tree to show columns.
 */
async function expandFirstTable(page: Page): Promise<void> {
  await expandFirstDataset(page);
  const tableRow = page.locator('div[role="treeitem"][aria-level="3"]').first();
  const tableCaret = tableRow.locator('.caret-icon.down');
  await tableCaret.click();
  await page.getByTestId('loader').first().waitFor({ state: 'detached' }).catch(() => {});
  const firstColumn = page.locator('div[role="treeitem"][aria-level="4"]').first();
  await expect(firstColumn).toBeVisible();
}

test.describe('bigquery-dataset-explorer', () => {
  test('Sanity : Dataset Explorer', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer tab
    await openDatasetExplorer(page);

    // Expand the first dataset project (e.g. bigquery-public-data)
    await page.locator('div[role="treeitem"].caret-icon.down').first().click();

    // Click on the first dataset displayed to view its details
    const firstDataset = page.locator('div[role="treeitem"][aria-level="2"]').first();
    await expect(firstDataset).toBeVisible();
    await firstDataset.click();

    // Wait for the dataset details to load and verify visible headers
    await page.getByText('Loading dataset details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Dataset info', { exact: true })).toBeVisible();
    for (const header of DATASET_ROW_HEADERS) {
      await expect(page.getByRole('cell', { name: header, exact: true })).toBeVisible();
    }

    // Expand the dataset caret to show its tables
    await page.locator('div[role="treeitem"].caret-icon.down').first().click();
    await page.getByTestId('loader').first().waitFor({ state: 'detached' });

    // Click on the first table displayed
    const firstTable = page.locator('div[role="treeitem"][aria-level="3"]').first();
    await expect(firstTable).toBeVisible();
    await firstTable.click();

    // Wait for the table details to load and verify visible headers
    await page.getByText('Loading table details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Table info')).toBeVisible();
    for (const header of TABLE_HEADERS) {
      await expect(page.getByRole('cell', { name: header, exact: true })).toBeVisible();
    }

    // Navigate to the Schema tab and verify column headers
    await page.getByText('Schema', { exact: true }).click();
    for (const header of SCHEMA_HEADERS) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }

    // Navigate to the Preview tab and verify data presence or empty state
    await page.getByText('Preview', { exact: true }).click();
    await page.getByText('Loading Preview Data').waitFor({ state: 'hidden' });

    const previewTable = page.locator('table.clusters-list-table');
    if (await previewTable.isVisible()) {
      const rowCount = await previewTable.locator('tr').count();
      expect(rowCount).toBeGreaterThan(0);
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can verify search field and refresh button', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer tab
    await openDatasetExplorer(page);

    // Check austin_311 is not visible before searching
    const austin311Item = page.locator('[role="treeitem"][title="austin_311"]');
    await expect(austin311Item).not.toBeVisible();

    // Fill in keyword search
    const searchInput = page.getByPlaceholder('Enter your keyword to search').first();
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('austin_311');

    // Wait for search spinner if it triggers
    const searchLoader = page.locator('[aria-label="Loading Spinner"]').first();
    if (await searchLoader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchLoader.waitFor({ state: 'detached' });
    }

    // Check austin_311 is visible in search results
    await expect(austin311Item).toBeVisible({ timeout: 10000 });

    // Click refresh button to clear search and reload tree
    const refreshButton = page.locator('.dataset-explorer-refresh').first();
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Wait for refresh spinner if it triggers
    const refreshLoader = page.locator('[aria-label="Loading Spinner"]').first();
    if (await refreshLoader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshLoader.waitFor({ state: 'detached' });
    }

    // Verify austin_311 is no longer visible after refresh
    await expect(austin311Item).not.toBeVisible();
  });

  test('Can expand table in tree view to display columns and data types', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer and expand down to table columns
    await openDatasetExplorer(page);
    await expandFirstTable(page);

    // Verify columns (Level 4 tree items) and column data types are rendered
    const columnItems = page.locator('div[role="treeitem"][aria-level="4"]');
    const columnCount = await columnItems.count();
    expect(columnCount).toBeGreaterThan(0);

    const firstColumnType = columnItems.first().locator('.dpms-column-type-text');
    await expect(firstColumnType).toBeVisible();
    const typeText = await firstColumnType.innerText();
    expect(typeText.trim().length).toBeGreaterThan(0);
  });

  test('Can query table from context menu to create BigQuery notebook', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer and expand to tables
    await openDatasetExplorer(page);
    await expandFirstDataset(page);

    // Right-click on the first table item
    const tableItem = page.locator('div[role="treeitem"][aria-level="3"]').first().locator('div[title]');
    await tableItem.click({ button: 'right' });

    // Verify context menu options
    const queryTableMenu = page.getByRole('menuitem', { name: 'Query table' });
    await expect(queryTableMenu).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Open table details' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Copy table ID' })).toBeVisible();

    // Click 'Query table'
    await queryTableMenu.click();

    // Verify notebook is created and pre-filled with BigQuery magics and query cell
    const notebook = page.locator('.jp-Notebook');
    await expect(notebook).toBeVisible({ timeout: 15000 });
    await expect(notebook).toContainText('%load_ext bigquery_magics');
    await expect(notebook).toContainText('%%bqsql');

    // Close the created notebook tab to clean up
    const activeTabClose = page.locator('.lm-TabBar-tab.jp-mod-current .lm-TabBar-tabCloseIcon, .p-TabBar-tab.p-mod-current .p-TabBar-tabCloseIcon').first();
    if (await activeTabClose.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activeTabClose.click();
      const discardButton = page.getByRole('button', { name: 'Discard' });
      if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await discardButton.click();
      }
    }
  });

  test('Can open table details from context menu', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer and expand to tables
    await openDatasetExplorer(page);
    await expandFirstDataset(page);

    // Right-click on the first table item and select 'Open table details'
    const tableItem = page.locator('div[role="treeitem"][aria-level="3"]').first().locator('div[title]');
    await tableItem.click({ button: 'right' });

    const openDetailsMenu = page.getByRole('menuitem', { name: 'Open table details' });
    await expect(openDetailsMenu).toBeVisible();
    await openDetailsMenu.click();

    // Wait for the table details to load and verify headers
    await page.getByText('Loading table details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Table info')).toBeVisible();
    for (const header of TABLE_HEADERS) {
      await expect(page.getByRole('cell', { name: header, exact: true })).toBeVisible();
    }
  });

  test('Can copy table ID from context menu', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer and expand to tables
    await openDatasetExplorer(page);
    await expandFirstDataset(page);

    // Right-click on the first table item and click 'Copy table ID'
    const tableItem = page.locator('div[role="treeitem"][aria-level="3"]').first().locator('div[title]');
    await tableItem.click({ button: 'right' });

    const copyIdMenu = page.getByRole('menuitem', { name: 'Copy table ID' });
    await expect(copyIdMenu).toBeVisible();
    await copyIdMenu.click();

    // Verify context menu is dismissed after copying
    await expect(copyIdMenu).not.toBeVisible();
  });

  test('Can clear search input using clear button', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer tab
    await openDatasetExplorer(page);

    // Fill in search input
    const searchInput = page.getByPlaceholder('Enter your keyword to search').first();
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('austin_311');

    // Wait for search spinner if it triggers
    const searchLoader = page.locator('[aria-label="Loading Spinner"]').first();
    if (await searchLoader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchLoader.waitFor({ state: 'detached' });
    }

    // Verify clear icon button is visible
    const clearButton = page.locator('.search-clear-icon').first();
    await expect(clearButton).toBeVisible();

    // Click the clear button
    await clearButton.click();

    // Verify search input is cleared and project tree items are visible
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('div[role="treeitem"].caret-icon').first()).toBeVisible();
  });

  test('Can search with non-matching keyword and verify empty results', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer tab
    await openDatasetExplorer(page);

    // Fill in non-existent search keyword
    const searchInput = page.getByPlaceholder('Enter your keyword to search').first();
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('nonexistent_dataset_query_xyz123');

    // Wait for search spinner if it triggers
    const searchLoader = page.locator('[aria-label="Loading Spinner"]').first();
    if (await searchLoader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchLoader.waitFor({ state: 'detached' });
    }

    // Verify no dataset items (aria-level 2) are displayed
    await expect(page.locator('div[role="treeitem"][aria-level="2"]')).not.toBeVisible();
  });

  test('Can close and reopen dataset and table details tabs', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer and expand project
    await openDatasetExplorer(page);
    await expandFirstProject(page);

    // Click on the first dataset to open its details
    const firstDataset = page.locator('div[role="treeitem"][aria-level="2"]').first();
    const datasetName = (await firstDataset.locator('div[title]').innerText()).trim();
    await firstDataset.click();
    await page.getByText('Loading dataset details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Dataset info', { exact: true })).toBeVisible();

    // Verify the dataset tab in the main area tab bar and close it
    const datasetTab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: datasetName }).first();
    await expect(datasetTab).toBeVisible();
    await datasetTab.locator('.lm-TabBar-tabCloseIcon, .p-TabBar-tabCloseIcon').click();
    await expect(page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: datasetName })).not.toBeVisible();

    // Reopen dataset details from tree and verify it opens again
    await firstDataset.click();
    await page.getByText('Loading dataset details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Dataset info', { exact: true })).toBeVisible();

    // Expand dataset to show tables
    const datasetCaret = firstDataset.locator('.caret-icon.down');
    await datasetCaret.click();
    await page.getByTestId('loader').first().waitFor({ state: 'detached' }).catch(() => {});

    // Click on the first table to open its details
    const firstTable = page.locator('div[role="treeitem"][aria-level="3"]').first();
    const tableName = (await firstTable.locator('div[title]').innerText()).trim();
    await firstTable.click();
    await page.getByText('Loading table details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Table info')).toBeVisible();

    // Verify the table tab in the main area tab bar and close it
    const tableTab = page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: tableName }).first();
    await expect(tableTab).toBeVisible();
    await tableTab.locator('.lm-TabBar-tabCloseIcon, .p-TabBar-tabCloseIcon').click();
    await expect(page.locator('.lm-TabBar-tab, .p-TabBar-tab', { hasText: tableName })).not.toBeVisible();

    // Reopen table details from tree and verify it opens again
    await firstTable.click();
    await page.getByText('Loading table details').waitFor({ state: 'hidden' });
    await expect(page.getByText('Table info')).toBeVisible();
  });

  test('Can collapse and re-expand tree nodes', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Open Dataset Explorer
    await openDatasetExplorer(page);

    // Locate project caret (initially down / closed)
    const projectCaret = page.locator('div[role="treeitem"].caret-icon').first();

    // 1. Expand Project
    await projectCaret.click();
    await page.waitForLoadState('networkidle');
    const firstDataset = page.locator('div[role="treeitem"][aria-level="2"]').first();
    await expect(firstDataset).toBeVisible();

    // 2. Collapse Project
    await projectCaret.click();
    await expect(firstDataset).not.toBeVisible();

    // 3. Re-expand Project
    await projectCaret.click();
    await expect(firstDataset).toBeVisible();

    // 4. Expand Dataset
    const datasetRow = page.locator('div[role="treeitem"][aria-level="2"]').first();
    const datasetCaret = datasetRow.locator('.caret-icon');
    await datasetCaret.click();
    await page.getByTestId('loader').first().waitFor({ state: 'detached' }).catch(() => {});
    const firstTable = page.locator('div[role="treeitem"][aria-level="3"]').first();
    await expect(firstTable).toBeVisible();

    // 5. Collapse Dataset
    await datasetCaret.click();
    await expect(firstTable).not.toBeVisible();

    // 6. Re-expand Dataset
    await datasetCaret.click();
    await expect(firstTable).toBeVisible();
  });
});