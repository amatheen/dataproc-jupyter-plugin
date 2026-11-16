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

import { expect, test, galata } from '@jupyterlab/galata';
import { Page } from '@playwright/test';

test.describe('Serverless notebook from launcher screen', () => {
  test.skip('Sanity: Can perform field validation', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Click on Severless New Runtime Template
    await page
      .locator('.jp-LauncherCard:visible', {
        hasText: 'New Runtime Template'
      })
      .click();
    await page.getByText('Loading Runtime').waitFor({ state: 'detached' });
    await page.getByLabel('Display name*').click();
    await page.getByLabel('Display name*').fill('testing123');
    await page.getByLabel('Display name*').clear();
    await expect(page.getByText('Name is required')).toBeVisible();

    // Fill Display name and check if error is hidden
    await page.getByLabel('Display name*').fill('testing123');
    await expect(page.getByText('Name is required')).toBeHidden();

    await page.getByLabel('Runtime ID*').clear();
    await expect(page.getByText('ID is required')).toBeVisible();

    // Fill Runtime ID and check if error is hidden
    await page.getByLabel('Runtime ID*').fill('runtime123');
    await expect(page.getByText('ID is required')).toBeHidden();

    await page.getByLabel('Description*').fill('test description');
    await page.getByLabel('Description*').clear();
    await expect(page.getByText('Description is required')).toBeVisible();

    // Fill Description and check if error is hidden
    await page.getByLabel('Description*').fill('test description');
    await expect(page.getByText('Description is required')).toBeHidden();

    // Check Execution Configuration section fields
    await expect(page.getByText('Execution Configuration')).toBeVisible();
    await expect(page.getByText('Execute notebooks with:')).toBeVisible();
    await expect(
      page.locator('//div[@class="create-runtime-radio"]//input').first()
    ).toBeChecked();
    await expect(
      page.locator(
        '//div[@class="create-runtime-radio"]//input/parent::*/preceding-sibling::div[text()="Service Account"]'
      )
    ).toBeVisible();
    await expect(page.getByLabel('Service account')).toBeVisible();
    await expect(
      page.locator('//div[@class="create-runtime-radio"]//input').nth(1)
    ).not.toBeChecked();
    await expect(
      page.locator(
        '//div[@class="create-runtime-radio"]//input/ancestor::div[2]//div[2][text()="User Account"]'
      )
    ).toBeVisible();
    await page
      .locator('//div[@class="create-runtime-radio"]//input')
      .nth(1)
      .click();
    await expect(
      page.getByLabel('Service account for system operations')
    ).toBeVisible();
    await page
      .locator('//div[@class="create-runtime-radio"]//input')
      .first()
      .click();
    const runtimeVerSelectedOption = await page
      .getByLabel('Runtime version*')
      .inputValue();
    expect(runtimeVerSelectedOption).toEqual(
      '2.3 LTS (Spark 3.5, Java 17, Scala 2.13)'
    );
    await expect(page.getByLabel('Custom container image')).toBeVisible();
    await expect(page.getByLabel('Staging Bucket')).toBeVisible();
    await expect(page.getByLabel('Python packages repository')).toBeVisible();

    // Check Lightning Engine checkbox
    await expect(page.locator('//input[@name="lightningEngine" and @type="checkbox"]')).not.toBeChecked();
    await expect(page.locator('//div[@class="lightning-engine-label" and text()="Enable Lightning Engine "]')).toBeVisible();
    await expect(page.locator('//div[@class="lightning-engine-label"]/div[text()="Learn more"]')).toBeVisible();

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
    await page.getByLabel('Network tags').click(); // Clicking to move to Network Configuration section
    await page.getByTestId("loader").first().waitFor({ state: 'detached' });
    await expect(
      page.locator(
        '//label[text()="Primary network*"]/following-sibling::div//input[@value="default"]'
      )
    ).toBeVisible();
    await page.getByTestId("loader").first().waitFor({ state: 'detached' });
    await expect(
      page.locator(
        '//label[text()="Subnetwork*"]/following-sibling::div//input[@value="default"]'
      )
    ).toBeVisible();

    await expect(
      page.locator(
        '//*[contains(text(),"Network tags are text attributes you can add to make firewall rules")]'
      )
    ).toBeVisible();

    // Check Metastore section
    await expect(page.locator('label').filter({ hasText: 'Metastore' })).toBeVisible();
    const metastoreSelectedOption = await page
      .getByLabel('Metastore')
      .inputValue();
    expect(metastoreSelectedOption).toEqual('No Metastore');
    await page.getByLabel('Open', { exact: true }).nth(3).click();
    await page.getByRole('option', { name: 'Biglake Metastore' }).click();
    await expect(page.locator('label').filter({ hasText: 'Data warehousing directory*' })).toBeVisible();
    await expect(page.getByText('Input does not match pattern : gs://bucket-name')).toBeVisible();
    await page.getByPlaceholder('e.g, gs://<bucket-name>').click();
    await page.getByPlaceholder('e.g, gs://<bucket-name>').fill('gs://test');
    await expect(page.getByText('Input does not match pattern : gs://bucket-name')).not.toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Catalog Name*' })).toBeVisible();
    const catalogName = await page.locator('//input[@placeholder="Catalog Name"]').inputValue();
    expect(catalogName).toEqual('biglake');

    // Check Metastore Spark Properties
    await page.locator(`//*[text()='Metastore']/../following-sibling::div[@class='expand-icon']`).click();
    expect(page.getByTitle('spark.sql.catalog.biglake', {exact: true}).getByLabel('Key 1*')).toBeVisible();
    expect(page.getByTitle('spark.sql.catalog.biglake.type', {exact: true}).getByLabel('Key 2*')).toBeVisible();
    expect(page.getByTitle('spark.sql.catalog.biglake.warehouse', {exact: true}).getByLabel('Key 3*')).toBeVisible();
    expect(page.locator('//div[@class="spark-property-parent"]//label[text()="Value 1"]/following-sibling::div/input[@value="org.apache.iceberg.spark.SparkCatalog"]')).toBeVisible();
    expect(page.locator('//div[@class="spark-property-parent"]//label[text()="Value 2"]/following-sibling::div/input[@value="hadoop"]')).toBeVisible();
    expect(page.locator('//div[@class="spark-property-parent"]//label[text()="Value 3"]/following-sibling::div/input[@value="gs://test"]')).toBeVisible();

    await page.getByLabel('Open', { exact: true }).nth(3).click();
    await page.getByRole('option', { name: 'Dataproc Metastore' }).click();
    await expect(page.getByRole('combobox', { name: 'Project ID' })).toBeVisible();
    await expect(page.getByLabel('Metastore service')).toBeVisible();

    // Verify Lightning Engine property under Resource Allocation section is visible after enabling Lightning Engine
    await page
      .locator(
        `//*[text()='Resource Allocation']/../following-sibling::div[@class='expand-icon']`
      )
      .click();
    await page.mouse.wheel(0, 300); // Scroll down to reveal properties

    // Verify Lightning Engine property is not visible before enabling Lightning Engine
    await expect(page.locator(`//*[@value="spark.dataproc.engine"]`)).toBeHidden();
  
    // Check the property value after enabling Lightning Engine
    await page.locator('//input[@name="lightningEngine" and @type="checkbox"]').click();
    await page.mouse.wheel(0, 300); // Scroll down to reveal properties
    await expect(page.locator(`//*[@value="spark.dataproc.engine"]`)).toBeVisible();
    await expect(
      page.locator(
        '//label[text()="Value 12"]/following-sibling::div/input[@value="lightningEngine"]'
      )
    ).toBeVisible();

    // Check Others section is present
    await expect(page.getByText('Others', { exact: true })).toBeVisible();

    // Add property validation: Empty key should show an error
    await page.getByRole('button', { name: 'ADD PROPERTY' }).click();
    await expect(page.getByText('key is required')).toBeVisible();

    // Check if the ADD PROPERTY button is disabled
    let isDisabled = await page
      .getByRole('button', { name: 'ADD PROPERTY' })
      .getAttribute('class');
    expect(isDisabled).toContain('disabled');

    // Fill the key field and ensure the error is hidden
    await page.getByRole('textbox', { name: 'Key 1*' }).nth(1).fill('key');
    await expect(page.getByText('key is required')).toBeHidden();

    // Click on the value field and ensure the ADD PROPERTY button is enabled
    await page.getByLabel('Value 1').first().click();
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
    await page.getByRole('textbox', { name: 'Key 2*' }).nth(1).fill('key');
    await expect(page.getByText('key is required')).toBeHidden();
    await page.getByLabel('Value 2').first().click();

    // Delete added label
    await page.locator('.labels-delete-icon').click();
  });

  for (let i = 1; i <= 10; i++) {
  test(`Sanity: Can create serverless notebook #${i}`, async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Click on Severless New Runtime Template
    await page
      .locator('.jp-LauncherCard:visible', {
        hasText: 'New Runtime Template'
      })
      .click();
    await page.getByText('Loading Runtime').waitFor({ state: 'detached' });

    // Generate formatted current date string
    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    const dateTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(
      Math.floor(now.getMinutes() / 5) * 5
    )}:${pad(now.getSeconds())}`;

    // Create template name
    const templateName = 'auto-test-' + dateTimeStr;

    // Fill the template details
    await page.getByLabel('Display name*').click();
    await page.getByLabel('Display name*').fill(templateName);
    await page.getByLabel('Description*').click();
    await page.getByLabel('Description*').fill('Testing');
    await page.getByTestId("loader").first().waitFor({ state: 'detached' });

    // Select the project
    await page.getByLabel('Open', { exact: true }).nth(3).click();
    await page.getByRole('option', { name: 'Dataproc Metastore' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).click();
    // await page.getByRole('combobox', { name: 'Project ID' }).fill('kokoro');
    // await page.getByRole('option', { name: 'dataproc-kokoro-tests' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).fill('dataproc');
    await page
      .getByRole('option', { name: 'dataproc-jupyter-extension-dev' })
      .click();
    await page.getByTestId("loader").first().waitFor({ state: 'detached' });

    // Select Metastore service
    await page.getByLabel('Metastore service').click();
    await expect(page.getByRole('option').first()).toBeVisible({timeout: 10000});
    await page.getByRole('option').first().click();

    const isNotificationPresent = await page.getByRole('button', { name: 'Ignore' }).isVisible();
        if (isNotificationPresent)
            await page.getByRole('button', { name: 'Ignore' }).click();

    // Click on save button to create a notebook
    await expect(page.getByText('SAVE', { exact: true })).toBeEnabled({timeout: 5000});
    await page.getByText('SAVE', { exact: true }).click();

    // Check the notebook created confirmation message
    await expect(
      page.getByText(
        'Runtime Template ' + templateName + ' successfully created'
      )
    ).toBeVisible({ timeout: 20000 });

    // Check the created notebook on launcher screen
    await expect(
      page.locator('.jp-LauncherCard:visible', {
        hasText: templateName + ' on Serverless Spark (Remote)'
      })
    ).toBeVisible({ timeout: 20000 });
  });
}

  // Navigate to config setup page and click on create template button
  async function navigateToRuntimeTemplate(page: Page) {
    await page
      .getByLabel('main menu', { exact: true })
      .getByText('Settings')
      .click();
    const dataprocSettings = page.getByText('Google Cloud Settings');
    const bigQuerySettings = page.getByText('Google Cloud Settings');
    await dataprocSettings.or(bigQuerySettings).click();
    await page.getByText('Create', { exact: true }).click();
    await page.getByText('Loading Runtime').waitFor({ state: 'hidden' });
  }

  // Check if spark properties are visible
  async function checkSparkProperties(page: Page) {
    const properties = [
      'spark.driver.cores',
      'spark.driver.memory',
      'spark.driver.memoryOverhead',
      'spark.dataproc.driver.disk.size',
      'spark.dataproc.driver.disk.tier',
      'spark.executor.cores',
      'spark.executor.memory',
      'spark.executor.memoryOverhead',
      'spark.dataproc.executor.disk.size',
      'spark.dataproc.executor.disk.tier',
      'spark.executor.instances'
    ];
    for (const prop of properties) {
      await expect(page.locator(`//*[@value="${prop}"]`)).toBeVisible();
    }
  }

  // Check if default values for properties match expected values
  async function checkPropertiesValue(page: Page, values: any) {
    for (const [id, value] of Object.entries(values)) {
      // const actualValue = await page
      //   .locator(`//*[@id="value-${id}"]//input`)
      //   .getAttribute('value');
      const actualValue = await page
        .locator(`//div[@class="spark-property-parent"]//label[text()="${id}"]/following-sibling::div/input`).getAttribute('placeholder');

        await console.log(`Checking property ${id}: expected value = ${value}, actual value = ${actualValue}`);
      expect(actualValue).toBe(value);
    }
  }

  test('Can check all spark properties are displayed', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await navigateToRuntimeTemplate(page);

    // Verify sections and subsections presence
    const sections = [
      'Spark Properties',
      'Resource Allocation',
      'Autoscaling',
      'GPU'
    ];
    for (const section of sections) {
      await expect(page.getByText(section, { exact: true })).toBeVisible();
    }

    // Expand and check properties in Resource Allocation subsection
    //await page.locator('//*[@id="resource-allocation-expand-icon"]').click(); // ids PR yet to merge
    await page
      .locator(
        `//*[text()='Resource Allocation']/../following-sibling::div[@class='expand-icon']`
      )
      .click();
    await page.mouse.wheel(0, 300); // Scroll down to reveal properties
    await checkSparkProperties(page);

    // Verify default values in Resource Allocation subsection
    const allocationValues = {
      // 'spark.driver.cores': '4',
      // 'spark.driver.memory': '12200m',
      // 'spark.driver.memoryOverhead': '1220m',
      // 'spark.dataproc.driver.disk.size': '400g',
      // 'spark.dataproc.driver.disk.tier': 'standard',
      // 'spark.executor.cores': '4',
      // 'spark.executor.memory': '12200m',
      // 'spark.executor.memoryOverhead': '1220m',
      // 'spark.dataproc.executor.disk.size': '400g',
      // 'spark.dataproc.executor.disk.tier': 'standard',
      // 'spark.executor.instances': '2'
      'Value 1': '4',
      'Value 2': '12200m',
      'Value 3': '1220m',
      'Value 4': '400g',
      'Value 5': 'standard',
      'Value 6': '4',
      'Value 7': '12200m',
      'Value 8': '1220m',
      'Value 9': '400g',
      'Value 10': 'standard',
      'Value 11': '2'
    };
    await checkPropertiesValue(page, allocationValues);

    await page
      .locator(
        `//*[text()='Resource Allocation']/../following-sibling::div[@class='expand-icon']`
      )
      .click();

    // Expand and check properties in Resource Autoscaling subsection
    //await page.locator('//*[@id="autoscaling-expand-icon"]').click(); // Ids PR yet to merge
    await page
      .locator(
        `//*[text()='Autoscaling']/../following-sibling::div[@class='expand-icon']`
      )
      .click();
    await page.mouse.wheel(0, 300); // Scroll down to reveal properties
    const autoscalingProps = [
      'spark.dynamicAllocation.enabled',
      'spark.dynamicAllocation.initialExecutors',
      'spark.dynamicAllocation.minExecutors',
      'spark.dynamicAllocation.maxExecutors',
      'spark.dynamicAllocation.executorAllocationRatio',
      'spark.reducer.fetchMigratedShuffle.enabled'
    ];
    for (const prop of autoscalingProps) {
      await expect(page.locator(`//*[@value="${prop}"]`)).toBeVisible();
    }

    // Verify default values in Resource Autoscaling subsection
    const autoscalingValues = {
      // 'spark.dynamicAllocation.enabled': 'true',
      // 'spark.dynamicAllocation.initialExecutors': '2',
      // 'spark.dynamicAllocation.minExecutors': '2',
      // 'spark.dynamicAllocation.maxExecutors': '1000',
      // 'spark.dynamicAllocation.executorAllocationRatio': '0.3',
      // 'spark.reducer.fetchMigratedShuffle.enabled': 'false'

      'Value 1': 'true',
      'Value 2': '2',
      'Value 3': '2',
      'Value 4': '1000',
      'Value 5': '0.3',
      'Value 6': 'false'
    };
    await checkPropertiesValue(page, autoscalingValues);

    await page
      .locator(
        `//*[text()='Autoscaling']/../following-sibling::div[@class='expand-icon']`
      )
      .click();

    // Verify GPU subsection is unchecked by default
    const isChecked = await page.getByLabel('GPU').isChecked();
    expect(isChecked).toBe(false);

    // Check GPU checkbox and validate properties are visible
    await page.getByLabel('GPU').check();
    const gpuProps = [
      'spark.dataproc.driverEnv.LANG',
      'spark.executorEnv.LANG',
      'spark.dataproc.executor.compute.tier',
      'spark.dataproc.executor.resource.accelerator.type',
      'spark.plugins',
   //   'spark.task.resource.gpu.amount',
      'spark.shuffle.manager'
    ];
    for (const prop of gpuProps) {
      await expect(page.locator(`//*[@value="${prop}"]`)).toBeVisible();
    }

    // Verify default values in GPU subsection
    const gpuValues = {
      // 'spark.dataproc.driverEnv.LANG': 'C.UTF-8',
      // 'spark.executorEnv.LANG': 'C.UTF-8',
      // 'spark.dataproc.executor.compute.tier': 'premium',
      // 'spark.dataproc.executor.resource.accelerator.type': 'l4',
      // 'spark.plugins': 'com.nvidia.spark.SQLPlugin',
      // 'spark.task.resource.gpu.amount': '0.25',
      // 'spark.shuffle.manager': 'com.nvidia.spark.rapids.RapidsShuffleManager'

      'Value 1': 'C.UTF-8',
      'Value 2': 'C.UTF-8',
      'Value 3': 'premium',
      'Value 4': 'l4',
      'Value 5': 'com.nvidia.spark.SQLPlugin',
   //   'Value 6': '0.25',
      'Value 7': 'com.nvidia.spark.rapids.RapidsShuffleManager'
    };
    await checkPropertiesValue(page, gpuValues);
  });

  test.skip('Can check allocation subsection properties changes when GPU is selected and unselected', async ({
    page
  }) => {
    test.setTimeout(5 * 60 * 1000);

    await navigateToRuntimeTemplate(page);

    // Expand Resource Allocation subsection
    //await page.locator('//*[@id="resource-allocation-expand-icon"]').click();// ids PR yet to merge
    await page
      .locator(
        `//*[text()='Resource Allocation']/../following-sibling::div[@class='expand-icon']`
      )
      .click();

    // Check GPU checkbox and validate the properties
    await page.getByLabel('GPU').check();

    let sDEDiskTierValue = {
      'spark.dataproc.executor.disk.tier': 'premium'
    };
    await checkPropertiesValue(page, sDEDiskTierValue);

    const hiddenProps = [
      'spark.executor.memoryOverhead',
      'spark.dataproc.executor.disk.size'
    ];
    for (const prop of hiddenProps) {
      await expect(page.locator(`//*[@value="${prop}"]`)).toBeHidden();
    }

    // Uncheck GPU checkbox and validate the properties
    await page.getByLabel('GPU').uncheck();

    sDEDiskTierValue = {
      'spark.dataproc.executor.disk.tier': 'standard'
    };
    await checkPropertiesValue(page, sDEDiskTierValue);

    const visibleProps = [
      'spark.executor.memoryOverhead',
      'spark.dataproc.executor.disk.size'
    ];
    for (const prop of visibleProps) {
      await expect(page.locator(`//*[@value="${prop}"]`)).toBeVisible();
    }
  });

  test.skip('Can verify by changing to non-L4 value', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    await navigateToRuntimeTemplate(page);

    // Expand Resource Allocation subsection
    await page
      .locator('//*[@class="spark-properties-sub-header-parent"][1]/div[2]')
      .click();

    // Change GPU type to non-L4 value and validate properties are visible
    await page.getByLabel('GPU').check();
    const sparkDPERATypeValue = page.locator(
      '//*[@id="value-spark.dataproc.executor.resource.accelerator.type"]//input'
    );
    await sparkDPERATypeValue.fill('a100-40');

    // Check Allocation subsection property is visible
    await expect(
      page.locator('//*[@value="spark.dataproc.executor.disk.size"]')
    ).toBeVisible();
  });
});
