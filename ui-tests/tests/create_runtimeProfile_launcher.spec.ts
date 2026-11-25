/**
 * @license
 * Copyright 2026 Google LLC
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

const initializedPages = new WeakSet<Page>();

/**
 * Brings an open JupyterLab Launcher tab to the foreground, or opens a new
 * Launcher tab via the File menu if none is currently visible.
 */
async function openLauncher(page: Page) {
  const visibleLauncher = page.locator('.jp-Launcher-body:visible').first();
  if (await visibleLauncher.isVisible()) {
    return;
  }

  const launcherTab = page
    .locator('.lm-DockPanel-tabBar .lm-TabBar-tab')
    .filter({ hasText: 'Launcher' })
    .first();

  if ((await launcherTab.count()) > 0) {
    await launcherTab.click();
  } else {
    await page
      .getByLabel('main menu', { exact: true })
      .getByText('File', { exact: true })
      .click();
    await page.getByRole('menuitem', { name: /New Launcher/i }).click();
  }

  await expect(page.locator('.jp-Launcher-body:visible').first()).toBeVisible({
    timeout: 30000
  });
}

/**
 * Opens the "Create Runtime Profile" page from the JupyterLab Launcher
 * and waits for the "Create a runtime profile" form and region options to load.
 */
async function openCreateRuntimeProfileFromLauncher(page: Page) {
  await openLauncher(page);

  const card = page
    .locator('.jp-LauncherCard[data-category="Dataproc Serverless Spark"]:visible')
    .filter({ hasText: 'Create Runtime Profile' })
    .first();

  await expect(card).toBeVisible({ timeout: 60000 });
  await card.scrollIntoViewIfNeeded();
  await card.click();

  await expect(
    page.locator('.cluster-details-title', {
      hasText: 'Create a runtime profile'
    })
  ).toBeVisible({ timeout: 30000 });

  // Wait for initial auth/region options loading to settle
  await expect(page.locator('#runtime-profile-region')).not.toHaveAttribute(
    'aria-disabled',
    'true',
    { timeout: 30000 }
  );
}

/**
 * Expands the "Additional configuration" accordion if it is currently collapsed.
 * Note: When the default network is unavailable, the header displays
 * "Additional configuration (Configuration required)" and auto-expands.
 */
async function expandAdditionalConfiguration(page: Page) {
  const headerContainer = page.locator('.additional-config-header-container');
  await expect(headerContainer).toBeVisible();
  const isExpanded = await headerContainer.getAttribute('aria-expanded');
  if (isExpanded !== 'true') {
    await headerContainer.click();
  }
  await expect(page.locator('.additional-config-content')).toBeVisible();
}

/**
 * Ensures the form has a valid network/subnetwork configured so the submit button
 * is not blocked by `isDefaultNetworkUnavailable` in projects where the `default`
 * VPC lacks Private Google Access in the selected region.
 */
async function ensureValidNetworkForSubmission(page: Page) {
  const submitBtn = page.locator('.runtime-profile-submit-btn');
  const warningBanner = page.getByTestId('default-network-warning-banner');

  // Wait for initial subnetwork availability check to settle
  await expect
    .poll(
      async () => {
        const enabled = await submitBtn.isEnabled();
        const warningVisible = await warningBanner.isVisible();
        return enabled || warningVisible;
      },
      { timeout: 30000 }
    )
    .toBe(true);

  if (await warningBanner.isVisible()) {
    await warningBanner.getByRole('button', { name: 'Configure network' }).click();
    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Network and security' });
    await expect(drawer).toBeVisible();

    const primaryNetworkSelect = page.locator('#edit-primary-network');
    await expect(primaryNetworkSelect).not.toHaveAttribute(
      'aria-disabled',
      'true',
      { timeout: 20000 }
    );
    await primaryNetworkSelect.click();

    const networkOptions = page.locator('li[role="option"]');
    const optionCount = await networkOptions.count();
    const networkNames: string[] = [];
    for (let i = 0; i < optionCount; i++) {
      const text = (await networkOptions.nth(i).textContent())?.trim();
      if (text) {
        networkNames.push(text);
      }
    }
    // Close listbox before iterating
    await page.keyboard.press('Escape');

    const saveBtn = drawer.getByRole('button', { name: 'Save' });
    for (const netName of networkNames) {
      await primaryNetworkSelect.click();
      await page.getByRole('option', { name: netName, exact: true }).click();
      await expect(page.locator('#edit-subnetwork')).not.toHaveAttribute(
        'aria-disabled',
        'true',
        { timeout: 15000 }
      );
      if (await saveBtn.isEnabled()) {
        await saveBtn.click();
        break;
      }
    }

    if (await drawer.isVisible()) {
      await drawer.getByRole('button', { name: 'Cancel' }).click();
    }
  }
}

