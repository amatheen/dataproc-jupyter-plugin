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

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../handler/handler', () => ({
  requestAPI: jest.fn().mockResolvedValue({
    dataproc_url: 'https://dataproc.googleapis.com/',
    compute_url: 'https://compute.googleapis.com/compute',
    metastore_url: 'https://metastore.googleapis.com/',
    cloudkms_url: 'https://cloudkms.googleapis.com/',
    cloudresourcemanager_url: 'https://cloudresourcemanager.googleapis.com/',
    datacatalog_url: 'https://datacatalog.googleapis.com/',
    storage_url: 'https://storage.googleapis.com/'
  })
}));

jest.mock('../utils/utils', () => ({
  checkConfig: jest.fn()
}));

jest.mock('./listNotebookTemplates', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="mock-list-notebook-templates">
      Mock ListNotebookTemplates
    </div>
  )
}));

jest.mock('../utils/loginErrorComponent', () => ({
  __esModule: true,
  default: ({ loginError, configError }: any) => (
    <div data-testid="mock-login-error">
      LoginError: {String(loginError)}, ConfigError: {String(configError)}
    </div>
  )
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NotebookTemplates } from './notebookTemplates';
import { checkConfig } from '../utils/utils';

describe('NotebookTemplates Widget and NotebookTemplatesComponent', () => {
  let container: HTMLDivElement;
  let root: Root;
  const mockApp: any = {};
  const mockFactory: any = {};
  const mockSettingRegistry: any = {};
  const mockThemeManager: any = {
    theme: 'JupyterLab Light',
    isLight: jest.fn().mockReturnValue(true),
    themeChanged: {
      connect: jest.fn(),
      disconnect: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderWidget = async () => {
    const widget = new NotebookTemplates(
      mockApp,
      mockThemeManager,
      mockFactory,
      mockSettingRegistry
    );
    await act(async () => {
      root.render(widget.renderInternal());
    });
    return widget;
  };

  it('shows Loading Templates spinner when not logged in and no errors are present', async () => {
    (checkConfig as jest.Mock).mockImplementation(
      () => new Promise(() => undefined)
    );

    await renderWidget();

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading Templates');
  });

  it('renders LoginErrorComponent when checkConfig sets loginError', async () => {
    (checkConfig as jest.Mock).mockImplementation(
      async (setLoggedIn, setConfigError, setLoginError) => {
        await Promise.resolve();
        setLoginError(true);
        setConfigError(false);
      }
    );

    await renderWidget();

    const errorEl = container.querySelector('[data-testid="mock-login-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('LoginError: true');
    expect(
      container.querySelector('[data-testid="mock-list-notebook-templates"]')
    ).toBeNull();
  });

  it('renders LoginErrorComponent when checkConfig sets configError', async () => {
    (checkConfig as jest.Mock).mockImplementation(
      async (setLoggedIn, setConfigError, setLoginError) => {
        await Promise.resolve();
        setLoginError(false);
        setConfigError(true);
      }
    );

    await renderWidget();

    const errorEl = container.querySelector('[data-testid="mock-login-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('ConfigError: true');
    expect(
      container.querySelector('[data-testid="mock-list-notebook-templates"]')
    ).toBeNull();
  });

  it('renders ListNotebookTemplates when authenticated without errors', async () => {
    (checkConfig as jest.Mock).mockImplementation(async setLoggedIn => {
      await Promise.resolve();
      setLoggedIn(true);
    });

    await renderWidget();

    expect(
      container.querySelector('[data-testid="mock-list-notebook-templates"]')
    ).not.toBeNull();
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="mock-login-error"]')
    ).toBeNull();
  });
});
