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
import { IThemeManager } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { DataprocWidget } from '../controls/DataprocWidget';
import { requestAPI } from '../handler/handler';
import { LOGIN_STATE, STATUS_SUCCESS } from '../utils/const';
import { checkConfig } from '../utils/utils';
import { AuthLogin } from './authLogin';
import ConfigSelection from './configSelection';
import SettingsLayout from './settingsLayout';

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
  ...jest.requireActual('../utils/utils'),
  checkConfig: jest.fn()
}));

jest.mock('./configSelection', () => ({
  __esModule: true,
  default: jest.fn(({ setConfigError }: any) => (
    <div data-testid="mock-config-selection">
      Mock ConfigSelection
      <button
        data-testid="config-selection-trigger-error"
        onClick={() => setConfigError(true)}
      >
        Trigger Config Error
      </button>
    </div>
  ))
}));

jest.mock('./settingsLayout', () => ({
  __esModule: true,
  default: jest.fn(({ setConfigError }: any) => (
    <div data-testid="mock-settings-layout">
      Mock SettingsLayout
      <button
        data-testid="settings-layout-trigger-error"
        onClick={() => setConfigError(true)}
      >
        Trigger Config Error
      </button>
    </div>
  ))
}));

const flushPromises = () =>
  new Promise<void>(resolve => setTimeout(resolve, 0));

