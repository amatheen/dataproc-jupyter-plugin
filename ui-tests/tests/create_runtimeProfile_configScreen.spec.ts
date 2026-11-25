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

const TEST_TIMEOUT = 5 * 60 * 1000;

/**
 * Navigates to Settings -> Google Cloud Settings -> Spark (Runtime Profiles).
 */
async function openSparkSettings(page: Page) {
  await page
    .getByLabel('main menu', { exact: true })
    .getByText('Settings')
    .click();
  await page.getByText('Google Cloud Settings').click();

  await page.locator('.settings-tab', { hasText: 'Spark' }).click();
  await expect(
    page.locator('.runtime-profile-table, .no-profiles-message')
  ).toBeVisible({ timeout: 30000 });
}

/**
 * Expands the "Additional configuration" section on the Runtime Profile form.
 */
async function expandAdditionalConfig(page: Page) {
  const header = page.locator('.additional-config-header-container');
  await expect(header).toBeVisible();
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click();
  }
  await expect(page.locator('.additional-config-content')).toBeVisible();
}

/**
 * Finds a runtime profile row across paginated table pages so it can be clicked or acted upon.
 */
async function goToProfilePageInTable(page: Page, profileName: string) {
  const table = page.locator('.runtime-profile-table');
  await expect(table).toBeVisible({ timeout: 30000 });

  const profileButton = table.getByRole('button', {
    name: profileName,
    exact: true
  });
  const nextBtn = page
    .locator('.table-footer .pagination-btn', { hasText: '>' })
    .first();

  for (let i = 0; i < 5; i++) {
    if (await profileButton.isVisible()) {
      break;
    }
    const isNextDisabled = await nextBtn.evaluate(el =>
      el.classList.contains('disabled')
    );
    if (isNextDisabled) {
      break;
    }
    await nextBtn.click();
    await expect(table).toBeVisible({ timeout: 30000 });
  }

  await expect(profileButton).toBeVisible({ timeout: 30000 });
  return profileButton;
}

