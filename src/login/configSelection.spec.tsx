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

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { JupyterLab } from '@jupyterlab/application';
import { IThemeManager, Notification } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { DynamicDropdown } from '../controls/DynamicDropdown';
import { requestAPI } from '../handler/handler';
import CreateRuntime from '../runtime/createRunTime';
import {
  API_HEADER_BEARER,
  API_HEADER_CONTENT_TYPE,
  PLUGIN_ID,
  USER_INFO_URL,
  VERSION_DETAIL
} from '../utils/const';
import { ISessionTemplate } from '../utils/listRuntimeTemplateInterface';
import { DataprocLoggingService, LOG_LEVEL } from '../utils/loggingService';
import { projectListAPI } from '../utils/projectService';
import { eventEmitter } from '../utils/signalEmitter';
import { authApi, IAuthCredentials, loggedFetch } from '../utils/utils';
import ConfigSelection from './configSelection';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../../third-party-licenses.txt', () => 'Mock Third Party Licenses');

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
  ...jest.requireActual('../utils/utils'),
  authApi: jest.fn(),
  loggedFetch: jest.fn()
}));

jest.mock('@jupyterlab/apputils', () => ({
  ...jest.requireActual('@jupyterlab/apputils'),
  Notification: {
    emit: jest.fn()
  }
}));

// Partially mock LabIcon because ConfigSelection instantiates new LabIcon(...)
// inside its render body, which triggers LabIcon's global signal setState
// warning during React re-renders.
jest.mock('@jupyterlab/ui-components', () => ({
  ...jest.requireActual('@jupyterlab/ui-components'),
  LabIcon: class MockLabIcon {
    name: string;
    react: React.FC<{ className?: string }>;
    constructor({ name }: { name: string; svgstr: string }) {
      this.name = name;
      this.react = ({ className }: { className?: string }) => (
        <span data-icon={name} className={className} />
      );
    }
  }
}));

jest.mock('../utils/loggingService', () => ({
  ...jest.requireActual('../utils/loggingService'),
  DataprocLoggingService: {
    log: jest.fn()
  }
}));

jest.mock('../controls/DynamicDropdown', () => ({
  DynamicDropdown: jest.fn(({ value, onChange, label, disabled }: any) => (
    <div>
      <input
        data-testid="project-dropdown"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e, e.target.value)}
      />
      <button
        data-testid="clear-project-dropdown"
        onClick={e => onChange(e, null)}
      >
        Clear Project
      </button>
    </div>
  ))
}));

jest.mock('../controls/RegionDropdown', () => ({
  RegionDropdown: jest.fn(({ region, onRegionChange }: any) => (
    <input
      data-testid="region-dropdown"
      value={region}
      onChange={e => onRegionChange(e.target.value)}
    />
  ))
}));

jest.mock('../controls/BigQueryRegionDropdown', () => ({
  BigQueryRegionDropdown: jest.fn(({ region, onRegionChange }: any) => (
    <input
      data-testid="bq-region-dropdown"
      value={region}
      onChange={e => onRegionChange(e.target.value)}
    />
  ))
}));

const mockRuntimeCloneTemplate = {
  name: 'projects/my-gcp-project/locations/us-central1/sessionTemplates/tpl-1',
  description: 'Sample runtime template'
} as unknown as ISessionTemplate;

jest.mock('../runtime/listRuntimeTemplates', () => ({
  __esModule: true,
  default: jest.fn(
    ({ setOpenCreateTemplate, setSelectedRuntimeClone }: any) => (
      <div data-testid="mock-list-runtime-templates">
        Mock ListRuntimeTemplates
        <button
          data-testid="open-create-template-btn"
          onClick={() => {
            setSelectedRuntimeClone(mockRuntimeCloneTemplate);
            setOpenCreateTemplate(true);
          }}
        >
          Create Runtime Template
        </button>
      </div>
    )
  )
}));

jest.mock('../runtime/createRunTime', () => ({
  __esModule: true,
  default: jest.fn(({ setOpenCreateTemplate }: any) => (
    <div data-testid="mock-create-runtime">
      Mock CreateRuntime
      <button
        data-testid="close-create-template-btn"
        onClick={() => setOpenCreateTemplate(false)}
      >
        Back
      </button>
    </div>
  ))
}));

const flushPromises = () =>
  new Promise<void>(resolve => setTimeout(resolve, 0));

const defaultCredentials: IAuthCredentials = {
  access_token: 'mock-access-token',
  project_id: 'my-gcp-project',
  region_id: 'us-central1',
  config_error: 0,
  login_error: 0
};