describe('AuthLogin Widget and AuthLoginComponent', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let originalLocation: Location;
  let mockReload: jest.Mock;
  let mockApp: JupyterLab;
  let mockLauncher: ILauncher;
  let mockSettingRegistry: ISettingRegistry;
  let mockThemeManager: IThemeManager;

  const mockPendingConfigCheck = () => {
    (checkConfig as jest.Mock).mockImplementation(
      () => new Promise(() => undefined)
    );
  };

  const mockResolvedConfigCheck = ({
    loginState = false,
    configError = false,
    loginError = false
  }: {
    loginState?: boolean;
    configError?: boolean;
    loginError?: boolean;
  }) => {
    (checkConfig as jest.Mock).mockImplementation(
      async (setLoginState, setConfigError, setLoginError) => {
        await Promise.resolve();
        setLoginState(loginState);
        setConfigError(configError);
        setLoginError(loginError);
      }
    );
  };

  const mockSettingsResponse = (
    settingsData: Record<string, unknown> = {
      enable_runtime_profile_integration: false
    }
  ) => {
    (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint === 'settings') {
        return Promise.resolve(settingsData);
      }
      return Promise.resolve({});
    });
  };

  const renderWidget = async (
    themeManager: IThemeManager = mockThemeManager
  ) => {
    const widget = new AuthLogin(
      mockApp,
      mockLauncher,
      mockSettingRegistry,
      themeManager
    );
    await act(async () => {
      root?.render((widget as any).render());
      await flushPromises();
    });
    return widget;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    originalLocation = window.location;
    mockReload = jest.fn();
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      reload: mockReload
    };

    mockApp = { id: 'mock-app' } as unknown as JupyterLab;
    mockLauncher = { add: jest.fn() } as unknown as ILauncher;
    mockSettingRegistry = {
      load: jest.fn()
    } as unknown as ISettingRegistry;
    mockThemeManager = {
      theme: 'JupyterLab Light',
      isLight: jest.fn().mockReturnValue(true),
      themeChanged: {
        connect: jest.fn(),
        disconnect: jest.fn()
      }
    } as unknown as IThemeManager;

    mockSettingsResponse();
    mockPendingConfigCheck();

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
    localStorage.clear();
    (window as any).location = originalLocation;
    jest.restoreAllMocks();
  });

  describe('AuthLogin widget', () => {
    it('extends DataprocWidget', () => {
      const widget = new AuthLogin(
        mockApp,
        mockLauncher,
        mockSettingRegistry,
        mockThemeManager
      );

      expect(widget).toBeInstanceOf(DataprocWidget);
    });

    it('stores app, launcher, and settingRegistry on the widget instance', () => {
      const widget = new AuthLogin(
        mockApp,
        mockLauncher,
        mockSettingRegistry,
        mockThemeManager
      );

      expect(widget.app).toBe(mockApp);
      expect(widget.launcher).toBe(mockLauncher);
      expect(widget.settingRegistry).toBe(mockSettingRegistry);
    });

    it('subscribes to themeManager.themeChanged and detects light theme', () => {
      const widget = new AuthLogin(
        mockApp,
        mockLauncher,
        mockSettingRegistry,
        mockThemeManager
      );

      expect(mockThemeManager.themeChanged.connect).toHaveBeenCalledTimes(1);
      expect(widget.isLight).toBe(true);
    });

    it('detects dark theme when themeManager reports a non-light theme', async () => {
      const darkThemeManager = {
        theme: 'JupyterLab Dark',
        isLight: jest.fn().mockReturnValue(false),
        themeChanged: {
          connect: jest.fn(),
          disconnect: jest.fn()
        }
      } as unknown as IThemeManager;

      const widget = await renderWidget(darkThemeManager);

      expect(widget.isLight).toBe(false);
      expect(
        container.querySelector('.component-level.settings-wrapper')
      ).not.toBeNull();
    });

    it('disconnects from themeManager.themeChanged when disposed', () => {
      const widget = new AuthLogin(
        mockApp,
        mockLauncher,
        mockSettingRegistry,
        mockThemeManager
      );

      widget.dispose();

      expect(mockThemeManager.themeChanged.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading state', () => {
    it('renders loading spinner while checkConfig is pending and localStorage is empty', async () => {
      await renderWidget();

      expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
      expect(container.textContent).toContain('Loading Config Setup');
    });

    it('does not render ConfigSelection or SettingsLayout while settings request is still pending', async () => {
      mockResolvedConfigCheck({ loginState: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return new Promise(() => undefined);
        }
        return Promise.resolve({});
      });

      await renderWidget();

      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="mock-settings-layout"]')
      ).toBeNull();
    });
  });

  describe('initial authentication and feature flag routing', () => {
    it('invokes checkConfig and requests settings on mount', async () => {
      await renderWidget();

      expect(checkConfig).toHaveBeenCalledTimes(1);
      expect(checkConfig).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
      expect(requestAPI).toHaveBeenCalledWith('settings');
    });

    it('renders ConfigSelection when authenticated and runtime profile UI feature flag is disabled', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({ enable_runtime_profile_integration: false });

      await renderWidget();

      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="mock-settings-layout"]')
      ).toBeNull();
    });

    it('passes expected props to ConfigSelection', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({ enable_runtime_profile_integration: false });

      await renderWidget();

      expect(ConfigSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          configError: false,
          setConfigError: expect.any(Function),
          app: mockApp,
          launcher: mockLauncher,
          settingRegistry: mockSettingRegistry,
          themeManager: mockThemeManager
        }),
        {}
      );
    });

    it('renders SettingsLayout when authenticated and runtime profile UI feature flag is enabled', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({ enable_runtime_profile_integration: true });

      await renderWidget();

      expect(
        container.querySelector('[data-testid="mock-settings-layout"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).toBeNull();
    });

    it('passes expected props to SettingsLayout', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({ enable_runtime_profile_integration: true });

      await renderWidget();

      expect(SettingsLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          configError: false,
          setConfigError: expect.any(Function),
          app: mockApp,
          settingRegistry: mockSettingRegistry
        }),
        {}
      );
    });

    it('defaults to ConfigSelection when enable_runtime_profile_integration is absent in settings response', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({});

      await renderWidget();

      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).not.toBeNull();
    });

    it('defaults to ConfigSelection when settings response is null', async () => {
      mockResolvedConfigCheck({ loginState: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve(null);
        }
        return Promise.resolve({});
      });

      await renderWidget();

      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).not.toBeNull();
    });

    it('logs an error and falls back to ConfigSelection when settings request rejects', async () => {
      const settingsError = new Error('Settings fetch failed');
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockResolvedConfigCheck({ loginState: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.reject(settingsError);
        }
        return Promise.resolve({});
      });

      await renderWidget();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching settings for feature flag',
        settingsError
      );
      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).not.toBeNull();
    });

    it('renders authenticated view immediately when localStorage already contains LOGIN_STATE', async () => {
      localStorage.setItem('loginState', LOGIN_STATE);
      mockPendingConfigCheck();
      mockSettingsResponse({ enable_runtime_profile_integration: false });

      await renderWidget();

      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).not.toBeNull();
    });
  });

  describe('error states', () => {
    it('renders login error message and enabled Google sign-in button when checkConfig sets loginError', async () => {
      mockResolvedConfigCheck({ loginError: true });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      expect(container.textContent).toContain('Please login to continue');
      expect(signInBtn).not.toBeNull();
      expect(signInBtn.className).toBe('signin-google-icon');
      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
    });

    it('renders config error message when checkConfig sets configError without loginError', async () => {
      mockResolvedConfigCheck({ configError: true, loginError: false });

      await renderWidget();

      expect(container.textContent).toContain(
        'Please configure gcloud with account, project-id and region'
      );
      expect(container.textContent).not.toContain('Please login to continue');
    });

    it('prioritizes login error message over config error message when both are true', async () => {
      mockResolvedConfigCheck({ configError: true, loginError: true });

      await renderWidget();

      expect(container.textContent).toContain('Please login to continue');
      expect(container.textContent).not.toContain(
        'Please configure gcloud with account, project-id and region'
      );
    });

    it('displays config error banner when ConfigSelection calls setConfigError(true)', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({ enable_runtime_profile_integration: false });

      await renderWidget();

      const triggerErrorBtn = container.querySelector(
        '[data-testid="config-selection-trigger-error"]'
      ) as HTMLButtonElement;

      await act(async () => {
        triggerErrorBtn.click();
      });

      expect(container.textContent).toContain(
        'Please configure gcloud with account, project-id and region'
      );
    });

    it('displays config error banner when SettingsLayout calls setConfigError(true)', async () => {
      mockResolvedConfigCheck({ loginState: true });
      mockSettingsResponse({ enable_runtime_profile_integration: true });

      await renderWidget();

      const triggerErrorBtn = container.querySelector(
        '[data-testid="settings-layout-trigger-error"]'
      ) as HTMLButtonElement;

      await act(async () => {
        triggerErrorBtn.click();
      });

      expect(container.textContent).toContain(
        'Please configure gcloud with account, project-id and region'
      );
    });
  });

  describe('login action', () => {
    it('sends POST request to login endpoint when Google sign-in button is clicked', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve({ login: STATUS_SUCCESS });
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(requestAPI).toHaveBeenCalledWith('login', { method: 'POST' });
    });

    it('disables sign-in button and prevents duplicate login calls while request is pending', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return new Promise(() => undefined);
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
      });

      expect(signInBtn.className).toBe('signin-google-icon disabled');

      await act(async () => {
        signInBtn.click();
      });

      const loginCalls = (requestAPI as jest.Mock).mock.calls.filter(
        call => call[0] === 'login'
      );
      expect(loginCalls).toHaveLength(1);
    });

    it('stores LOGIN_STATE in localStorage on successful login', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve({ login: STATUS_SUCCESS });
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(localStorage.getItem('loginState')).toBe(LOGIN_STATE);
    });

    it('reloads the page on successful login', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve({ login: STATUS_SUCCESS });
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('clears loginError and renders authenticated view after successful login', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve({ login: STATUS_SUCCESS });
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(container.textContent).not.toContain('Please login to continue');
      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).not.toBeNull();
    });

    it('removes loginState from localStorage and does not reload when login status is not STATUS_SUCCESS', async () => {
      localStorage.setItem('loginState', LOGIN_STATE);
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve({ login: 'FAILED' });
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(localStorage.getItem('loginState')).toBeNull();
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('keeps login error visible when login status is not STATUS_SUCCESS', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve({ login: 'FAILED' });
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(container.textContent).toContain('Please login to continue');
      expect(
        container.querySelector('[data-testid="mock-config-selection"]')
      ).toBeNull();
    });

    it('handles null response from login endpoint without reloading or storing loginState', async () => {
      mockResolvedConfigCheck({ loginError: true });
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({ enable_runtime_profile_integration: false });
        }
        if (endpoint === 'login') {
          return Promise.resolve(null);
        }
        return Promise.resolve({});
      });

      await renderWidget();

      const signInBtn = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;
      await act(async () => {
        signInBtn.click();
        await flushPromises();
      });

      expect(localStorage.getItem('loginState')).toBeNull();
      expect(mockReload).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Please login to continue');
    });
  });
});
