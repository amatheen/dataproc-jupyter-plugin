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

test.describe('Create serverless notebook from config screen', () => {
  // Generate formatted current date string
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  let dateTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}:${pad(
    now.getSeconds()
  )}`;

  // Create template name
  let templateName = 'auto-test-' + dateTimeStr;

  test('Can create serverless notebook with Dataproc Metastore', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Goto menu and click on Google setting
    await page
      .getByLabel('main menu', { exact: true })
      .getByText('Settings')
      .click();
    const cloudSettings = page.getByText('Google Cloud Settings');
    await cloudSettings.click();

    await page.getByText('Loading Config Setup').waitFor({ state: 'detached' });

    // Click on Create button
    await page.getByText('Create', { exact: true }).click();
    await page.getByText('Loading Runtime').waitFor({ state: 'detached' });

    // Enter all the details to create Severless runtime template
    await page.getByLabel('Display name*').click();
    await page.getByLabel('Display name*').fill(templateName);
    await page.getByLabel('Description*').click();
    await page.getByLabel('Description*').fill('Testing');
    await page.getByTestId("loader").first().waitFor({ state: 'detached' });
    await page.waitForTimeout(3000);

    // Select the project
    await page.getByLabel('Open', { exact: true }).nth(3).click();
    await page.getByRole('option', { name: 'Dataproc Metastore' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).click();
    // await page.getByRole('combobox', { name: 'Project ID' }).fill('kokoro');
    // await page.getByRole('option', { name: 'dataproc-kokoro-tests' }).click();
    await page.getByRole('combobox', { name: 'Project ID' }).fill('dataproc');
    await page.getByRole('option', { name: 'dataproc-jupyter-extension-dev' }).click();
    await page.waitForTimeout(5000);

    // Select Metastore service
    await page.getByLabel('Metastore service').click();
    const firstOption = await page.getByRole('option').first();
    await firstOption.click();
    await expect(page.getByText('SAVE', { exact: true })).toBeEnabled({ timeout: 10000 });

    // Click on save button to create a notebook
    await page.getByText('SAVE', { exact: true }).click();

    // Check the notebook created confirmation message
    await expect(
      page.getByText(
        'Runtime Template ' + templateName + ' successfully created'
      )
    ).toBeVisible({ timeout: 30000 });
  });

  test('Check and edit created serverless notebook with Dataproc Metastore', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Goto menu and click on Google setting
    await page
      .getByLabel('main menu', { exact: true })
      .getByText('Settings')
      .click();
    const cloudSettings = page.getByText('Google Cloud Settings');
    await cloudSettings.click();

    // Wait till the page loaded
    await page.getByText('Loading Config Setup').waitFor({ state: 'detached' });
    await page
      .getByText('Loading Runtime Templates')
      .waitFor({ state: 'detached' });

    await page.getByPlaceholder('Filter Table').first().fill(templateName);

    await page.getByRole('cell', { name: templateName }).click();
    await page.getByText('Loading Runtime').waitFor({ state: 'detached' });
    await page.waitForTimeout(3000);

    expect(await page.getByLabel('Display name*').inputValue()).toEqual(templateName);
    expect(await page.getByLabel('Description*').inputValue()).toEqual('Testing')

    expect(await page
      .getByLabel('Runtime version*')
      .inputValue()).toEqual(
        '2.3 LTS (Spark 3.5, Java 17, Scala 2.13)'
      );

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

    // Verify Metastore section data
    //expect(await page.getByLabel('Metastore').inputValue()).toEqual('Dataproc Metastore');
    expect(await page.getByRole('combobox', { name: 'Metastore', exact: true }).inputValue()).toEqual('Dataproc Metastore');
    //expect(await page.getByRole('combobox', { name: 'Project ID' }).inputValue()).toEqual('dataproc-kokoro-tests');
    expect(await page.getByRole('combobox', { name: 'Project ID' }).inputValue()).toEqual('dataproc-jupyter-extension-dev');
    //expect(page.getByLabel('Metastore service')).not.toBeEmpty();

    await page.getByLabel('Description*').clear();
    await page
      .getByLabel('Description*')
      .fill('testing for edit runtime template');
    await expect(page.getByText('SAVE', { exact: true })).toBeEnabled({ timeout: 10000 });

    // Click on save button to update a notebook
    await page.getByText('SAVE', { exact: true }).click();

    // Check the notebook updated confirmation message
    await expect(
      page.getByText(
        'Runtime Template ' + templateName + ' successfully updated'
      )
    ).toBeVisible({ timeout: 30000 });
  });

  test('Can create serverless notebook with Biglake Metastore', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    dateTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}:${pad(
      now.getSeconds()
    )}`;

    templateName = 'auto-test-' + dateTimeStr;
    // Goto menu and click on Google setting
    await page
      .getByLabel('main menu', { exact: true })
      .getByText('Settings')
      .click();
    const cloudSettings = page.getByText('Google Cloud Settings');
    await cloudSettings.click();

    await page.getByText('Loading Config Setup').waitFor({ state: 'detached' });

    // Click on Create button
    await page.getByText('Create', { exact: true }).click();
    await page.getByText('Loading Runtime').waitFor({ state: 'detached' });

    // Enter all the details to create Severless runtime template
    await page.getByLabel('Display name*').click();
    await page.getByLabel('Display name*').fill(templateName);
    await page.getByLabel('Description*').click();
    await page.getByLabel('Description*').fill('Testing biglake option');
    await page.getByTestId("loader").first().waitFor({ state: 'detached' });
    await page.waitForTimeout(3000);

    // Select the project
    await page.getByLabel('Open', { exact: true }).nth(3).click();
    await page.getByRole('option', { name: 'Biglake Metastore' }).click();
    await page.getByLabel('Data warehousing directory*').fill("gs://test");
    await expect(page.getByText('SAVE', { exact: true })).toBeEnabled({ timeout: 5000 });
    await page.locator(`//*[text()='Metastore']/../following-sibling::div[@class='expand-icon']`).click();

    const isNotificationPresent = await page.getByRole('button', { name: 'Ignore' }).isVisible();
        if (isNotificationPresent)
            await page.getByRole('button', { name: 'Ignore' }).click();

    // Click on save button to create a notebook
    await page.getByText('SAVE', { exact: true }).click();

    // Check the notebook created confirmation message
    await expect(
      page.getByText(
        'Runtime Template ' + templateName + ' successfully created'
      )
    ).toBeVisible({ timeout: 600000 });
  });

  test('Check and edit created serverless notebook with Biglake Metastore', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    // Goto menu and click on Google setting
    await page
      .getByLabel('main menu', { exact: true })
      .getByText('Settings')
      .click();
    const cloudSettings = page.getByText('Google Cloud Settings');
    await cloudSettings.click();

    // Wait till the page loaded
    await page.getByText('Loading Config Setup').waitFor({ state: 'detached' });
    await page
      .getByText('Loading Runtime Templates')
      .waitFor({ state: 'detached' });

    await page.getByPlaceholder('Filter Table').first().fill(templateName);

    await page.getByRole('cell', { name: templateName }).first().click();
    await page.getByText('Loading Runtime').waitFor({ state: 'detached' });
    await page.waitForTimeout(3000);

    // Verify Metastore section data
    expect(await page.getByLabel('Metastore').inputValue()).toEqual('Biglake Metastore');
    expect(await page.getByLabel('Data warehousing directory*').inputValue()).toEqual('gs://test');
    expect(await page.locator('//input[@placeholder="Catalog Name"]').inputValue()).toEqual('biglake');

    await page.getByLabel('Description*').clear();
    await page
      .getByLabel('Description*')
      .fill('Testing for edit runtime template');
    await page.getByRole('progressbar').waitFor({ state: 'detached' });
    await expect(page.getByText('SAVE', { exact: true })).toBeEnabled({ timeout: 5000 });

    const isNotificationPresent = await page.getByRole('button', { name: 'Ignore' }).isVisible();
        if (isNotificationPresent)
            await page.getByRole('button', { name: 'Ignore' }).click();

    // Click on save button to update a notebook
    await page.getByText('SAVE', { exact: true }).click();

    // Check the notebook updated confirmation message
    await expect(
      page.getByText(
        'Runtime Template ' + templateName + ' successfully updated'
      )
    ).toBeVisible({ timeout: 30000 });
  });
});