describe('ConfigSelection Component', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let originalLocation: Location;
  let mockReload: jest.Mock;
  let mockSetConfigError: jest.Mock;
  let mockSettingsGet: jest.Mock;
  let mockSettingsSet: jest.Mock;
  let mockSettingRegistry: ISettingRegistry;
  let mockApp: JupyterLab;
  let mockLauncher: ILauncher;
  let mockThemeManager: IThemeManager;

  const setInputValue = (input: HTMLInputElement, value: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const getSaveButton = (): HTMLButtonElement => {
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent === 'Save' || btn.textContent === 'Saving'
    );
    expect(saveBtn).toBeDefined();
    return saveBtn as HTMLButtonElement;
  };

  const renderComponent = async (
    props: Partial<React.ComponentProps<typeof ConfigSelection>> = {}
  ) => {
    const mergedProps: React.ComponentProps<typeof ConfigSelection> = {
      configError: false,
      setConfigError: mockSetConfigError,
      app: mockApp,
      launcher: mockLauncher,
      settingRegistry: mockSettingRegistry,
      themeManager: mockThemeManager,
      ...props
    };

    await act(async () => {
      root?.render(<ConfigSelection {...mergedProps} />);
      await flushPromises();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    originalLocation = window.location;
    mockReload = jest.fn();
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      reload: mockReload
    };

    mockSetConfigError = jest.fn();
    mockSettingsGet = jest.fn().mockReturnValue({ composite: 'US' });
    mockSettingsSet = jest.fn().mockResolvedValue(undefined);
    mockSettingRegistry = {
      load: jest.fn().mockResolvedValue({
        get: mockSettingsGet,
        set: mockSettingsSet
      })
    } as unknown as ISettingRegistry;

    mockApp = { id: 'mock-app' } as unknown as JupyterLab;
    mockLauncher = { add: jest.fn() } as unknown as ILauncher;
    mockThemeManager = {
      theme: 'JupyterLab Light',
      isLight: jest.fn().mockReturnValue(true),
      themeChanged: {
        connect: jest.fn(),
        disconnect: jest.fn()
      }
    } as unknown as IThemeManager;

    (authApi as jest.Mock).mockResolvedValue(defaultCredentials);

    (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint === 'settings') {
        return Promise.resolve({
          enable_bigquery_integration: false,
          kernel_gateway_project_number: ''
        });
      }
      if (endpoint === 'configuration') {
        return Promise.resolve({ config: 'Configuration saved' });
      }
      return Promise.resolve({});
    });

    (loggedFetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        email: 'test-user@example.com',
        picture: 'https://example.com/avatar.png'
      })
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    (window as any).location = originalLocation;
    jest.restoreAllMocks();
  });

  describe('loading state', () => {
    it('renders loading spinner while credentials are pending and configError is false', async () => {
      (authApi as jest.Mock).mockReturnValue(new Promise(() => undefined));

      await renderComponent({ configError: false });

      expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
      expect(container.textContent).toContain('Loading Config Setup');
    });

    it('keeps loading state without fetching user info when authApi resolves to undefined', async () => {
      (authApi as jest.Mock).mockResolvedValue(undefined);

      await renderComponent({ configError: false });

      expect(loggedFetch).not.toHaveBeenCalled();
      expect(mockSetConfigError).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    });

    it('renders settings form instead of loading spinner when configError is true', async () => {
      (authApi as jest.Mock).mockReturnValue(new Promise(() => undefined));

      await renderComponent({ configError: true });

      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
      expect(container.textContent).toContain('Google Cloud Project Settings');
    });
  });

  describe('initial data loading and user info', () => {
    it('populates project ID and region inputs from credentials on mount', async () => {
      await renderComponent();

      const projectInput = container.querySelector(
        '[data-testid="project-dropdown"]'
      ) as HTMLInputElement;
      const regionInput = container.querySelector(
        '[data-testid="region-dropdown"]'
      ) as HTMLInputElement;

      expect(projectInput.value).toBe('my-gcp-project');
      expect(regionInput.value).toBe('us-central1');
    });

    it('leaves project ID and region empty when credentials omit them', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        access_token: 'mock-access-token',
        config_error: 0,
        login_error: 0
      });

      await renderComponent();

      const projectInput = container.querySelector(
        '[data-testid="project-dropdown"]'
      ) as HTMLInputElement;
      const regionInput = container.querySelector(
        '[data-testid="region-dropdown"]'
      ) as HTMLInputElement;

      expect(projectInput.value).toBe('');
      expect(regionInput.value).toBe('');
    });

    it('calls setConfigError with false when credentials have no error flags', async () => {
      await renderComponent();

      expect(mockSetConfigError).toHaveBeenCalledWith(false);
    });

    it('calls setConfigError with true when credentials have config_error set', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        ...defaultCredentials,
        config_error: 1
      });

      await renderComponent();

      expect(mockSetConfigError).toHaveBeenCalledWith(true);
    });

    it('calls setConfigError with true when credentials have login_error set', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        ...defaultCredentials,
        login_error: 1
      });

      await renderComponent();

      expect(mockSetConfigError).toHaveBeenCalledWith(true);
    });

    it('requests user info with bearer token authorization header', async () => {
      await renderComponent();

      expect(loggedFetch).toHaveBeenCalledWith(USER_INFO_URL, {
        method: 'GET',
        headers: {
          'Content-Type': API_HEADER_CONTENT_TYPE,
          Authorization: API_HEADER_BEARER + 'mock-access-token'
        }
      });
    });

    it('renders user email and avatar image after user info loads', async () => {
      await renderComponent();

      const emailEl = container.querySelector('.user-email');
      const avatarImg = container.querySelector(
        'img[alt="User Image"]'
      ) as HTMLImageElement;

      expect(emailEl?.textContent).toBe('test-user@example.com');
      expect(avatarImg?.src).toBe('https://example.com/avatar.png');
    });

    it('emits error notification when user info response contains an error and auth has no error flags', async () => {
      (loggedFetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          error: { code: 401, message: 'Invalid Credentials' }
        })
      });

      await renderComponent();

      expect(Notification.emit).toHaveBeenCalledWith(
        'Invalid Credentials',
        'error',
        { autoClose: 5000 }
      );
      expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    });

    it('does not emit error notification for user info API error when credentials have login_error', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        ...defaultCredentials,
        login_error: 1
      });
      (loggedFetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          error: { code: 401, message: 'Invalid Credentials' }
        })
      });

      await renderComponent();

      expect(Notification.emit).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
    });

    it('does not emit error notification for user info API error when credentials have config_error', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        ...defaultCredentials,
        config_error: 1
      });
      (loggedFetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          error: { code: 401, message: 'Invalid Credentials' }
        })
      });

      await renderComponent();

      expect(Notification.emit).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
    });

    it('logs to console.error when parsing user info response JSON fails', async () => {
      const jsonError = new Error('Malformed JSON');
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      (loggedFetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockRejectedValue(jsonError)
      });

      await renderComponent();

      expect(consoleErrorSpy).toHaveBeenCalledWith(jsonError);
    });

    it('logs error, emits notification, and hides loading spinner when loggedFetch rejects', async () => {
      const networkError = new Error('Network failure');
      (loggedFetch as jest.Mock).mockRejectedValue(networkError);

      await renderComponent();

      expect(DataprocLoggingService.log).toHaveBeenCalledWith(
        'Error displaying user info',
        LOG_LEVEL.ERROR
      );
      expect(Notification.emit).toHaveBeenCalledWith(
        `Failed to fetch user information : ${networkError}`,
        'error',
        { autoClose: 5000 }
      );
      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
    });
  });

  describe('settings feature flags and project editability', () => {
    it('keeps project ID dropdown editable and hides info icon when kernel_gateway_project_number is absent', async () => {
      await renderComponent();

      const projectInput = container.querySelector(
        '[data-testid="project-dropdown"]'
      ) as HTMLInputElement;

      expect(projectInput.disabled).toBe(false);
      expect(container.querySelector('.info-icon-container')).toBeNull();
    });

    it('disables project ID dropdown and displays tooltip when kernel_gateway_project_number is present', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            kernel_gateway_project_number: '123456789'
          });
        }
        return Promise.resolve({});
      });

      await renderComponent();

      const projectInput = container.querySelector(
        '[data-testid="project-dropdown"]'
      ) as HTMLInputElement;
      const infoIcon = container.querySelector('.info-icon-container');

      expect(projectInput.disabled).toBe(true);
      expect(infoIcon?.getAttribute('title')).toBe(
        'Project Id is set at Jupyter Lab startup'
      );
    });

    it('hides BigQuery Settings section when BigQuery integration is disabled', async () => {
      await renderComponent();

      expect(container.textContent).not.toContain('BigQuery Settings');
      expect(
        container.querySelector('[data-testid="bq-region-dropdown"]')
      ).toBeNull();
    });

    it('renders BigQuery Settings section with bqRegion from settingRegistry when BigQuery integration is enabled', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            kernel_gateway_project_number: ''
          });
        }
        return Promise.resolve({});
      });

      await renderComponent();

      const bqRegionInput = container.querySelector(
        '[data-testid="bq-region-dropdown"]'
      ) as HTMLInputElement;

      expect(mockSettingRegistry.load).toHaveBeenCalledWith(PLUGIN_ID);
      expect(container.textContent).toContain('BigQuery Settings');
      expect(bqRegionInput).not.toBeNull();
      expect(bqRegionInput.value).toBe('US');
    });
  });

  describe('form interactions and Save button state', () => {
    it('passes projectListAPI as fetchFunc to DynamicDropdown', async () => {
      await renderComponent();

      expect(DynamicDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchFunc: projectListAPI,
          label: 'Project ID*'
        }),
        {}
      );
    });

    it('disables Save button when project ID is empty', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        ...defaultCredentials,
        project_id: ''
      });

      await renderComponent();

      expect(getSaveButton().disabled).toBe(true);
    });

    it('disables Save button when region is empty', async () => {
      (authApi as jest.Mock).mockResolvedValue({
        ...defaultCredentials,
        region_id: ''
      });

      await renderComponent();

      expect(getSaveButton().disabled).toBe(true);
    });

    it('enables Save button when both project ID and region are populated', async () => {
      await renderComponent();

      expect(getSaveButton().disabled).toBe(false);
    });

    it('updates project ID when DynamicDropdown triggers onChange', async () => {
      await renderComponent();

      const projectInput = container.querySelector(
        '[data-testid="project-dropdown"]'
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(projectInput, 'updated-gcp-project');
      });

      expect(projectInput.value).toBe('updated-gcp-project');
    });

    it('clears project ID and disables Save button when DynamicDropdown emits null', async () => {
      await renderComponent();

      const clearBtn = container.querySelector(
        '[data-testid="clear-project-dropdown"]'
      ) as HTMLButtonElement;

      await act(async () => {
        clearBtn.click();
      });

      const projectInput = container.querySelector(
        '[data-testid="project-dropdown"]'
      ) as HTMLInputElement;
      expect(projectInput.value).toBe('');
      expect(getSaveButton().disabled).toBe(true);
    });

    it('updates region when RegionDropdown triggers onRegionChange', async () => {
      await renderComponent();

      const regionInput = container.querySelector(
        '[data-testid="region-dropdown"]'
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(regionInput, 'europe-west1');
      });

      expect(regionInput.value).toBe('europe-west1');
    });
  });

  describe('saving configuration', () => {
    it('displays Saving label and disables button while configuration request is in flight', async () => {
      let resolveSave!: (value: { config: string }) => void;
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            kernel_gateway_project_number: ''
          });
        }
        if (endpoint === 'configuration') {
          return new Promise<{ config: string }>(resolve => {
            resolveSave = resolve;
          });
        }
        return Promise.resolve({});
      });

      await renderComponent();

      const saveBtn = getSaveButton();
      await act(async () => {
        saveBtn.click();
      });

      expect(saveBtn.textContent).toBe('Saving');
      expect(saveBtn.disabled).toBe(true);

      await act(async () => {
        resolveSave({ config: 'Configuration saved' });
        await flushPromises();
      });

      expect(saveBtn.textContent).toBe('Save');
      expect(saveBtn.disabled).toBe(false);
    });

    it('posts projectId and region payload to configuration endpoint on save', async () => {
      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(requestAPI).toHaveBeenCalledWith('configuration', {
        body: JSON.stringify({
          projectId: 'my-gcp-project',
          region: 'us-central1'
        }),
        method: 'POST'
      });
    });

    it('emits success notification after saving configuration', async () => {
      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(Notification.emit).toHaveBeenCalledWith(
        'Configuration saved - You will need to restart Jupyter in order for the new project and region to fully take effect.',
        'success',
        { autoClose: 5000 }
      );
    });

    it('emits dataprocConfigChange event on eventEmitter after saving configuration', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'dataprocConfigChange',
        'Configuration saved - Configuration updated successfully.'
      );
    });

    it('reloads window after saving configuration successfully', async () => {
      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('persists updated bqRegion to settingRegistry on save when BigQuery integration is enabled', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            kernel_gateway_project_number: ''
          });
        }
        if (endpoint === 'configuration') {
          return Promise.resolve({ config: 'Configuration saved' });
        }
        return Promise.resolve({});
      });

      await renderComponent();

      const bqRegionInput = container.querySelector(
        '[data-testid="bq-region-dropdown"]'
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(bqRegionInput, 'EU');
      });

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(mockSettingsSet).toHaveBeenCalledWith('bqRegion', 'EU');
    });

    it('does not persist bqRegion to settingRegistry on save when BigQuery integration is disabled', async () => {
      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(mockSettingsSet).not.toHaveBeenCalled();
    });

    it('emits error notification without reloading or emitting event when response config contains Failed', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            kernel_gateway_project_number: ''
          });
        }
        if (endpoint === 'configuration') {
          return Promise.resolve({ config: 'Failed to save configuration' });
        }
        return Promise.resolve({});
      });

      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(Notification.emit).toHaveBeenCalledWith(
        'Failed to save configuration',
        'error',
        { autoClose: 5000 }
      );
      expect(emitSpy).not.toHaveBeenCalled();
      expect(mockSettingsSet).not.toHaveBeenCalled();
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('ignores null response from configuration endpoint without notifying or reloading', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            kernel_gateway_project_number: ''
          });
        }
        if (endpoint === 'configuration') {
          return Promise.resolve(null);
        }
        return Promise.resolve({});
      });

      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(Notification.emit).not.toHaveBeenCalled();
      expect(mockReload).not.toHaveBeenCalled();
      expect(getSaveButton().disabled).toBe(false);
    });

    it('ignores configuration response with missing config status field without notifying or reloading', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            kernel_gateway_project_number: ''
          });
        }
        if (endpoint === 'configuration') {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      expect(Notification.emit).not.toHaveBeenCalled();
      expect(mockReload).not.toHaveBeenCalled();
      expect(getSaveButton().disabled).toBe(false);
    });

    it('emits error notification and logs error when configuration request rejects', async () => {
      const saveError = new Error('Server unavailable');
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            kernel_gateway_project_number: ''
          });
        }
        if (endpoint === 'configuration') {
          return Promise.reject(saveError);
        }
        return Promise.resolve({});
      });

      await renderComponent();

      await act(async () => {
        getSaveButton().click();
        await flushPromises();
      });

      const expectedMessage = `Error on POST {dataToSend}.\n${saveError}`;
      expect(Notification.emit).toHaveBeenCalledWith(expectedMessage, 'error', {
        autoClose: 5000
      });
      expect(DataprocLoggingService.log).toHaveBeenCalledWith(
        expectedMessage,
        LOG_LEVEL.ERROR
      );
      expect(getSaveButton().disabled).toBe(false);
    });
  });

  describe('footer links and Licenses dialog', () => {
    it('renders Privacy Policy, Terms of Service, Provide Feedback, and Version links', async () => {
      await renderComponent();

      const links = Array.from(container.querySelectorAll('a'));
      const hrefByText = new Map(
        links.map(link => [link.textContent?.trim(), link.getAttribute('href')])
      );

      expect(hrefByText.get('Privacy Policy')).toBe(
        'https://policies.google.com/privacy?hl=en'
      );
      expect(hrefByText.get('Terms of Service')).toBe(
        'https://policies.google.com/terms?hl=en'
      );
      expect(hrefByText.get('Provide Feedback')).toBe(
        'https://forms.gle/wnEnH3fL4JRjPwbr7'
      );
      expect(hrefByText.get(`Version ${VERSION_DETAIL}`)).toBe(
        'https://github.com/GoogleCloudDataproc/dataproc-jupyter-plugin'
      );
    });

    it('opens a blank window with third-party licenses when Licenses link is clicked', async () => {
      const mockPreElement = { textContent: '' };
      const mockAppendChild = jest.fn();
      const mockCreateElement = jest.fn().mockReturnValue(mockPreElement);
      const openSpy = jest.spyOn(window, 'open').mockReturnValue({
        document: {
          createElement: mockCreateElement,
          body: { appendChild: mockAppendChild }
        }
      } as unknown as Window);

      await renderComponent();

      const licenseLink = Array.from(container.querySelectorAll('a')).find(
        a => a.textContent === 'Licenses'
      ) as HTMLAnchorElement;

      await act(async () => {
        licenseLink.click();
      });

      expect(openSpy).toHaveBeenCalledWith('about:blank');
      expect(mockCreateElement).toHaveBeenCalledWith('pre');
      expect(mockPreElement.textContent).toBe('Mock Third Party Licenses');
      expect(mockAppendChild).toHaveBeenCalledWith(mockPreElement);
    });

    it('handles null return from window.open gracefully when Licenses link is clicked', async () => {
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

      await renderComponent();

      const licenseLink = Array.from(container.querySelectorAll('a')).find(
        a => a.textContent === 'Licenses'
      ) as HTMLAnchorElement;

      await act(async () => {
        licenseLink.click();
      });

      expect(openSpy).toHaveBeenCalledWith('about:blank');
    });
  });

  describe('Dataproc Settings and Serverless Runtime Templates section', () => {
    it('renders Dataproc Settings and ListRuntimeTemplates expanded by default when configError is false', async () => {
      await renderComponent({ configError: false });

      expect(container.textContent).toContain('Dataproc Settings');
      expect(container.textContent).toContain('Serverless Runtime Templates');
      expect(
        container.querySelector('[data-icon="launcher:expand-less-icon"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="mock-list-runtime-templates"]')
      ).not.toBeNull();
    });

    it('hides Dataproc Settings and ListRuntimeTemplates when configError is true', async () => {
      await renderComponent({ configError: true });

      expect(container.textContent).not.toContain('Dataproc Settings');
      expect(container.textContent).not.toContain(
        'Serverless Runtime Templates'
      );
      expect(
        container.querySelector('[data-testid="mock-list-runtime-templates"]')
      ).toBeNull();
    });

    it('collapses ListRuntimeTemplates when expand icon is clicked', async () => {
      await renderComponent();

      const expandIcon = container.querySelector('.expand-icon') as HTMLElement;
      await act(async () => {
        expandIcon.click();
      });

      expect(
        container.querySelector('[data-icon="launcher:expand-more-icon"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="mock-list-runtime-templates"]')
      ).toBeNull();
    });

    it('re-expands ListRuntimeTemplates when expand icon is clicked again', async () => {
      await renderComponent();

      const expandIcon = container.querySelector('.expand-icon') as HTMLElement;
      await act(async () => {
        expandIcon.click();
      });
      await act(async () => {
        expandIcon.click();
      });

      expect(
        container.querySelector('[data-icon="launcher:expand-less-icon"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="mock-list-runtime-templates"]')
      ).not.toBeNull();
    });
  });

  describe('CreateRuntime view transitions', () => {
    it('renders CreateRuntime with expected props when ListRuntimeTemplates opens create template view', async () => {
      await renderComponent();

      const openCreateBtn = container.querySelector(
        '[data-testid="open-create-template-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        openCreateBtn.click();
      });

      expect(
        container.querySelector('[data-testid="mock-create-runtime"]')
      ).not.toBeNull();
      expect(CreateRuntime).toHaveBeenCalledWith(
        expect.objectContaining({
          setOpenCreateTemplate: expect.any(Function),
          selectedRuntimeClone: mockRuntimeCloneTemplate,
          launcher: mockLauncher,
          app: mockApp,
          fromPage: 'config',
          settingRegistry: mockSettingRegistry,
          themeManager: mockThemeManager
        }),
        {}
      );
    });

    it('returns to settings view when CreateRuntime closes create template view', async () => {
      await renderComponent();

      const openCreateBtn = container.querySelector(
        '[data-testid="open-create-template-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        openCreateBtn.click();
      });

      const closeCreateBtn = container.querySelector(
        '[data-testid="close-create-template-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        closeCreateBtn.click();
      });

      expect(
        container.querySelector('[data-testid="mock-create-runtime"]')
      ).toBeNull();
      expect(container.textContent).toContain('Google Cloud Project Settings');
    });

    it('does not render CreateRuntime when launcher prop is missing', async () => {
      await renderComponent({ launcher: undefined });

      const openCreateBtn = container.querySelector(
        '[data-testid="open-create-template-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        openCreateBtn.click();
      });

      expect(
        container.querySelector('[data-testid="mock-create-runtime"]')
      ).toBeNull();
      expect(container.textContent).toContain('Google Cloud Project Settings');
    });

    it('does not render CreateRuntime when app prop is missing', async () => {
      await renderComponent({ app: undefined });

      const openCreateBtn = container.querySelector(
        '[data-testid="open-create-template-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        openCreateBtn.click();
      });

      expect(
        container.querySelector('[data-testid="mock-create-runtime"]')
      ).toBeNull();
      expect(container.textContent).toContain('Google Cloud Project Settings');
    });
  });
});