test.describe('Create Runtime Profile from launcher screen', () => {
  test('Sanity: Can render Create a runtime profile from Launcher and perform main form field validation', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);

    // 1. Verify header, submit button label, auto-generated Display name *, and synced Runtime profile name helper
    const displayNameInput = page.locator('#runtime-profile-display-name');
    const submitBtn = page.locator('.runtime-profile-submit-btn');
    await expect(displayNameInput).toBeVisible();
    await expect(submitBtn).toHaveText('Create runtime profile');

    const initialDisplayName = await displayNameInput.inputValue();
    expect(initialDisplayName).toMatch(/^runtime-[0-9a-f]{12}$/);
    await expect(page.locator('#runtime-profile-name-helper')).toHaveText(
      `Runtime profile name: ${initialDisplayName}`
    );

    // 2. Display name * required & alphanumeric validation (empty, whitespace, non-alphanumeric)
    await displayNameInput.clear();
    await expect(
      page.locator('#runtime-profile-display-name-error')
    ).toContainText('Display name is required.');
    await expect(submitBtn).toBeDisabled();

    await displayNameInput.fill('   ');
    await expect(
      page.locator('#runtime-profile-display-name-error')
    ).toContainText('Display name is required.');
    await expect(submitBtn).toBeDisabled();

    await displayNameInput.fill('---');
    await expect(
      page.locator('#runtime-profile-display-name-error')
    ).toContainText('Display name must contain at least one letter or number.');
    await expect(submitBtn).toBeDisabled();

    // Fill valid Display name -> error disappears and Runtime profile name syncs automatically
    await displayNameInput.fill('Test Runtime Profile 1');
    await expect(
      page.locator('#runtime-profile-display-name-error')
    ).toBeHidden();
    await expect(page.locator('#runtime-profile-name-helper')).toHaveText(
      'Runtime profile name: test-runtime-profile-1'
    );

    // 3. Verify Region * and Description fields
    await expect(page.locator('#runtime-profile-region')).toBeVisible();
    const descriptionInput = page.locator('#runtime-profile-description');
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill('Test runtime profile description');
    await expect(descriptionInput).toHaveValue(
      'Test runtime profile description'
    );

    // 4. Verify right-side Summary and Pricing estimate panels render default values
    const summarySection = page.getByTestId('runtime-profile-summary-section');
    await expect(summarySection).toBeVisible();
    await expect(summarySection).toContainText('Profile tier');
    await expect(summarySection).toContainText(
      'Premium (Lightning Engine enabled)'
    );
    await expect(summarySection).toContainText(
      '2.3 LTS (Spark 3.5, Java 17, Scala 2.13)'
    );
    await expect(summarySection).toContainText(
      'highmem-4 (4 vCPU, 32 GB), HDD (standard), 400 GiB'
    );
    await expect(summarySection).toContainText('Same as executor');
    await expect(summarySection).toContainText('Enabled (Min: 2, Max: 1000)');
    await expect(summarySection).toContainText('Lakehouse runtime catalog');

    const pricingSection = page.getByTestId(
      'runtime-pricing-estimate-section'
    );
    await expect(pricingSection).toBeVisible();
    await expect(page.getByTestId('pricing-hero')).toContainText(
      '16.8 DCU hours / hour of usage'
    );
    await expect(page.getByTestId('pricing-caption')).toContainText(
      'Baseline for 1 driver and 2 initial executors'
    );
    await expect(
      page.getByTestId('pricing-autoscaling-caption')
    ).toContainText('Subject to autoscaling');
    await expect(page.getByTestId('pricing-executor-row')).toContainText(
      'Executor nodes (initial 2)'
    );
    await expect(page.getByTestId('pricing-driver-row')).toContainText(
      'Driver node'
    );
    await expect(page.getByTestId('pricing-autoscaling-row')).toContainText(
      'Autoscaling range (2–1,000 executors)'
    );
    await expect(page.getByTestId('pricing-total-row')).toContainText(
      'Total (baseline)'
    );
  });

  test('Can toggle Tier (Premium vs Standard), Lightning Engine, and Executor configuration (General vs Accelerated)', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);

    const summarySection = page.getByTestId('runtime-profile-summary-section');
    const cardContainers = page.locator('.node-config-cards-container');
    const premiumCard = cardContainers
      .nth(0)
      .locator('.node-config-card')
      .filter({ hasText: 'Premium' })
      .first();
    const standardCard = cardContainers
      .nth(0)
      .locator('.node-config-card')
      .filter({ hasText: 'Standard' })
      .first();
    const generalCard = cardContainers
      .nth(1)
      .locator('.node-config-card')
      .filter({ hasText: 'General' })
      .first();
    const acceleratedCard = cardContainers
      .nth(1)
      .locator('.node-config-card')
      .filter({ hasText: 'Accelerated' })
      .first();

    // 1. By default, Premium tier is selected and Enable Lightning Engine is checked
    await expect(premiumCard).toHaveAttribute('aria-pressed', 'true');
    const lightningCheckbox = page.locator(
      'input[name="lightningEngine"][type="checkbox"]'
    );
    await expect(lightningCheckbox).toBeChecked();

    // Uncheck Lightning Engine -> Summary updates to 'Premium'
    await lightningCheckbox.uncheck();
    await expect(summarySection).toContainText('Premium');
    await expect(summarySection).not.toContainText(
      'Premium (Lightning Engine enabled)'
    );

    // Re-check Lightning Engine -> Summary updates back to 'Premium (Lightning Engine enabled)'
    await lightningCheckbox.check();
    await expect(summarySection).toContainText(
      'Premium (Lightning Engine enabled)'
    );

    // 2. Switch Executor category to 'Accelerated' on Premium tier
    // L4 executors have fixed local SSD size (shows 'SSD (premium)' without size)
    // and CPU-only driver fallback ('highmem-4' = 5.6 DCU + 2 * 4.0 DCU = 13.6 DCU)
    await acceleratedCard.click();
    await expect(acceleratedCard).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByText(
        'Shapes with GPUs attached, for training and inference workloads'
      )
    ).toBeVisible();
    await expect(summarySection).toContainText(
      'l4-4 (4 vCPU, 16 GB, 1 GPU), SSD (premium)'
    );
    await expect(page.getByTestId('pricing-hero')).toContainText(
      '13.6 DCU hours / hour of usage'
    );

    // Open Executor type dropdown and select another GPU shape (l4-8)
    await page.locator('#runtime-profile-executor-type').click();
    await page
      .getByRole('option', {
        name: 'L4 (8 vCPU)',
        exact: true
      })
      .click();
    await expect(summarySection).toContainText(
      'l4-8 (8 vCPU, 32 GB, 1 GPU), SSD (premium)'
    );

    // 3. Switch Tier to 'Standard' -> resets category to General & shape to standard-4, disables Accelerated card, shows info banner
    await standardCard.click();
    await expect(standardCard).toHaveAttribute('aria-pressed', 'true');
    await expect(lightningCheckbox).toBeHidden();
    await expect(
      page.locator('.runtime-profile-tier-info-banner')
    ).toBeVisible();
    await expect(acceleratedCard).toHaveAttribute('aria-disabled', 'true');
    await expect(generalCard).toHaveAttribute('aria-pressed', 'true');
    await expect(summarySection).toContainText('Standard');
    await expect(summarySection).toContainText(
      'standard-4 (4 vCPU, 16 GB), HDD (standard), 400 GiB'
    );

    // Verify High memory shapes are filtered out on Standard tier
    await page.locator('#runtime-profile-executor-type').click();
    await expect(
      page.getByRole('option', {
        name: 'standard-8 (8 vCPU, 32 GB)',
        exact: true
      })
    ).toBeVisible();
    await expect(
      page.getByRole('option', {
        name: 'highmem-4 (4 vCPU, 32 GB)',
        exact: true
      })
    ).toBeHidden();
    await page
      .getByRole('option', {
        name: 'standard-8 (8 vCPU, 32 GB)',
        exact: true
      })
      .click();

    // 4. Switch Tier back to 'Premium'
    await premiumCard.click();
    await expect(premiumCard).toHaveAttribute('aria-pressed', 'true');
    await expect(lightningCheckbox).toBeVisible();
  });

  test('Can expand Additional configuration and verify all 7 configuration sections and default properties', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    const expectedSections = [
      {
        title: 'Runtime configuration',
        expectedTexts: [
          'Runtime profile name',
          'Spark runtime version',
          '2.3 LTS (Spark 3.5, Java 17, Scala 2.13)',
          'Custom spark image',
          'None',
          'Cloud storage staging bucket',
          'Auto',
          'Python package repository',
          'Google managed PyPI pull-through cache'
        ]
      },
      {
        title: 'Executor and driver configuration',
        expectedTexts: [
          'Tier',
          'Premium (Lightning Engine enabled)',
          'Driver machine type',
          'highmem-4 (4 vCPU, 32 GB)',
          'Driver disk',
          'HDD (standard), 400 GiB',
          'Executor type',
          'Executor disk'
        ]
      },
      {
        title: 'Autoscaling',
        expectedTexts: [
          'Autoscaling',
          'On',
          'Initial executors',
          '2',
          'Minimum executors',
          'Maximum executors',
          '1000'
        ]
      },
      {
        title: 'Metastore configuration',
        expectedTexts: [
          'Metastore',
          'Lakehouse runtime catalog',
          'Hive endpoint',
          'Disabled'
        ]
      },
      {
        title: 'Network and security',
        expectedTexts: [
          'Execution identity',
          'Service account',
          'Network in this project',
          'Encryption',
          'Google managed'
        ]
      },
      {
        title: 'Session lifecycle',
        expectedTexts: [
          'Maximum idle time',
          'None',
          'Maximum session time'
        ]
      },
      {
        title: 'Other customizations',
        expectedTexts: ['Spark properties', 'None', 'Labels']
      }
    ];

    for (const section of expectedSections) {
      const wrapper = page.locator('.section-detail-wrapper', {
        hasText: section.title
      });
      await expect(wrapper).toBeVisible();
      for (const text of section.expectedTexts) {
        await expect(wrapper).toContainText(text);
      }
    }
  });

  test('Can edit and validate Runtime configuration drawer and Select/Create Bucket drawers', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page
      .getByRole('button', { name: 'Edit Runtime configuration' })
      .click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Runtime configuration' });
    await expect(
      drawer.locator('.edit-drawer-title', {
        hasText: 'Runtime configuration'
      })
    ).toBeVisible();

    const profileNameInput = page.locator('#edit-runtime-profile-name');
    const saveBtn = drawer.getByRole('button', { name: 'Save' });

    // 1. Validate Runtime profile name * (required & format regex)
    await profileNameInput.clear();
    await expect(
      page.locator('#runtime-profile-name-error-text')
    ).toContainText('Runtime profile name is required.');
    await expect(saveBtn).toBeDisabled();

    await profileNameInput.fill('ab');
    await expect(
      page.locator('#runtime-profile-name-error-text')
    ).toContainText(
      'A runtime profile name must start and end in a letter or a number, be between 4 and 63 characters long, and contain only lowercase letters, numbers, and hyphens.'
    );
    await expect(saveBtn).toBeDisabled();

    await profileNameInput.fill('Invalid_Profile_ID!');
    await expect(
      page.locator('#runtime-profile-name-error-text')
    ).toBeVisible();
    await expect(saveBtn).toBeDisabled();

    await profileNameInput.fill('custom-runtime-01');
    await expect(page.locator('#runtime-profile-name-error-text')).toBeHidden();

    // 2. Change Spark runtime version * to 3.0
    await page.locator('#edit-dataproc-runtime-version').click();
    await page
      .getByRole('option', {
        name: '3.0 (Spark 4.0, Java 21, Scala 2.13)'
      })
      .click();

    // 3. Fill Custom spark image & Python package repository
    await page
      .locator('#edit-custom-spark-image')
      .fill('us-central1-docker.pkg.dev/my-proj/spark/custom:latest');
    await page
      .locator('#edit-python-package-repository')
      .fill('https://us-central1-python.pkg.dev/my-proj/pypi/simple/');

    // 4. Validate Staging bucket & test Browse -> Select bucket -> Create a bucket flow
    const stagingBucketInput = page.locator(
      '#edit-cloud-storage-staging-bucket'
    );
    await stagingBucketInput.fill('INVALID_BUCKET_NAME!');
    await expect(page.locator('#staging-bucket-error-text')).toContainText(
      'Enter the name of an existing bucket. Try browsing for the bucket instead.'
    );
    await expect(saveBtn).toBeDisabled();

    // Open Select bucket drawer via Browse button
    await drawer.getByRole('button', { name: 'Browse' }).click();
    await expect(
      page.locator('.edit-drawer-title', { hasText: 'Select bucket' })
    ).toBeVisible();

    // Toggle bucket search input
    await page.locator('#bucket-browser-search-btn').click();
    await expect(page.locator('#bucket-search-input')).toBeVisible();
    await page.locator('#bucket-search-clear-btn').click();

    // Open Create a bucket drawer and verify Create button is disabled when name is empty
    await page.locator('#bucket-browser-create-btn').click();
    await expect(
      page.locator('.edit-drawer-title', { hasText: 'Create a bucket' })
    ).toBeVisible();
    const createBucketDrawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Create a bucket' });
    const createBtn = createBucketDrawer.getByRole('button', {
      name: 'Create'
    });
    await expect(createBtn).toBeDisabled();

    // Close Create a bucket drawer and Select bucket drawer, then clear staging bucket ('Auto')
    await createBucketDrawer.getByRole('button', { name: 'Cancel' }).click();
    const selectBucketDrawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Select bucket' });
    await selectBucketDrawer.getByRole('button', { name: 'Cancel' }).click();

    await stagingBucketInput.clear();
    await expect(page.locator('#staging-bucket-error-text')).toBeHidden();
    await expect(saveBtn).toBeEnabled();

    // 5. Save Runtime configuration drawer and verify main form, Summary, and detached profile name
    await saveBtn.click();

    const runtimeConfigSection = page.locator('.section-detail-wrapper', {
      hasText: 'Runtime configuration'
    });
    await expect(runtimeConfigSection).toContainText('custom-runtime-01');
    await expect(runtimeConfigSection).toContainText(
      '3.0 (Spark 4.0, Java 21, Scala 2.13)'
    );
    await expect(runtimeConfigSection).toContainText(
      'us-central1-docker.pkg.dev/my-proj/spark/custom:latest'
    );
    await expect(runtimeConfigSection).toContainText(
      'https://us-central1-python.pkg.dev/my-proj/pypi/simple/'
    );
    await expect(
      page.getByTestId('runtime-profile-summary-section')
    ).toContainText('3.0 (Spark 4.0, Java 21, Scala 2.13)');

    // Customizing Runtime profile name in the drawer permanently detaches it from Display name edits
    await page
      .locator('#runtime-profile-display-name')
      .fill('Updated Display Name');
    await expect(page.locator('#runtime-profile-name-helper')).toHaveText(
      'Runtime profile name: custom-runtime-01'
    );
  });

  test('Can edit Executor and driver configuration drawer including custom driver configuration', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page
      .getByRole('button', { name: 'Edit Executor and driver configuration' })
      .click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Executor and driver configuration' });
    await expect(drawer).toBeVisible();

    // 1. Change Executor disk tier to SSD (premium) and size to 1500 GiB (valid selectable SSD size)
    await page.locator('#edit-executor-disk-tier').click();
    await page.getByRole('option', { name: 'SSD (premium)' }).click();

    await page.locator('#edit-executor-disk-size').click();
    await page.getByRole('option', { name: '1500 GiB', exact: true }).click();

    // 2. Check 'Use different configuration for driver'
    const diffDriverCheckbox = drawer.getByRole('checkbox', {
      name: /Use different configuration for driver/i
    });
    await diffDriverCheckbox.check();
    await expect(diffDriverCheckbox).toBeChecked();

    // Verify Driver configuration sub-panel is visible
    await expect(page.locator('#edit-driver-machine-type')).toBeVisible();
    await expect(page.locator('#edit-driver-disk-tier')).toBeVisible();
    await expect(page.locator('#edit-driver-disk-size')).toBeVisible();

    // Change Driver machine type to 'standard-8 (8 vCPU, 32 GB)' and Driver disk size to 750 GiB
    await page.locator('#edit-driver-machine-type').click();
    await page
      .getByRole('option', {
        name: 'standard-8 (8 vCPU, 32 GB)',
        exact: true
      })
      .click();

    await page.locator('#edit-driver-disk-size').click();
    await page.getByRole('option', { name: '750 GiB', exact: true }).click();

    // Save changes
    await drawer.getByRole('button', { name: 'Save' }).click();

    // Verify Executor and driver configuration section and Summary panel reflect custom driver config
    const execDriverSection = page.locator('.section-detail-wrapper', {
      hasText: 'Executor and driver configuration'
    });
    await expect(execDriverSection).toContainText('standard-8 (8 vCPU, 32 GB)');
    await expect(execDriverSection).toContainText('SSD (premium), 1500 GiB');
    await expect(execDriverSection).toContainText('SSD (premium), 750 GiB');

    const summarySection = page.getByTestId('runtime-profile-summary-section');
    await expect(summarySection).toContainText(
      'standard-8 (8 vCPU, 32 GB), SSD (premium), 750 GiB'
    );
  });

  test('Can edit and validate Autoscaling drawer (integer, minimum >= 2, cross-field bounds, and disabling autoscaling)', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page.getByRole('button', { name: 'Edit Autoscaling' }).click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Autoscaling' });
    await expect(drawer).toBeVisible();

    const initialInput = page.locator('#edit-initial-executors');
    const minInput = page.locator('#edit-minimum-executors');
    const maxInput = page.locator('#edit-maximum-executors');
    const saveBtn = drawer.getByRole('button', { name: 'Save' });

    // 1. Non-integer validation
    await initialInput.fill('abc');
    await expect(page.locator('#initial-executors-error-text')).toContainText(
      'Initial executors must be an integer.'
    );
    await expect(saveBtn).toBeDisabled();

    // 2. Minimum >= 2 validation on all 3 fields
    await initialInput.fill('1');
    await expect(page.locator('#initial-executors-error-text')).toContainText(
      'Initial executors must be greater than or equal to 2.'
    );

    await minInput.fill('1');
    await expect(page.locator('#minimum-executors-error-text')).toContainText(
      'Minimum executors must be greater than or equal to 2.'
    );

    await maxInput.fill('1');
    await expect(page.locator('#maximum-executors-error-text')).toContainText(
      'Maximum executors must be greater than or equal to 2.'
    );

    // 3. Cross-field range validation (Initial < Minimum and Minimum > Maximum)
    await minInput.fill('10');
    await maxInput.fill('5');
    await initialInput.fill('4');
    await expect(page.locator('#initial-executors-error-text')).toContainText(
      'Initial executors must be between minimum and maximum executors.'
    );
    await expect(page.locator('#minimum-executors-error-text')).toContainText(
      'Minimum executors must not exceed maximum executors.'
    );
    await expect(saveBtn).toBeDisabled();

    // 4. Fill valid autoscaling counts (Initial=4, Min=2, Max=50) and save
    await minInput.fill('2');
    await maxInput.fill('50');
    await initialInput.fill('4');
    await expect(page.locator('#initial-executors-error-text')).toBeHidden();
    await expect(page.locator('#minimum-executors-error-text')).toBeHidden();
    await expect(page.locator('#maximum-executors-error-text')).toBeHidden();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    const autoscalingSection = page.locator('.section-detail-wrapper', {
      hasText: 'Autoscaling'
    });
    await expect(autoscalingSection).toContainText('4');
    await expect(autoscalingSection).toContainText('50');
    await expect(
      page.getByTestId('runtime-profile-summary-section')
    ).toContainText('Enabled (Min: 2, Max: 50)');
    await expect(page.getByTestId('pricing-executor-row')).toContainText(
      'Executor nodes (initial 4)'
    );
    await expect(page.getByTestId('pricing-autoscaling-row')).toContainText(
      'Autoscaling range (2–50 executors)'
    );

    // 5. Re-open Autoscaling drawer, uncheck 'Enabled', and save
    await page.getByRole('button', { name: 'Edit Autoscaling' }).click();
    await page.locator('#edit-autoscaling-enabled').uncheck();
    await expect(initialInput).toBeDisabled();
    await expect(minInput).toBeDisabled();
    await expect(maxInput).toBeDisabled();
    await drawer.getByRole('button', { name: 'Save' }).click();

    await expect(autoscalingSection).toContainText('Off');
    await expect(
      page.getByTestId('runtime-profile-summary-section')
    ).toContainText('Disabled');
    await expect(page.getByTestId('pricing-autoscaling-row')).toBeHidden();
  });

  test('Can edit and validate Metastore configuration drawer (Lakehouse runtime catalog, Iceberg/Hive endpoints, and Dataproc Metastore)', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page
      .getByRole('button', { name: 'Edit Metastore configuration' })
      .click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Metastore configuration' });
    await expect(drawer).toBeVisible();

    const saveBtn = drawer.getByRole('button', { name: 'Save' });

    // 1. Lakehouse runtime catalog is selected by default with Iceberg REST Endpoint checked
    const newCatalogInput = page.locator('#new-catalog-name');
    await expect(newCatalogInput).toBeVisible();

    // Validate invalid Default catalog name (dots/spaces/special chars disallowed)
    await newCatalogInput.fill('invalid.catalog.name!');
    await expect(
      drawer.getByText(
        'Use only letters, numbers, hyphens (-) and underscores (_).'
      )
    ).toBeVisible();
    await expect(saveBtn).toBeDisabled();

    // Valid catalog name clears error
    await newCatalogInput.fill('custom_lakehouse_catalog');
    await expect(
      drawer.getByText(
        'Use only letters, numbers, hyphens (-) and underscores (_).'
      )
    ).toBeHidden();
    await expect(saveBtn).toBeEnabled();

    // 2. Toggle 'Choose existing catalog in project' and back to 'Define new default catalog'
    await drawer.getByLabel('Choose existing catalog in project').check();
    await expect(page.locator('#existing-catalog-select')).toBeVisible();
    await drawer.getByLabel('Define new default catalog').check();

    // 3. Enable Hive Endpoint and validate Hive Catalog Name *
    const hiveCheckbox = drawer.getByLabel('Hive Endpoint');
    await hiveCheckbox.check();
    await expect(page.locator('#hive-project-id')).toBeVisible();
    await expect(page.locator('#hive-catalog-name')).toBeVisible();

    await page.locator('#hive-catalog-name').fill('bad.hive.name!');
    await expect(
      drawer.getByText(
        'Use only letters, numbers, hyphens (-) and underscores (_).'
      )
    ).toBeVisible();
    await expect(saveBtn).toBeDisabled();

    // Uncheck Hive Endpoint and save Lakehouse configuration
    await hiveCheckbox.uncheck();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // 4. Re-open Metastore configuration and switch to Dataproc Metastore
    await page
      .getByRole('button', { name: 'Edit Metastore configuration' })
      .click();
    await drawer
      .locator('.node-config-card', { hasText: 'Dataproc Metastore' })
      .click();
    await expect(page.locator('#dpms-project-id')).toBeVisible();
    await expect(page.locator('#dpms-service-select')).toBeVisible();
    await drawer.getByRole('button', { name: 'Save' }).click();

    const metastoreSection = page.locator('.section-detail-wrapper', {
      hasText: 'Metastore configuration'
    });
    await expect(metastoreSection).toContainText('None');
    await expect(metastoreSection).not.toContainText('Hive endpoint');
  });

  test('Can edit and validate Network and security drawer (Project networks, Shared VPC, Execution identity, and Cloud KMS encryption)', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page
      .getByRole('button', { name: 'Edit Network and security' })
      .click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Network and security' });
    await expect(drawer).toBeVisible();

    const saveBtn = drawer.getByRole('button', { name: 'Save' });

    // 1. Networks in this project vs Networks shared from host project
    await expect(page.locator('#edit-network-source-project')).toBeChecked();
    await expect(page.locator('#edit-primary-network')).toBeVisible();
    await expect(page.locator('#edit-subnetwork')).toBeVisible();
    await page
      .locator('#edit-network-tags')
      .fill('spark-net-tag-1, spark-net-tag-2');

    // Switch to Shared VPC
    await page.locator('#edit-network-source-shared').click();
    await expect(page.locator('#edit-shared-subnetwork')).toBeVisible();

    // Switch back to Networks in this project and wait for subnetwork loading to settle
    await page.locator('#edit-network-source-project').click();
    await expect(page.locator('#edit-subnetwork')).not.toHaveAttribute(
      'aria-disabled',
      'true',
      { timeout: 20000 }
    );

    // 2. Execute notebooks with: User Account vs Service Account
    await page.locator('#edit-execution-identity-user-account').click();
    await expect(page.locator('#edit-service-account')).toBeHidden();

    await page.locator('#edit-execution-identity-service-account').click();
    await expect(page.locator('#edit-service-account')).toBeVisible();
    await page
      .locator('#edit-service-account')
      .fill('custom-sa@test-project.iam.gserviceaccount.com');

    // 3. Encryption: Google-managed vs Cloud KMS key (select & manual entry)
    await expect(
      page.locator('#edit-encryption-google-managed')
    ).toBeChecked();

    await page.locator('#edit-encryption-customer-managed').click();
    await expect(page.locator('#edit-kms-mode-select')).toBeChecked();
    await expect(page.locator('#edit-kms-keyring')).toBeVisible();
    await expect(page.locator('#edit-kms-key')).toBeVisible();

    // Switch to 'Enter key manually'
    await page.locator('#edit-kms-mode-manual').click();
    const manualKeyInput = page.locator('#edit-kms-key-name');
    await expect(manualKeyInput).toBeVisible();

    // Invalid KMS key format disables Save
    await manualKeyInput.fill('invalid-kms-key-path');
    await expect(saveBtn).toBeDisabled();

    // Valid KMS key format enables Save (provided a subnetwork is available)
    await manualKeyInput.fill(
      'projects/test-proj/locations/us-central1/keyRings/test-ring/cryptoKeys/test-key'
    );
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();

      const networkSection = page.locator('.section-detail-wrapper', {
        hasText: 'Network and security'
      });
      await expect(networkSection).toContainText('Service account');
      await expect(networkSection).toContainText('Customer managed');
    } else {
      await drawer.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('Can edit and validate Session lifecycle drawer (Max idle time & Max session time bounds and units)', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page
      .getByRole('button', { name: 'Edit Session lifecycle' })
      .click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Session lifecycle' });
    await expect(drawer).toBeVisible();

    const idleQtyInput = page.locator('#edit-max-idle-time-quantity');
    const idleUnitSelect = page.locator('#edit-max-idle-time-unit');
    const sessionQtyInput = page.locator('#edit-max-session-time-quantity');
    const sessionUnitSelect = page.locator('#edit-max-session-time-unit');
    const saveBtn = drawer.getByRole('button', { name: 'Save' });

    // 1. Validate Max idle time quantity (integer & 10 minutes .. 330 hours range)
    await idleQtyInput.fill('abc');
    await expect(
      page.locator('#max-idle-time-quantity-error-text')
    ).toContainText('Max idle time quantity must be an integer.');
    await expect(saveBtn).toBeDisabled();

    // 5 minutes (< 10 minutes minimum)
    await idleQtyInput.fill('5');
    await expect(
      page.locator('#max-idle-time-quantity-error-text')
    ).toContainText('Max idle time must be between 10 minutes and 330 hours.');
    await expect(saveBtn).toBeDisabled();

    // Switch idle unit to hours and test > 330 hours (400 hours)
    await idleUnitSelect.click();
    await page.getByRole('option', { name: 'hours' }).click();
    await idleQtyInput.fill('400');
    await expect(
      page.locator('#max-idle-time-quantity-error-text')
    ).toContainText('Max idle time must be between 10 minutes and 330 hours.');

    // Set valid Max idle time: 2 hours
    await idleQtyInput.fill('2');
    await expect(
      page.locator('#max-idle-time-quantity-error-text')
    ).toBeHidden();

    // 2. Validate Max session time quantity (integer & 10 minutes .. 330 hours range)
    await sessionQtyInput.fill('xyz');
    await expect(
      page.locator('#max-session-time-quantity-error-text')
    ).toContainText('Max session time quantity must be an integer.');
    await expect(saveBtn).toBeDisabled();

    // 20 days (> 330 hours maximum)
    await sessionQtyInput.fill('20');
    await expect(
      page.locator('#max-session-time-quantity-error-text')
    ).toContainText(
      'Max session time must be between 10 minutes and 330 hours.'
    );
    await expect(saveBtn).toBeDisabled();

    // Switch session unit to hours and set valid Max session time: 24 hours
    await sessionUnitSelect.click();
    await page.getByRole('option', { name: 'hours' }).click();
    await sessionQtyInput.fill('24');
    await expect(
      page.locator('#max-session-time-quantity-error-text')
    ).toBeHidden();
    await expect(saveBtn).toBeEnabled();

    // 3. Save and verify Session lifecycle section updates
    await saveBtn.click();

    const lifecycleSection = page.locator('.section-detail-wrapper', {
      hasText: 'Session lifecycle'
    });
    await expect(lifecycleSection).toContainText('2 hours');
    await expect(lifecycleSection).toContainText('24 hours');
  });

  test('Can edit and validate Other customizations drawer (Spark properties and Labels validation)', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await expandAdditionalConfiguration(page);

    await page
      .getByRole('button', { name: 'Edit Other customizations' })
      .click();

    const drawer = page
      .locator('.edit-drawer-container')
      .filter({ hasText: 'Other customizations' });
    await expect(drawer).toBeVisible();

    const addPropertyBtn = drawer.getByRole('button', {
      name: '+ Add property'
    });
    const addLabelBtn = drawer.getByRole('button', { name: '+ Add label' });
    const saveBtn = drawer.getByRole('button', { name: 'Save' });

    // 1. Spark properties validation: empty key, duplicate key, and removal
    await addPropertyBtn.click();
    await expect(page.locator('#spark-key-error-0')).toContainText(
      'Key is required'
    );
    await expect(addPropertyBtn).toBeDisabled();
    await expect(saveBtn).toBeDisabled();

    await page
      .locator('#edit-spark-property-key-0')
      .fill('spark.sql.shuffle.partitions');
    await page.locator('#edit-spark-property-value-0').fill('200');
    await expect(page.locator('#spark-key-error-0')).toBeHidden();
    await expect(addPropertyBtn).toBeEnabled();

    // Add second Spark property with duplicate key
    await addPropertyBtn.click();
    await page
      .locator('#edit-spark-property-key-1')
      .fill('spark.sql.shuffle.partitions');
    await expect(page.locator('#spark-key-error-1')).toContainText(
      'The key is already present'
    );
    await expect(saveBtn).toBeDisabled();

    // Remove the duplicate Spark property row
    await drawer
      .getByRole('button', { name: 'Remove Spark property 2' })
      .click();
    await expect(saveBtn).toBeEnabled();

    // 2. Labels validation: empty key, invalid key format, invalid value format, duplicate key, and removal
    await addLabelBtn.click();
    await expect(page.locator('#label-key-error-0')).toContainText(
      'Key is required'
    );
    await expect(addLabelBtn).toBeDisabled();
    await expect(saveBtn).toBeDisabled();

    // Invalid key starting with uppercase/special characters
    await page.locator('#edit-label-key-0').fill('Invalid_Key!');
    await expect(page.locator('#label-key-error-0')).toContainText(
      'Only hyphens (-), underscores (_), lowercase characters, and numbers are allowed. Keys must start with a lowercase character. International characters are allowed.'
    );

    // Valid key, invalid value
    await page.locator('#edit-label-key-0').fill('environment');
    await expect(page.locator('#label-key-error-0')).toBeHidden();

    await page.locator('#edit-label-value-0').fill('InvalidValue!');
    await expect(page.locator('#label-value-error-0')).toContainText(
      'Only hyphens (-), underscores (_), lowercase characters, and numbers are allowed. International characters are allowed.'
    );
    await expect(saveBtn).toBeDisabled();

    // Valid value
    await page.locator('#edit-label-value-0').fill('production_01');
    await expect(page.locator('#label-value-error-0')).toBeHidden();
    await expect(addLabelBtn).toBeEnabled();

    // Add second label with duplicate key
    await addLabelBtn.click();
    await page.locator('#edit-label-key-1').fill('environment');
    await expect(page.locator('#label-key-error-1')).toContainText(
      'The key is already present'
    );
    await expect(saveBtn).toBeDisabled();

    // Remove duplicate label row
    await drawer.getByRole('button', { name: 'Remove label 2' }).click();
    await expect(saveBtn).toBeEnabled();

    // 3. Save Other customizations and verify section displays saved Spark property and Label
    await saveBtn.click();

    const otherCustomizationsSection = page.locator(
      '.section-detail-wrapper',
      { hasText: 'Other customizations' }
    );
    await expect(otherCustomizationsSection).toContainText(
      'spark.sql.shuffle.partitions: 200'
    );
    await expect(otherCustomizationsSection).toContainText(
      'environment: production_01'
    );
  });

  test('Can cancel or go back from Create a runtime profile screen', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // 1. Clicking Cancel button closes the Create a runtime profile screen
    await openCreateRuntimeProfileFromLauncher(page);
    await page.locator('.runtime-profile-cancel-btn').click();
    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Create a runtime profile'
      })
    ).toBeHidden();

    // 2. Clicking Back arrow icon closes the Create a runtime profile screen
    await openCreateRuntimeProfileFromLauncher(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Create a runtime profile'
      })
    ).toBeHidden();
  });

  test('Handles API error gracefully when runtime profile creation fails', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await ensureValidNetworkForSubmission(page);

    await page
      .locator('#runtime-profile-display-name')
      .fill('error-test-profile');
    await page
      .locator('#runtime-profile-description')
      .fill('Simulated API error test');

    await page.route('**/sessionTemplates*', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 400,
              message: 'Simulated runtime profile creation error'
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    const submitBtn = page.locator('.runtime-profile-submit-btn');
    await expect(submitBtn).toBeEnabled({ timeout: 30000 });
    await submitBtn.click();

    await expect(
      page.getByText('Simulated runtime profile creation error')
    ).toBeVisible({ timeout: 15000 });

    // Form stays open so the user can fix inputs or retry
    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Create a runtime profile'
      })
    ).toBeVisible();
  });

  test('Can create a runtime profile and verify it is created and available on the Launcher screen', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await openCreateRuntimeProfileFromLauncher(page);
    await ensureValidNetworkForSubmission(page);

    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    const suffix = Math.random().toString(36).slice(2, 6);
    const profileName = `auto-profile-${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(
      now.getSeconds()
    )}-${suffix}`;

    // 1. Fill Display name * and Description, and verify Runtime profile name syncs
    await page.locator('#runtime-profile-display-name').fill(profileName);
    await expect(page.locator('#runtime-profile-name-helper')).toHaveText(
      `Runtime profile name: ${profileName}`
    );
    await page
      .locator('#runtime-profile-description')
      .fill('Automated E2E runtime profile created from Launcher');

    // 2. Submit the form to create the runtime profile
    const submitBtn = page.locator('.runtime-profile-submit-btn');
    await expect(submitBtn).toHaveText('Create runtime profile');
    await expect(submitBtn).toBeEnabled({ timeout: 30000 });
    await submitBtn.click();

    // 3. Verify creation toast notification
    await expect(
      page.getByText(`Runtime profile "${profileName}" created successfully.`)
    ).toBeVisible({ timeout: 60000 });

    // 4. Verify the Create form closes and opens Google Cloud Settings -> Spark (Runtime Profiles) listing
    await expect(
      page.locator('.cluster-details-title', {
        hasText: 'Create a runtime profile'
      })
    ).toBeHidden({ timeout: 60000 });

    const runtimeProfilesTable = page.locator('.runtime-profile-table');
    await expect(runtimeProfilesTable).toBeVisible({ timeout: 60000 });

    const profileRow = runtimeProfilesTable
      .locator('tr', { hasText: profileName })
      .first();
    const nextPageBtn = page
      .locator('.table-footer .pagination-btn', { hasText: '>' })
      .first();

    for (let pageIdx = 0; pageIdx < 5; pageIdx++) {
      if (await profileRow.isVisible()) {
        break;
      }
      const canGoNext =
        (await nextPageBtn.isVisible()) &&
        !(await nextPageBtn.evaluate(el => el.classList.contains('disabled')));
      if (!canGoNext) {
        break;
      }
      await nextPageBtn.click();
      await expect(runtimeProfilesTable).toBeVisible({ timeout: 30000 });
    }
    await expect(profileRow).toBeVisible({ timeout: 30000 });

    // 5. Switch to the JupyterLab Launcher screen and verify the created runtime profile card is available
    await openLauncher(page);

    const activeLauncher = page.locator('.jp-Launcher-body:visible').first();
    const createdLauncherCard = activeLauncher
      .locator(
        '.jp-LauncherCard[data-category="Dataproc Serverless Spark"]',
        { hasText: profileName }
      )
      .first();

    // `registerSessionKernelsInLauncher` registers the kernel immediately after creation.
    // If the remote Dataproc Kernel Gateway takes a few seconds to expose the new
    // sessionTemplate in `/api/kernelspecs`, reload so `src/index.ts` re-fetches specs.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await expect(createdLauncherCard).toBeVisible({ timeout: 20000 });
        break;
      } catch {
        await page.reload();
        await page
          .locator('.jp-Launcher-body')
          .first()
          .waitFor({ timeout: 60000 });
        await openLauncher(page);
      }
    }

    await expect(createdLauncherCard).toBeVisible({ timeout: 60000 });
    await createdLauncherCard.scrollIntoViewIfNeeded();
    await expect(createdLauncherCard).toContainText(profileName);
  });
});
