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

test.describe('Serverless batches and sessions.', () => {
  // Helper function to navigate to the Serverless page and wait for it to load
  async function navigateToServerless(page: Page) {
    await page
      .locator(
        '//*[@data-category="Google Cloud Resources" and @title="Serverless"]'
      )
      .click();
    await page.getByText('Loading Batches').waitFor({ state: 'detached' });
  }

  // Function to validate all the fields which are common for different Batch types
  async function validateCommonFields(page: Page) {
    await expect(page.getByLabel('Custom container image')).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Specify a custom container image to add Java or Python dependencies not provided by the default container")]'
      )
    ).toBeVisible();
    await expect(page.getByLabel('Files', { exact: true })).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Files are included in the working directory of each executor. Can be a GCS file")]'
      )
    ).toBeVisible();
    await expect(page.getByLabel('Archive files')).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Archive files are extracted in the Spark working directory. Can be a GCS file")]'
      )
    ).toBeVisible();
    await expect(page.getByLabel('Arguments')).toBeVisible();

    // Check Execution Configuration section fields
    await expect(page.getByText('Execution Configuration')).toBeVisible();
    await expect(
      page
        .locator('//div[@class="lightning-header lightning-sub-header"]')
        .getByText('Tier')
    ).toBeVisible();
    await expect(
      page.locator(
        '//div[@class="lightning-content"]//input[@type="radio" and @value="premium"]'
      )
    ).toBeVisible();
    await expect(
      page.locator('//input[@name="lightningEngine" and @type="checkbox"]')
    ).toBeDisabled();
    await expect(
      page.locator(
        '//div[@class="lightning-engine-label" and text()="Enable Lightning Engine "]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//div[@class="lightning-engine-label"]/div[text()="Learn more"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//div[@class="lightning-content"]//input[@type="radio" and @value="default"]'
      )
    ).toBeChecked();

    await expect(page.getByText('Execute notebooks with:')).toBeVisible();
    await expect(
      page.locator('//div[@class="create-runtime-radio"]//input').first()
    ).toBeChecked();
    const classNameLocator =
      '//div[@class="create-runtime-radio  execution-config-radio"]';
    await expect(
      page
        .locator(
          classNameLocator +
            '//input/parent::*/preceding-sibling::div[text()="Service Account"]'
        )
        .first()
    ).toBeVisible();
    await expect(page.getByLabel('Service account')).toBeVisible();
    await expect(
      page.locator('//div[@class="create-runtime-radio"]//input').nth(1)
    ).not.toBeChecked();
    await expect(
      page.locator(
        classNameLocator +
          '//input/ancestor::div[2]//div[2][text()="User Account"]'
      )
    ).toBeVisible();
    await page.locator(classNameLocator + '//input').nth(1).click();
    await expect(
      page.getByLabel('Service account for system operations')
    ).toBeVisible();
    await page.locator(classNameLocator + '//input').first().click();

    await expect(page.getByText('Network Configuration')).toBeVisible();
    await expect(
      page.getByText(
        'Establishes connectivity for the VM instances in this cluster.'
      )
    ).toBeVisible();

    // Check Network Configuration 2 radio buttons
    await expect(
      page.locator(
        '//div[@class="create-runtime-radio"]/div[text()="Networks in this project"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//div[@class="create-batch-message" and contains(text(),"Networks shared from host project")]'
      )
    ).toBeVisible();

    // Check by default 'Networks in this project' radio button is checked
    await expect(
      page.locator(
        '//div[@class="create-runtime-radio"]//input[@value="projectNetwork"]'
      )
    ).toBeChecked();

    // Check Primary network and subnetwork fields having value 'default'
    await page.getByTestId('loader').waitFor({ state: 'detached' });
    await expect(
      page.locator(
        '//label[text()="Primary network*"]/following-sibling::div//input[@value="default"]'
      )
    ).toBeVisible();
    await page.getByTestId('loader').first().waitFor({ state: 'detached' });
    await expect(
      page.locator(
        '//label[text()="Subnetwork*"]/following-sibling::div//input[@value="default"]'
      )
    ).toBeVisible();

    await expect(page.getByLabel('Network tags')).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Network tags are text attributes you can add to make firewall rules")]'
      )
    ).toBeVisible();

    // Check Encryption section
    await expect(page.getByText('Encryption', { exact: true })).toBeVisible();
    await expect(page.getByText('Google-managed encryption key')).toBeVisible();
    await expect(page.getByText('No configuration required')).toBeVisible();
    await expect(
      page.getByText('Customer-managed encryption key (CMEK)')
    ).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Google Cloud Key Management Service")]'
      )
    ).toBeVisible();

    // Check by default 'Google-managed encryption key' radio button is checked
    await expect(
      page
        .locator(
          '//div[@class="create-batch-radio"]//input[@value="googleManaged"]'
        )
        .first()
    ).toBeChecked();

    // Check Peripheral Configuration section
    await expect(page.getByText('Peripheral Configuration')).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Configure Dataproc to use Dataproc Metastore as its Hive metastore")]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"We recommend this option to persist table metadata when the batch finishes processing")]'
      )
    ).toBeVisible();

    // Check History server cluster section
    await expect(
      page.getByText('History server cluster').first()
    ).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Choose a history server cluster to store logs in.")]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="History server cluster"]/following-sibling::div/input[@role="combobox"]'
      )
    ).toBeVisible();

    // Check Properties section
    await expect(page.getByText('Properties', { exact: true })).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Key 1*"]/following-sibling::div/input[@value="dataproc.tier"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Value 1"]/following-sibling::div/input[@value="standard"]'
      )
    ).toBeVisible();

    await expect(
      page.locator(
        '//label[text()="Key 2*"]/following-sibling::div/input[@value="spark.dataproc.engine"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Value 2"]/following-sibling::div/input[@value="default"]'
      )
    ).toBeVisible();

    // Check dataproc.tier property value after enabling Lightning Engine
    await page
      .locator(
        '//div[@class="lightning-content"]//input[@type="radio" and @value="premium"]'
      )
      .click();
    await expect(
      page.locator('//input[@name="lightningEngine" and @type="checkbox"]')
    ).toBeChecked();
    await expect(
      page.locator(
        '//label[text()="Value 1"]/following-sibling::div/input[@value="premium"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Value 2"]/following-sibling::div/input[@value="lightningEngine"]'
      )
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'ADD PROPERTY' })
    ).toBeVisible();

    // Add property validation: Empty key should show an error
    await page.getByRole('button', { name: 'ADD PROPERTY' }).click();
    await expect(page.getByText('key is required')).toBeVisible();

    // Check if the ADD PROPERTY button is disabled
    let isDisabled = await page
      .getByRole('button', { name: 'ADD PROPERTY' })
      .getAttribute('class');
    expect(isDisabled).toContain('disabled');

    // Fill the key field and ensure the error is hidden
    await page.getByLabel('Key 3*').first().fill('key');
    await expect(page.getByText('key is required')).toBeHidden();

    // Click on the value field and ensure the ADD PROPERTY button is enabled
    await page.getByLabel('Value 3').first().click();
    isDisabled = await page
      .getByRole('button', { name: 'ADD PROPERTY' })
      .getAttribute('class');
    expect(isDisabled).not.toContain('disabled');

    // Delete added property
    await page.locator('.labels-delete-icon').click();

    // Check labels section
    await expect(page.getByText('Labels', { exact: true })).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Key 1*"]/following-sibling::div/input[@value="client"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Value 1"]/following-sibling::div/input[@value="bigquery-jupyter-plugin"]'
      )
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'ADD LABEL' })).toBeVisible();
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await expect(page.getByText('key is required')).toBeVisible();

    // Fill the key field and ensure the error is hidden
    await page.getByLabel('Key 2*').nth(1).fill('key');
    await expect(page.getByText('key is required')).toBeHidden();
    await page.getByLabel('Value 2').nth(1).click();

    // Delete added label
    await page.locator('.labels-delete-icon').click();
  }

  test('Sanity: Can verify tabs, header buttons, and back/cancel navigation', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Verify the presence of Batches and Sessions tabs and header buttons
    await expect(page.getByText('Batches', { exact: true })).toBeVisible();
    await expect(page.getByText('Sessions', { exact: true })).toBeVisible();
    await expect(page.getByText('Create Batch')).toBeVisible();
    await expect(page.getByText('Refresh', { exact: true })).toBeVisible();

    // Click Refresh button and verify Batches view reloads
    await page.getByText('Refresh', { exact: true }).click();
    await page
      .getByText('Loading Batches')
      .waitFor({ state: 'detached' })
      .catch(() => {});
    await expect(page.getByText('Batches', { exact: true })).toBeVisible();

    // Click on Create Batch button and then Back button
    await page.getByText('Create Batch').click();
    await expect(page.getByText('Create batch')).toBeVisible();
    await expect(page.getByText('Batch info')).toBeVisible();
    await page.locator('.back-arrow-icon > .icon-white > svg > path').click();
    await expect(page.getByText('Batch info')).not.toBeVisible();

    // Click on Create Batch button and then Cancel button
    await page.getByText('Create Batch').click();
    await expect(page.getByText('Batch info')).toBeVisible();
    await page.getByLabel('cancel Batch').click();
    await expect(page.getByText('Batch info')).not.toBeVisible();
    await expect(page.getByText('Create Batch')).toBeVisible();
  });

  test('Sanity: Can verify batches tab table headers', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Verify the presence of Batches and Sessions tabs
    await expect(page.getByText('Batches', { exact: true })).toBeVisible();
    await expect(page.getByText('Sessions', { exact: true })).toBeVisible();

    // Check if Batches table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Verify the presence of search field and all column headers on Batches tab
      await expect(page.getByPlaceholder('Filter Table')).toBeVisible();
      const headers = [
        'Batch ID',
        'Status',
        'Location',
        'Tier',
        'Engine',
        'Creation time',
        'Elapsed time',
        'Type',
        'Actions'
      ];
      for (const header of headers) {
        await expect(
          page.getByRole('columnheader', { name: header, exact: true })
        ).toBeVisible();
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate Filter Table search field on batches listing page', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      const batchId = await page.getByRole('cell').first().innerText();
      const filterInput = page.getByPlaceholder('Filter Table');

      // Filter with valid Batch ID
      await filterInput.fill(batchId);
      const filteredRows = page.locator('tbody.clusters-table-body tr');
      expect(await filteredRows.count()).toBeGreaterThanOrEqual(1);
      await expect(
        page.getByRole('cell', { name: batchId, exact: true })
      ).toBeVisible();

      // Filter with non-matching search term
      await filterInput.fill('nonexistent_batch_xyz_12345');
      await expect(filteredRows).toHaveCount(0);

      // Clear filter and verify rows are restored
      await filterInput.fill('');
      expect(await filteredRows.count()).toBeGreaterThan(0);
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can click on Batch ID and validate the batch details', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Check if Batches table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Capture and click the first Batch ID
      const batchId = await page.getByRole('cell').first().innerText();
      await page.getByRole('cell').first().click();

      // Wait till Batch Details page loads
      await page
        .getByText('Loading Batch Details')
        .waitFor({ state: 'detached' });

      // Verify the batch details header and action buttons
      await expect(
        page.locator('.back-arrow-icon > .icon-white > svg > path')
      ).toBeVisible();
      await expect(
        page.locator(
          `//*[@class="cluster-details-title" and text()="${batchId}"]`
        )
      ).toBeVisible();
      const buttons = ['CLONE', 'DELETE', 'VIEW SPARK LOGS', 'VIEW CLOUD LOGS'];
      for (const button of buttons) {
        await expect(
          page.getByRole('button', { name: button, exact: true })
        ).toBeVisible();
      }

      // Verify all batch details labels
      const texts = [
        'Batch ID',
        'Batch UUID',
        'Resource type',
        'Tier',
        'Engine',
        'Status',
        'Start time',
        'Elapsed time',
        'Creator',
        'Details',
        'Version',
        'Region',
        'Batch type',
        'Properties',
        'Environment config',
        'Execution config',
        'Encryption type',
        'Labels'
      ];
      for (const text of texts) {
        await expect(
          page.getByText(text, { exact: true }).first()
        ).toBeVisible();
      }

      // If DELETE button is enabled, verify Cancel on delete confirmation dialog
      const deleteBtn = page.getByRole('button', {
        name: 'DELETE',
        exact: true
      });
      const deleteClass = (await deleteBtn.getAttribute('class')) || '';
      if (!deleteClass.includes('disabled')) {
        await deleteBtn.click();
        await expect(
          page.getByText(`This will delete ${batchId} and cannot be undone.`)
        ).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(
          page.getByText(`This will delete ${batchId} and cannot be undone.`)
        ).toBeHidden();
      }

      // Verify back button navigates back to Batches list
      await page.locator('.back-arrow-icon').first().click();
      await expect(page.getByText('Create Batch')).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test.only('Can perform field validations and configuration toggles on Create Batch page', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and click Create Batch button
    await navigateToServerless(page);
    await page.getByText('Create Batch').click();

    // Wait for Primary network and Subnetwork to finish loading
    await expect(
      page.locator(
        '//label[text()="Primary network*"]/following-sibling::div//input[@value="default"]'
      )
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(
        '//label[text()="Subnetwork*"]/following-sibling::div//input[@value="default"]'
      )
    ).toBeVisible({ timeout: 15000 });

    // 1. Batch ID field validation: Empty field should show error
    await page.getByLabel('Batch ID*').fill('');
    await expect(page.getByText('ID is required')).toBeVisible();
    await page.getByLabel('Batch ID*').fill('batch-test01');
    await expect(page.getByText('ID is required')).toBeHidden();

    // 2. Spark type: Main class & Main jar URI radio toggle and validations
    await page.getByLabel('Main class*').fill('test.Main');
    await page.getByLabel('Main class*').fill('');
    await expect(page.getByText('Main class is required')).toBeVisible();

    await page
      .locator('//div[@class="create-batch-radio"]//input[@value="mainJarURI"]')
      .click();
    await expect(page.getByLabel('Main jar*')).toBeVisible();
    await page.getByLabel('Main jar*').fill('invalid_jar.jar');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await page.getByLabel('Main jar*').fill('gs://bucket/main.jar');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeHidden();

    await page
      .locator('//div[@class="create-batch-radio"]//input[@value="mainClass"]')
      .click();
    await page
      .getByLabel('Main class*')
      .fill('org.apache.spark.examples.SparkPi');

    // 3. Chip inputs (Jar files, Files, Archive files, Arguments, Network tags) scheme & duplicate validations
    const clearChipInput = async () => {
      const deleteIcons = page.locator(
        '.select-job-style .MuiChip-deleteIcon, .select-job-style svg[data-testid="CancelIcon"]'
      );
      while ((await deleteIcons.count()) > 0) {
        await deleteIcons.first().click();
      }
    };

    // Jar files scheme prefix validation & duplicate validation
    await page.getByLabel('Jar files').fill('invalid_jar');
    await page.getByLabel('Jar files').press('Enter');
    await expect(
      page.getByText(
        "All files must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await clearChipInput();
    await expect(
      page.getByText(
        "All files must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeHidden();

    await page.getByLabel('Jar files').fill('gs://bucket/test.jar');
    await page.getByLabel('Jar files').press('Enter');
    await page.getByLabel('Jar files').fill('gs://bucket/test.jar');
    await page.getByLabel('Jar files').press('Enter');
    await expect(
      page.getByText('Duplicate paths are not allowed')
    ).toBeVisible();
    await clearChipInput();
    await expect(
      page.getByText('Duplicate paths are not allowed')
    ).toBeHidden();

    // Files scheme prefix validation
    await page.getByLabel('Files', { exact: true }).fill('invalid_file');
    await page.getByLabel('Files', { exact: true }).press('Enter');
    await expect(
      page.getByText(
        "All files must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await clearChipInput();

    // Archive files scheme prefix validation
    await page.getByLabel('Archive files').fill('invalid_archive');
    await page.getByLabel('Archive files').press('Enter');
    await expect(
      page.getByText(
        "All files must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await clearChipInput();

    // Arguments duplicate validation
    await page.getByLabel('Arguments').fill('arg1');
    await page.getByLabel('Arguments').press('Enter');
    await page.getByLabel('Arguments').fill('arg1');
    await page.getByLabel('Arguments').press('Enter');
    await expect(
      page.getByText('Duplicate paths are not allowed')
    ).toBeVisible();
    await clearChipInput();

    // Network tags duplicate validation
    await page.getByLabel('Network tags').fill('tag1');
    await page.getByLabel('Network tags').press('Enter');
    await page.getByLabel('Network tags').fill('tag1');
    await page.getByLabel('Network tags').press('Enter');
    await expect(
      page.getByText('Duplicate paths are not allowed')
    ).toBeVisible();
    await clearChipInput();

    // 4. PySpark, SparkR, and SparkSql file prefix & Query parameters validations
    // Switch to PySpark
    await page.getByRole('combobox', { name: 'Batch type*' }).click();
    await page.getByRole('option', { name: 'PySpark' }).click();
    await page.getByLabel('Main python file*').fill('invalid.py');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await page.getByLabel('Main python file*').fill('gs://bucket/main.py');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeHidden();

    await page.getByLabel('Additional python files').fill('invalid_extra.py');
    await page.getByLabel('Additional python files').press('Enter');
    await expect(
      page.getByText(
        "All files must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await clearChipInput();

    // Switch to SparkR
    await page.getByRole('combobox', { name: 'Batch type*' }).click();
    await page.getByRole('option', { name: 'SparkR' }).click();
    await page.getByLabel('Main R file*').fill('invalid.R');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await page.getByLabel('Main R file*').fill('gs://bucket/main.R');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeHidden();

    // Switch to SparkSql and validate Query file & Query parameters
    await page.getByRole('combobox', { name: 'Batch type*' }).click();
    await page.getByRole('option', { name: 'SparkSql' }).click();
    await page.getByLabel('Query file*').fill('invalid.sql');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeVisible();
    await page.getByLabel('Query file*').fill('gs://bucket/query.sql');
    await expect(
      page.getByText(
        "File must include a valid scheme prefix: 'file://', 'gs://', or 'hdfs://'"
      )
    ).toBeHidden();

    await expect(page.getByText('Query parameters')).toBeVisible();
    await page.getByRole('button', { name: 'ADD PARAMETER' }).click();
    await expect(page.getByText('key is required')).toBeVisible();
    await page.getByLabel('Key 1*').first().fill('param_key');
    await expect(page.getByText('key is required')).toBeHidden();
    await page.getByLabel('Value 1').first().fill('param_val');
    await page.locator('.labels-delete-icon').first().click();

    // 5. Network Configuration: Shared VPC radio toggle
    await page
      .locator('//div[@class="create-runtime-radio"]//input[@value="sharedVpc"]')
      .click();
    await expect(page.getByLabel('Shared subnetwork')).toBeVisible();
    await page
      .locator(
        '//div[@class="create-runtime-radio"]//input[@value="projectNetwork"]'
      )
      .click();
    await expect(
      page.locator('//label[text()="Primary network*"]')
    ).toBeVisible({ timeout: 15000 });

    // 6. Encryption: CMEK & manual key validation
    await page
      .locator('//div[@class="create-batch-radio"]//input[@value="googleManaged"]')
      .nth(1)
      .click();
    await expect(page.getByLabel('Key rings')).toBeVisible();
    await expect(page.getByLabel('Keys')).toBeVisible();
    await expect(page.getByLabel('Enter key manually')).toBeDisabled();

    await page.locator('.manual-input input[type="radio"]').click();
    await expect(page.getByLabel('Enter key manually')).toBeEnabled();
    await page.getByLabel('Enter key manually').fill('invalid-kms-key');
    await expect(
      page.getByText(
        'Example format:projects/<project-name>/locations/<location-name>/keyRings/<keyring-name>/cryptoKeys/<key-name>'
      )
    ).toBeVisible();
    await page
      .getByLabel('Enter key manually')
      .fill(
        'projects/test-proj/locations/us-central1/keyRings/ring-1/cryptoKeys/key-1'
      );
    await expect(
      page.getByText(
        'Example format:projects/<project-name>/locations/<location-name>/keyRings/<keyring-name>/cryptoKeys/<key-name>'
      )
    ).toBeHidden();

    // Switch back to Google-managed encryption key
    await page
      .locator('//div[@class="create-batch-radio"]//input[@value="googleManaged"]')
      .first()
      .click();

    // 7. Labels: format & duplicate key validations
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('INVALID_KEY');
    await expect(
      page.getByText(
        'Only hyphens (-), underscores (_), lowercase characters, and numbers are allowed. Keys must start with a lowercase character. International characters are allowed.'
      )
    ).toBeVisible();
    await page.locator('.labels-delete-icon').first().click();

    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('client');
    await expect(page.getByText('The key is already present')).toBeVisible();
    await page.locator('.labels-delete-icon').first().click();

    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('valid_key');
    await page.getByLabel('Value 2').nth(1).fill('INVALID_VAL');
    await expect(
      page.getByText(
        'Only hyphens (-), underscores (_), lowercase characters, and numbers are allowed. International characters are allowed.'
      ).nth(1)
    ).toBeVisible();
    await page.locator('.labels-delete-icon').first().click();

    // Cancel and return to Batches view
    await page.getByLabel('cancel Batch').click();
    await expect(page.getByText('Create Batch')).toBeVisible();
  });

  test('Can validate all the fields and create a serverless batch with PySpark type', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and click Create Batch button
    await navigateToServerless(page);
    await page.getByText('Create Batch').click();

    // Capture the generated Batch ID for validation
    const batchId = await page.getByLabel('Batch ID*').inputValue();

    // Select PySpark batch type
    await page.getByLabel('Open', { exact: true }).first().click();
    await page.getByRole('option', { name: 'PySpark' }).click();

    // Validate all expected fields with default values are displayed
    await expect(page.getByLabel('Runtime version*')).toBeVisible();
    await expect(page.getByLabel('Main python file*')).toBeVisible();
    await expect(
      page.locator(
        '//*[@class="submit-job-message-input" and contains(text(),"Can be a GCS file with the gs:// prefix, an HDFS file on the")]'
      )
    ).toBeVisible();
    await expect(page.getByLabel('Main python file*')).toBeVisible();
    await expect(page.getByLabel('Additional python files')).toBeVisible();
    await expect(page.getByLabel('Jar files')).toBeVisible();

    // Check all the displayed fields on the page
    await validateCommonFields(page);

    // Enter all mandatory fields data to create a serverless batch
    await page
      .getByLabel('Main python file*')
      .fill(
        'gs://us-central1-test-am-5a4039ed-bucket/dataproc-notebooks/wrapper_papermill.py'
      );

    // Select the project
    await page.getByRole('combobox', { name: 'Project ID' }).click();
    // await page.getByRole('combobox', { name: 'Project ID' }).fill('kokoro');
    // await page.getByRole('option', { name: 'dataproc-kokoro-tests' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).fill('dataproc');
    await page
      .getByRole('option', { name: 'dataproc-jupyter-extension-dev' })
      .click();
    await page.waitForTimeout(5000);

    // Select Metastore service
    await page.getByRole('combobox', { name: 'Metastore services' }).click();
    await page.getByRole('option').first().click();

    // Add Label
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('goog-dataproc-location');
    await page.getByLabel('Value 2').nth(1).fill('us-central1');

    // Submit the batch and verify confirmation message
    const submitButton = page.getByLabel('submit Batch');

    // Wait until the button becomes enabled (max 5 seconds)
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(
      page.getByText(`Batch ${batchId} successfully submitted`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('Can validate all the fields and create a serverless batch with type Spark', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and click Create Batch button
    await navigateToServerless(page);
    await page.getByText('Create Batch').click();

    // Capture the generated Batch ID for validation
    const batchId = await page.getByLabel('Batch ID*').inputValue();

    // Check Batch type is Spark by default
    const batchType = await page.getByLabel('Batch type*').inputValue();
    expect(batchType).toBe('Spark');

    // Validate all expected fields with default values are displayed
    await expect(page.getByLabel('Runtime version*')).toBeVisible();

    await expect(page.getByText('Main class', { exact: true })).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"The fully qualified name of a class in a provided or standard jar file, for example, com.example.wordcount.")]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '//div[@class="create-batch-radio"]//input[@value="mainClass"]'
      )
    ).toBeChecked();
    await expect(page.getByLabel('Main class*')).toBeVisible();
    await expect(page.getByText('Main jar URI')).toBeVisible();
    await expect(page.getByLabel('Jar files')).toBeVisible();

    // Check all the displayed fields on the page
    await validateCommonFields(page);

    // Enter all mandatory fields data to create a serverless batch
    await page
      .getByLabel('Main class*')
      .fill('org.apache.spark.examples.SparkPi');

    // Select the project
    await page.getByRole('combobox', { name: 'Project ID' }).click();
    // await page.getByRole('combobox', { name: 'Project ID' }).fill('kokoro');
    // await page.getByRole('option', { name: 'dataproc-kokoro-tests' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).fill('dataproc');
    await page
      .getByRole('option', { name: 'dataproc-jupyter-extension-dev' })
      .click();
    await page.waitForTimeout(5000);

    // Select Metastore service
    await page.getByRole('combobox', { name: 'Metastore services' }).click();
    await page.getByRole('option').first().click();

    // Add Label
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('goog-dataproc-location');
    await page.getByLabel('Value 2').nth(1).fill('us-central1');

    // Submit the batch and verify confirmation message
    const submitButton = page.getByLabel('submit Batch');

    // Wait until the button becomes enabled (max 5 seconds)
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(
      page.getByText(`Batch ${batchId} successfully submitted`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('Can validate all the fields and create a serverless batch with type SparkR', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and click Create Batch button
    await navigateToServerless(page);
    await page.getByText('Create Batch').click();

    // Capture the generated Batch ID for validation
    const batchId = await page.getByLabel('Batch ID*').inputValue();

    // Select SparkR batch type
    await page.getByLabel('Open', { exact: true }).first().click();
    await page.getByRole('option', { name: 'SparkR' }).click();

    // Validate all expected fields with default values are displayed
    await expect(page.getByLabel('Runtime version*')).toBeVisible();
    await expect(page.getByLabel('Main R file*')).toBeVisible();
    await expect(
      page.locator(
        '//*[@class="submit-job-message-input" and contains(text(),"Can be a GCS file with the gs://")]'
      )
    ).toBeVisible();

    // Check all the displayed fields on the page
    await validateCommonFields(page);

    // Enter all mandatory fields data to create a serverless batch
    await page
      .getByLabel('Main R file*')
      .fill('gs://dataproc-extension/DO NOT DELETE/helloworld.r');

    // Select the project
    await page.getByRole('combobox', { name: 'Project ID' }).click();
    // await page.getByRole('combobox', { name: 'Project ID' }).fill('kokoro');
    // await page.getByRole('option', { name: 'dataproc-kokoro-tests' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).fill('dataproc');
    await page
      .getByRole('option', { name: 'dataproc-jupyter-extension-dev' })
      .click();
    await page.waitForTimeout(5000);

    // Select Metastore service
    await page.getByRole('combobox', { name: 'Metastore services' }).click();
    await page.getByRole('option').first().click();

    // Add Label
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('goog-dataproc-location');
    await page.getByLabel('Value 2').nth(1).fill('us-central1');

    // Submit the batch and verify confirmation message
    const submitButton = page.getByLabel('submit Batch');

    // Wait until the button becomes enabled (max 5 seconds)
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(
      page.getByText(`Batch ${batchId} successfully submitted`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('Can validate all the fields and create a serverless batch with type SparkSql', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and click Create Batch button
    await navigateToServerless(page);
    await page.getByText('Create Batch').click();

    // Capture the generated Batch ID for validation
    const batchId = await page.getByLabel('Batch ID*').inputValue();

    // Select SparkSql batch type
    await page.getByLabel('Open', { exact: true }).first().click();
    await page.getByRole('option', { name: 'SparkSql' }).click();

    // Validate all expected fields with default values are displayed
    await expect(page.getByLabel('Query file*')).toBeVisible();
    await expect(
      page
        .locator(
          '//*[@class="create-messagelist" and contains(text(),"Can be a GCS file with the gs://")]'
        )
        .first()
    ).toBeVisible();

    // Check all the displayed fields on the page
    await expect(page.getByLabel('Custom container image')).toBeVisible();
    await expect(
      page.locator(
        '//*[contains(text(),"Specify a custom container image to add Java or Python dependencies not provided by the default container")]'
      )
    ).toBeVisible();
    await expect(page.getByLabel('Jar files')).toBeVisible();
    await expect(
      page.locator(
        '//*[@class="create-messagelist" and contains(text(),"Jar files are included in the CLASSPATH. Can be a GCS")]'
      )
    ).toBeVisible();
    await expect(page.getByText('Query parameters')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'ADD PARAMETER' })
    ).toBeVisible();

    // Enter all mandatory fields data to create a serverless batch
    await page
      .getByLabel('Query file*')
      .fill('gs://dataproc-extension/DO NOT DELETE/sampleSQL.sql');

    // Select the project
    await page.getByRole('combobox', { name: 'Project ID' }).click();
    // await page.getByRole('combobox', { name: 'Project ID' }).fill('kokoro');
    // await page.getByRole('option', { name: 'dataproc-kokoro-tests' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).fill('dataproc');
    await page
      .getByRole('option', { name: 'dataproc-jupyter-extension-dev' })
      .click();
    await page.waitForTimeout(5000);

    // Select Metastore service
    await page.getByRole('combobox', { name: 'Metastore services' }).click();
    await page.getByRole('option').first().click();

    // Add Label
    await page.getByRole('button', { name: 'ADD LABEL' }).click();
    await page.getByLabel('Key 2*').nth(1).fill('goog-dataproc-location');
    await page.getByLabel('Value 2').nth(1).fill('us-central1');

    // Submit the batch and verify confirmation message
    const submitButton = page.getByLabel('submit Batch');

    // Wait until the button becomes enabled (max 5 seconds)
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    await expect(
      page.getByText(`Batch ${batchId} successfully submitted`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('Can cancel delete batch popup from batches listing page', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      const batchCount = await page
        .locator('//div[@aria-label="Delete Job"]')
        .count();
      let batchId = '';
      let foundEnabled = false;

      for (let i = 0; i < batchCount; i++) {
        const deleteButton = page
          .locator('//div[@aria-label="Delete Job"]')
          .nth(i);
        const isDisabled = await deleteButton.isDisabled();
        if (!isDisabled) {
          batchId = await page
            .locator(`//tbody/tr[${i + 1}]/td[@role="cell"]`)
            .first()
            .innerText();
          await deleteButton.click();
          foundEnabled = true;
          break;
        }
      }

      if (foundEnabled) {
        await expect(
          page.getByText(`This will delete ${batchId} and cannot be undone.`)
        ).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(
          page.getByText(`This will delete ${batchId} and cannot be undone.`)
        ).toBeHidden();
        await expect(
          page.getByRole('cell', { name: batchId, exact: true })
        ).toBeVisible();
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can delete a batch using actions delete icon', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Check if Batches table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Attempt to delete the first enabled batch by iterating through the list
      const batchCount = await page
        .locator('//div[@aria-label="Delete Job"]')
        .count();
      let batchId = '';
      let isDeleted = false;

      for (let i = 0; i < batchCount; i++) {
        const deleteButton = page
          .locator('//div[@aria-label="Delete Job"]')
          .nth(i);
        const isDisabled = await deleteButton.isDisabled();

        if (!isDisabled) {
          batchId = await page
            .locator(`//tbody/tr[${i + 1}]/td[@role="cell"]`)
            .first()
            .innerText();
          await deleteButton.click();
          console.log(`Deleted batch ID: ${batchId}`);
          isDeleted = true;
          break;
        }
      }

      if (isDeleted) {
        // Confirm deletion and verify success message
        await expect(
          page.getByText(`This will delete ${batchId} and cannot be undone.`)
        ).toBeVisible();
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.waitForTimeout(5000);
        await expect(
          page.getByText(`Batch ${batchId} deleted successfully`)
        ).toBeVisible();
      } else {
        console.log(
          'No enabled Delete Job button found. Skipping deletion steps.'
        );
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can delete a batch from batch details page', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Check if Batches table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Capture and click the first Batch ID
      const batchId = await page.getByRole('cell').first().innerText();
      await page.getByRole('cell').first().click();

      // Click the delete button, confirm deletion, and verify success message
      await page.getByRole('button', { name: 'DELETE', exact: true }).click();
      await expect(
        page.getByText(`This will delete ${batchId} and cannot be undone.`)
      ).toBeVisible();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(5000);
      await expect(
        page.getByText(`Batch ${batchId} deleted successfully`)
      ).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can clone the batch and create a new one', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Check if Batches table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Click on first Batch ID
      await page.getByRole('cell').first().click();

      // Wait till the Batch Details page loads
      await page
        .getByText('Loading Batch Details')
        .waitFor({ state: 'detached' });

      // Click on clone button, verify cancel returns to details, then clone again to submit
      await page.getByRole('button', { name: 'CLONE' }).click();
      await expect(page.getByText('Create batch')).toBeVisible();
      await page.getByLabel('cancel Batch').click();
      await expect(page.getByRole('button', { name: 'CLONE' })).toBeVisible();

      await page.getByRole('button', { name: 'CLONE' }).click();
      const batchId = await page.getByLabel('Batch ID*').inputValue();

      // Wait until Primary network* and Subnetwork* finish loading (labels no longer have spinners)
      await expect(
        page.locator('//label[text()="Primary network*"]')
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator('//label[text()="Subnetwork*"]')
      ).toBeVisible({ timeout: 15000 });

      // Select Primary network* if not already set to default
      const primaryNetworkValue = await page
        .getByRole('combobox', { name: 'Primary network*' })
        .inputValue();
      if (primaryNetworkValue !== 'default') {
        await page.getByRole('combobox', { name: 'Primary network*' }).click();
        await page.getByRole('option', { name: 'default' }).click();
        await expect(
          page.locator('//label[text()="Subnetwork*"]')
        ).toBeVisible({ timeout: 15000 });
      }

      // Select Subnetwork*
      await page.getByRole('combobox', { name: 'Subnetwork*' }).click();
      await page.getByRole('option', { name: 'default' }).click();

      // Ensure goog-dataproc-location label is present
      const hasLocationLabel = await page
        .locator('//input[@value="goog-dataproc-location"]')
        .isVisible();
      if (!hasLocationLabel) {
        await page.getByRole('button', { name: 'ADD LABEL' }).click();
        await page
          .locator('.job-label-edit-row')
          .last()
          .locator('input')
          .first()
          .fill('goog-dataproc-location');
        await page
          .locator('.job-label-edit-row')
          .last()
          .locator('input')
          .nth(1)
          .fill('us-central1');
      }

      // Submit the batch and verify confirmation message
      const submitButton = page.getByLabel('submit Batch');
      await expect(submitButton).toBeEnabled({ timeout: 5000 });
      await submitButton.click();
      await expect(
        page.getByText(`Batch ${batchId} successfully submitted`)
      ).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Sanity: Can verify sessions tab table headers', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    // Click on Sessions tab and wait for it to load
    await page.getByText('Sessions', { exact: true }).click();
    await page.getByText('Loading Sessions').waitFor({ state: 'detached' });

    // Check if Sessions table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Verify search field and column headers on Sessions tab
      await expect(page.getByPlaceholder('Filter Table')).toBeVisible();
      const headers = [
        'Session ID',
        'Status',
        'Location',
        'Engine',
        'Creator',
        'Creation time',
        'Elapsed time',
        'Actions'
      ];
      for (const header of headers) {
        await expect(
          page.getByRole('columnheader', { name: header, exact: true })
        ).toBeVisible();
      }
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can validate Filter Table search field on sessions listing page', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and switch to Sessions tab
    await navigateToServerless(page);
    await page.getByText('Sessions', { exact: true }).click();
    await page.getByText('Loading Sessions').waitFor({ state: 'detached' });

    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      const sessionId = await page.getByRole('cell').first().innerText();
      const filterInput = page.getByPlaceholder('Filter Table');

      // Filter with valid Session ID
      await filterInput.fill(sessionId);
      const filteredRows = page.locator('tbody.clusters-table-body tr');
      expect(await filteredRows.count()).toBeGreaterThanOrEqual(1);
      await expect(
        page.getByRole('cell', { name: sessionId, exact: true })
      ).toBeVisible();

      // Filter with non-matching search term
      await filterInput.fill('nonexistent_session_xyz_12345');
      await expect(filteredRows).toHaveCount(0);

      // Clear filter and verify rows are restored
      await filterInput.fill('');
      expect(await filteredRows.count()).toBeGreaterThan(0);
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can click on Session ID and validate the session details', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and switch to Sessions tab
    await navigateToServerless(page);
    await page.getByText('Sessions', { exact: true }).click();

    // Wait for Sessions to load
    await page.getByText('Loading Sessions').waitFor({ state: 'detached' });

    // Check if Sessions table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Click on first session id
      await page.getByRole('cell').first().click();

      // Wait for Session Details to load
      await page
        .getByText('Loading Session Details')
        .waitFor({ state: 'detached' });

      // Verify the session details
      await expect(
        page.locator('.back-arrow-icon > .icon-white > svg > path')
      ).toBeVisible();
      await expect(
        page.getByLabel('Serverless').getByText('Name', { exact: true })
      ).toBeVisible();
      const expectedTexts = [
        'Session details',
        'UUID',
        'Engine',
        'Status',
        'Create time',
        'Details',
        'Elapsed time',
        'Properties',
        'Environment config',
        'Execution config',
        'Encryption type',
        'Labels'
      ];
      for (const text of expectedTexts) {
        await expect(
          page.getByText(text, { exact: true }).first()
        ).toBeVisible();
      }
      const expectedButtons = [
        'TERMINATE',
        'VIEW SPARK LOGS',
        'VIEW CLOUD LOGS'
      ];
      for (const button of expectedButtons) {
        await expect(
          page.getByRole('button', { name: button, exact: true })
        ).toBeVisible();
      }

      // Click back arrow icon and verify returning to Sessions list
      await page.locator('.back-arrow-icon').first().click();
      await expect(page.getByText('Session details')).toBeHidden();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Can delete a session', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and switch to Sessions tab
    await navigateToServerless(page);
    await page.getByText('Sessions', { exact: true }).click();

    // Wait till the page loads
    await page.getByText('Loading Sessions').waitFor({ state: 'detached' });

    // Check if Sessions table data is present
    const tableExists = await page
      .locator('//table[@class="clusters-list-table"]')
      .isVisible();
    if (tableExists) {
      // Get the first session id
      const sessionId = await page.getByRole('cell').first().innerText();

      // Click Delete Session and verify Cancel button closes the popup
      await page.getByTitle('Delete Session').first().click();
      await expect(
        page.getByText(
          'This will delete ' + sessionId + ' and cannot be undone.'
        )
      ).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(
        page.getByText(
          'This will delete ' + sessionId + ' and cannot be undone.'
        )
      ).toBeHidden();

      // Delete the first session and confirm
      await page.getByTitle('Delete Session').first().click();
      await expect(
        page.getByText(
          'This will delete ' + sessionId + ' and cannot be undone.'
        )
      ).toBeVisible();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(5000);
      await expect(
        page.getByText('Session ' + sessionId + ' deleted successfully')
      ).toBeVisible();
    } else {
      await expect(page.getByText('No rows to display')).toBeVisible();
    }
  });

  test('Check pagination in serverless batches tab', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page
    await navigateToServerless(page);

    const isNotificationPresent = await page
      .getByRole('button', { name: 'Ignore' })
      .isVisible();
    if (isNotificationPresent)
      await page.getByRole('button', { name: 'Ignore' }).click();

    // Check if pagination is visible on the page
    const paginationLocator = page
      .locator('//div[@class="pagination-parent-view"]/div')
      .first();
    const isPaginationVisible = await paginationLocator.isVisible();

    // Function to validate row count
    const validateRowCount = async (
      tableRowsLocator: Locator,
      expectedCount: number
    ) => {
      const rowCount = await tableRowsLocator.count();
      expect(rowCount).toBeLessThanOrEqual(expectedCount);
    };

    // Function to navigate and validate row count
    const navigateAndValidate = async (
      buttonLocator: Locator,
      tableRowsLocator: Locator,
      expectedCount: number
    ) => {
      await buttonLocator.click();
      await page.waitForTimeout(2000);
      await validateRowCount(tableRowsLocator, expectedCount);
    };

    // Function to validate the range
    const validateRange = async (
      pageRange: Locator,
      expectedStart: number,
      expectedEnd: number
    ) => {
      const rangeText = await pageRange.textContent();
      const [currentRange] = rangeText!.split(' of ');
      const [start, end] = currentRange.split(' - ').map(Number);
      expect(start).toBe(expectedStart);
      expect(end).toBeLessThanOrEqual(expectedEnd);
    };

    if (isPaginationVisible) {
      const tableRowsLocator = page.locator(
        '//tbody[@class="clusters-table-body"]/tr[@role="row"]'
      );

      // Verify the default row count and selected pagination number
      await validateRowCount(tableRowsLocator, 50);
      const currentRowsPerPage = await paginationLocator.innerText();
      expect(currentRowsPerPage).toBe('Rows per page: 50');

      // Validate pagination controls
      const leftArrow = page
        .locator('//div[contains(@class,"page-move-button")]')
        .first();
      const rightArrow = page
        .locator('//div[contains(@class,"page-move-button")]')
        .nth(1);
      const pageRange = page.locator('//div[@class="page-display-part"]');

      // Validate the displayed row range and total count
      const rangeText = await pageRange.textContent();
      const [, totalCount] = rangeText!.split(' of ');

      if (parseInt(totalCount) > 50) {
        // Validate the initial range
        await validateRange(pageRange, 1, 50);

        // Navigate to the next page using the right arrow and validate
        await navigateAndValidate(rightArrow, tableRowsLocator, 50);

        // Validate the range after clicking right arrow
        await validateRange(pageRange, 51, 100);

        // Navigate to the previous page using the left arrow and validate
        await navigateAndValidate(leftArrow, tableRowsLocator, 50);

        // Validate the range after clicking left arrow
        await validateRange(pageRange, 1, 50);
      }
    } else {
      // If the pagination view not present in the page
      expect(isPaginationVisible).toBe(false);
    }
  });

  test('Check pagination in serverless sessions tab', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Navigate to Serverless page and switch to Sessions tab
    await navigateToServerless(page);
    await page.getByText('Sessions', { exact: true }).click();
    await page.getByText('Loading Sessions').waitFor({ state: 'detached' });

    const isNotificationPresent = await page
      .getByRole('button', { name: 'Ignore' })
      .isVisible();
    if (isNotificationPresent) {
      await page.getByRole('button', { name: 'Ignore' }).click();
    }

    const paginationLocator = page.locator('.pagination-parent-view');
    const isPaginationVisible = await paginationLocator.isVisible();

    const validateRowCount = async (
      tableRowsLocator: Locator,
      expectedCount: number
    ) => {
      const rowCount = await tableRowsLocator.count();
      expect(rowCount).toBeLessThanOrEqual(expectedCount);
    };

    const navigateAndValidate = async (
      buttonLocator: Locator,
      tableRowsLocator: Locator,
      expectedCount: number
    ) => {
      await buttonLocator.click();
      await page.waitForTimeout(2000);
      await validateRowCount(tableRowsLocator, expectedCount);
    };

    const validateRange = async (
      pageRange: Locator,
      expectedStart: number,
      expectedEnd: number
    ) => {
      const rangeText = await pageRange.textContent();
      const [currentRange] = rangeText!.split(' of ');
      const [start, end] = currentRange.split(' - ').map(Number);
      expect(start).toBe(expectedStart);
      expect(end).toBeLessThanOrEqual(expectedEnd);
    };

    if (isPaginationVisible) {
      const tableRowsLocator = page.locator(
        '//tbody[@class="clusters-table-body"]/tr[@role="row"]'
      );

      await validateRowCount(tableRowsLocator, 50);
      const currentRowsPerPage = await paginationLocator
        .locator('input')
        .getAttribute('value');
      expect(currentRowsPerPage).toBe('50');

      const leftArrow = page
        .locator('//div[contains(@class,"page-move-button")]')
        .first();
      const rightArrow = page
        .locator('//div[contains(@class,"page-move-button")]')
        .nth(1);
      const pageRange = page.locator('//div[@class="page-display-part"]');

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
});