test.describe('Create and edit Runtime Profile from config screen', () => {
  test.describe.configure({ mode: 'serial' });

  const runId = String(Date.now()).slice(-6);
  const dpmsProfileName = `auto-dpms-${runId}`;
  const lakehouseProfileName = `auto-lakehouse-${runId}`;
  let selectedDpmsService = 'None';

  test('Can create runtime profile with Dataproc Metastore', async ({
    page
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 1. Open Google Cloud Settings -> Spark and click Create runtime profile
    await openSparkSettings(page);
    await page.getByRole('button', { name: 'Create runtime profile' }).click();

    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Create a runtime profile'
      })
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#runtime-profile-region')).not.toHaveAttribute(
      'aria-disabled',
      'true',
      { timeout: 30000 }
    );

    // 2. Enter Display name and Description
    await page.locator('#runtime-profile-display-name').fill(dpmsProfileName);
    await page.locator('#runtime-profile-description').fill('Testing');

    // 3. Configure Dataproc Metastore under Additional configuration
    await expandAdditionalConfig(page);
    await page
      .getByRole('button', { name: 'Edit Metastore configuration' })
      .click();

    const metastoreDrawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Metastore configuration' });
    await expect(metastoreDrawer).toBeVisible();

    await metastoreDrawer
      .locator('.node-config-card', { hasText: 'Dataproc Metastore' })
      .click();

    const projectInput = page.locator('#dpms-project-id');
    await projectInput.fill('dataproc-jupyter-extension-dev');
    await projectInput.blur();

    const serviceSelect = page.locator('#dpms-service-select');
    await expect(serviceSelect).not.toHaveAttribute('aria-disabled', 'true', {
      timeout: 30000
    });
    await serviceSelect.click();

    const serviceOptions = page
      .locator('li[role="option"]:not([aria-disabled="true"])')
      .filter({ hasNotText: 'None' });
    if ((await serviceOptions.count()) > 0) {
      selectedDpmsService =
        (await serviceOptions.first().textContent())?.trim() || 'None';
      await serviceOptions.first().click();
    } else {
      await page.getByRole('option', { name: 'None', exact: true }).click();
    }

    await metastoreDrawer.getByRole('button', { name: 'Save' }).click();

    // 4. Create the runtime profile and verify success notification
    const createBtn = page.locator('.runtime-profile-submit-btn');
    await expect(createBtn).toBeEnabled({ timeout: 30000 });
    await createBtn.click();

    await expect(
      page.getByText(
        `Runtime profile "${dpmsProfileName}" created successfully.`
      )
    ).toBeVisible({ timeout: 60000 });
  });

  test('Check and edit created runtime profile with Dataproc Metastore', async ({
    page
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 1. Open Google Cloud Settings -> Spark and select the created profile
    await openSparkSettings(page);
    const profileLink = await goToProfilePageInTable(page, dpmsProfileName);
    await profileLink.click();

    await expect(page.getByText('Resource details')).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Edit runtime profile'
      })
    ).toBeVisible({ timeout: 30000 });

    // 2. Verify saved Display name, Description, Runtime version, Network, and Metastore
    await expect(page.locator('#runtime-profile-display-name')).toHaveValue(
      dpmsProfileName
    );
    await expect(page.locator('#runtime-profile-description')).toHaveValue(
      'Testing'
    );

    await expandAdditionalConfig(page);

    await expect(
      page.locator('.section-detail-wrapper', {
        hasText: 'Runtime configuration'
      })
    ).toContainText('2.3 LTS (Spark 3.5, Java 17, Scala 2.13)');

    await expect(
      page.locator('.section-detail-wrapper', {
        hasText: 'Network and security'
      })
    ).toContainText('default');

    if (selectedDpmsService !== 'None') {
      await expect(
        page.locator('.section-detail-wrapper', {
          hasText: 'Metastore configuration'
        })
      ).toContainText(selectedDpmsService);
    }

    // 3. Update Description and save changes
    await page
      .locator('#runtime-profile-description')
      .fill('Testing for edit runtime profile');

    const saveBtn = page.locator('.runtime-profile-submit-btn');
    await expect(saveBtn).toBeEnabled({ timeout: 30000 });
    await saveBtn.click();

    await expect(
      page.getByText(
        `Runtime profile "${dpmsProfileName}" updated successfully.`
      )
    ).toBeVisible({ timeout: 60000 });
  });

  test('Can create runtime profile with Lakehouse runtime catalog', async ({
    page
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 1. Open Google Cloud Settings -> Spark and click Create runtime profile
    await openSparkSettings(page);
    await page.getByRole('button', { name: 'Create runtime profile' }).click();

    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Create a runtime profile'
      })
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#runtime-profile-region')).not.toHaveAttribute(
      'aria-disabled',
      'true',
      { timeout: 30000 }
    );

    // 2. Enter Display name and Description
    await page
      .locator('#runtime-profile-display-name')
      .fill(lakehouseProfileName);
    await page
      .locator('#runtime-profile-description')
      .fill('Testing lakehouse catalog option');

    // 3. Configure Lakehouse runtime catalog under Additional configuration
    await expandAdditionalConfig(page);
    await page
      .getByRole('button', { name: 'Edit Metastore configuration' })
      .click();

    const metastoreDrawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Metastore configuration' });
    await expect(metastoreDrawer).toBeVisible();

    await metastoreDrawer
      .locator('.node-config-card', { hasText: 'Lakehouse runtime catalog' })
      .click();
    await page.locator('#new-catalog-name').fill('biglake_catalog');
    await metastoreDrawer.getByRole('button', { name: 'Save' }).click();

    // 4. Create the runtime profile and verify success notification
    const createBtn = page.locator('.runtime-profile-submit-btn');
    await expect(createBtn).toBeEnabled({ timeout: 30000 });
    await createBtn.click();

    await expect(
      page.getByText(
        `Runtime profile "${lakehouseProfileName}" created successfully.`
      )
    ).toBeVisible({ timeout: 60000 });
  });

  test('Check and edit created runtime profile with Lakehouse runtime catalog', async ({
    page
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 1. Open Google Cloud Settings -> Spark and select the created profile
    await openSparkSettings(page);
    const profileLink = await goToProfilePageInTable(
      page,
      lakehouseProfileName
    );
    await profileLink.click();

    await expect(page.getByText('Resource details')).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Edit runtime profile'
      })
    ).toBeVisible({ timeout: 30000 });

    // 2. Verify saved Lakehouse runtime catalog details
    await expect(page.locator('#runtime-profile-display-name')).toHaveValue(
      lakehouseProfileName
    );
    await expect(page.locator('#runtime-profile-description')).toHaveValue(
      'Testing lakehouse catalog option'
    );

    await expandAdditionalConfig(page);
    await expect(
      page.locator('.section-detail-wrapper', {
        hasText: 'Metastore configuration'
      })
    ).toContainText('Lakehouse runtime catalog');

    await page
      .getByRole('button', { name: 'Edit Metastore configuration' })
      .click();
    const metastoreDrawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Metastore configuration' });
    await expect(page.locator('#new-catalog-name')).toHaveValue(
      'biglake_catalog'
    );
    await metastoreDrawer.getByRole('button', { name: 'Cancel' }).click();

    // 3. Update Description and save changes
    await page
      .locator('#runtime-profile-description')
      .fill('Testing for edit lakehouse runtime profile');

    const saveBtn = page.locator('.runtime-profile-submit-btn');
    await expect(saveBtn).toBeEnabled({ timeout: 30000 });
    await saveBtn.click();

    await expect(
      page.getByText(
        `Runtime profile "${lakehouseProfileName}" updated successfully.`
      )
    ).toBeVisible({ timeout: 60000 });
  });

  test('Can delete created runtime profiles from config screen', async ({
    page
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await openSparkSettings(page);

    for (const profileName of [dpmsProfileName, lakehouseProfileName]) {
      await goToProfilePageInTable(page, profileName);
      await page
        .getByRole('button', { name: `Actions for ${profileName}`, exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      const deleteDialog = page.getByRole('dialog');
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Delete' }).click();

      await expect(
        page.getByText(`${profileName} is deleted successfully`)
      ).toBeVisible({ timeout: 60000 });
    }
  });
});
