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

import * as path from 'path';
import { Panel } from '@lumino/widgets';
import { NotebookPanel } from '@jupyterlab/notebook';

const mockGcpServiceUrls = {
  dataproc_url: 'https://dataproc.googleapis.com/',
  compute_url: 'https://compute.googleapis.com/compute',
  metastore_url: 'https://metastore.googleapis.com/',
  cloudkms_url: 'https://cloudkms.googleapis.com/',
  cloudresourcemanager_url: 'https://cloudresourcemanager.googleapis.com/',
  datacatalog_url: 'https://datacatalog.googleapis.com/',
  storage_url: 'https://storage.googleapis.com/'
};

jest.mock('@jupyter/web-components', () => ({
  provideJupyterDesignSystem: jest.fn().mockReturnValue({
    register: jest.fn()
  }),
  jpButton: jest.fn(),
  jpToolbar: jest.fn(),
  addJupyterLabThemeChangeListener: jest.fn()
}));

jest.mock('@jupyter/react-components', () => ({
  Button: () => null
}));

jest.mock('../cluster/cluster', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    Cluster: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../batches/batches', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    Batches: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../notebookTemplates/notebookTemplates', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    NotebookTemplates: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../login/authLogin', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    AuthLogin: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../dpms/dpmsWidget', () => {
  const { Widget } = require('@lumino/widgets');
  class MockDpmsWidget extends Widget {}
  const dpmsWidget = jest.fn(() => new MockDpmsWidget());
  // Preserve prototype chain so `widget instanceof dpmsWidget` succeeds in loadDpmsWidget
  dpmsWidget.prototype = MockDpmsWidget.prototype;
  return { dpmsWidget };
});

jest.mock('../bigQuery/bigQueryWidget', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    BigQueryWidget: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../runtime/runtimeTemplate', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    RuntimeTemplate: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../runtimeProfile/createRuntimeProfile', () => {
  const { Widget } = require('@lumino/widgets');
  return {
    CreateRuntimeProfile: jest.fn().mockImplementation(() => new Widget())
  };
});

jest.mock('../controls/NotebookButtonExtension', () => ({
  NotebookButtonExtension: class MockNotebookButtonExtension {}
}));

jest.mock('../notifications', () => ({
  setupNotificationSystem: jest.fn()
}));

jest.mock('../bigQuery/bigQueryService', () => ({
  BigQueryService: {
    checkBigQueryDatasetsAPIService: jest.fn()
  }
}));

jest.mock('../runtime/runtimeService', () => ({
  RuntimeService: {
    checkDataprocApiEnabledService: jest.fn()
  }
}));

jest.mock('../notebookTemplates/notebookTemplatesService', () => ({
  __esModule: true,
  default: {
    handleClickService: jest.fn()
  }
}));

jest.mock('../handler/handler', () => ({
  requestAPI: jest.fn(() => Promise.resolve(mockGcpServiceUrls))
}));

jest.mock('../utils/utils', () => ({
  ...jest.requireActual('../utils/utils'),
  authApi: jest.fn(),
  iconDisplay: jest.fn()
}));

jest.mock('../utils/loggingService', () => ({
  DataprocLoggingService: {
    attach: jest.fn(),
    log: jest.fn()
  },
  LOG_LEVEL: {
    INFO: 0,
    WARNING: 1,
    ERROR: 2
  }
}));

jest.mock('@jupyterlab/services', () => {
  const actual = jest.requireActual('@jupyterlab/services');
  return {
    ...actual,
    KernelAPI: {
      ...actual.KernelAPI,
      listRunning: jest.fn()
    },
    KernelSpecAPI: {
      ...actual.KernelSpecAPI,
      getSpecs: jest.fn()
    }
  };
});

jest.mock('@jupyterlab/apputils', () => {
  const actual = jest.requireActual('@jupyterlab/apputils');
  return {
    ...actual,
    Notification: {
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      success: jest.fn()
    }
  };
});

import extension from '../index';
import { PLUGIN_ID } from '../utils/const';
import { DataprocLoggingService } from '../utils/loggingService';
import { NotebookButtonExtension } from '../controls/NotebookButtonExtension';
import { CreateRuntimeProfile } from '../runtimeProfile/createRuntimeProfile';
import { RuntimeTemplate } from '../runtime/runtimeTemplate';
import { Cluster } from '../cluster/cluster';
import { Batches } from '../batches/batches';
import { NotebookTemplates } from '../notebookTemplates/notebookTemplates';
import { AuthLogin } from '../login/authLogin';
import { BigQueryWidget } from '../bigQuery/bigQueryWidget';
import { dpmsWidget } from '../dpms/dpmsWidget';
import { requestAPI } from '../handler/handler';
import { eventEmitter } from '../utils/signalEmitter';
import { Notification, MainAreaWidget } from '@jupyterlab/apputils';
import NotebookTemplateService from '../notebookTemplates/notebookTemplatesService';
import { BigQueryService } from '../bigQuery/bigQueryService';
import { RuntimeService } from '../runtime/runtimeService';
import { authApi, iconDisplay } from '../utils/utils';
import { KernelAPI, KernelSpecAPI } from '@jupyterlab/services';
import { setupNotificationSystem } from '../notifications';

const DEFAULT_KERNEL_SPECS = {
  kernelspecs: {
    'session-kernel': {
      name: 'session-kernel',
      display_name: 'Session Kernel',
      argv: ['python'],
      resources: {
        endpointParentResource: 'projects/p/locations/l/sessions/s1'
      },
      metadata: {}
    },
    'cluster-kernel': {
      name: 'cluster-kernel',
      display_name: 'Cluster Kernel',
      argv: ['python'],
      resources: {
        endpointParentResource: 'projects/p/regions/r/clusters/c1'
      },
      metadata: {}
    }
  }
};

describe('extension index.ts comprehensive test suite', () => {
  const initialDocumentTitle = document.title;
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  let appMock: any;
  let factoryMock: any;
  let defaultFileBrowserMock: any;
  let launcherMock: any;
  let mainMenuMock: any;
  let labShellMock: any;
  let notebookTrackerMock: any;
  let themeManagerMock: any;
  let settingRegistryMock: any;
  let documentManagerMock: any;
  let commandsMap: Map<string, any>;
  let currentChangedCallback:
    | ((sender: any, args: any) => Promise<void>)
    | null = null;
  let themeChangedCallback: (() => void) | null = null;
  let resolveRestored: () => void;
  let rejectRestored: (reason?: any) => void;
  let registeredEmitterListeners: Array<{
    event: string;
    listener: Parameters<typeof eventEmitter.on>[1];
  }>;

  const activateExtension = (overrides: { launcher?: any } = {}) =>
    (extension.activate as any)(
      appMock,
      factoryMock,
      defaultFileBrowserMock,
      'launcher' in overrides ? overrides.launcher : launcherMock,
      mainMenuMock,
      labShellMock,
      notebookTrackerMock,
      themeManagerMock,
      settingRegistryMock,
      documentManagerMock
    );

  const createMockNotebookPanel = (
    label: string,
    kernelName: string | null,
    titleChangedConnect = jest.fn(),
    titleChangedDisconnect = jest.fn()
  ) => {
    const panel = Object.create(NotebookPanel.prototype, {
      title: {
        value: {
          label,
          owner: null,
          changed: {
            connect: titleChangedConnect,
            disconnect: titleChangedDisconnect
          }
        }
      },
      toolbar: {
        value: {
          update: jest.fn()
        }
      },
      sessionContext: {
        writable: true,
        value: {
          session: kernelName ? { kernel: { name: kernelName } } : null
        }
      }
    });
    panel.title.owner = panel;
    return panel;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.title = initialDocumentTitle;
    commandsMap = new Map();
    currentChangedCallback = null;
    themeChangedCallback = null;
    registeredEmitterListeners = [];

    const originalOn = eventEmitter.on.bind(eventEmitter);
    jest.spyOn(eventEmitter, 'on').mockImplementation((event, listener) => {
      registeredEmitterListeners.push({ event, listener });
      originalOn(event, listener);
    });

    (authApi as jest.Mock).mockResolvedValue({
      project_id: 'test-project',
      login_error: false,
      config_error: false
    });
    (iconDisplay as jest.Mock).mockReturnValue({});
    (
      RuntimeService.checkDataprocApiEnabledService as jest.Mock
    ).mockResolvedValue({ is_enabled: true });
    (
      BigQueryService.checkBigQueryDatasetsAPIService as jest.Mock
    ).mockResolvedValue({ is_enabled: true });
    (KernelAPI.listRunning as jest.Mock).mockResolvedValue([]);
    (KernelSpecAPI.getSpecs as jest.Mock).mockResolvedValue(
      DEFAULT_KERNEL_SPECS
    );

    (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint === 'settings') {
        return Promise.resolve({
          enable_bigquery_integration: true,
          enable_metastore_integration: true,
          enable_cloud_storage_integration: true,
          enable_runtime_profile_integration: true
        });
      }
      if (endpoint === 'getGcpServiceUrls') {
        return Promise.resolve(mockGcpServiceUrls);
      }
      if (endpoint.startsWith('checkResourceManager')) {
        return Promise.resolve({ status: 'OK' });
      }
      if (endpoint.startsWith('jupyterlabVersion')) {
        return Promise.resolve('0.1.0');
      }
      if (endpoint.startsWith('updatePlugin')) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    appMock = {
      commands: {
        addCommand: jest.fn((id: string, options: any) => {
          commandsMap.set(id, options);
          return { dispose: jest.fn() };
        }),
        execute: jest.fn().mockResolvedValue({ path: 'test-doc-path' })
      },
      restored: new Promise<void>((resolve, reject) => {
        resolveRestored = resolve;
        rejectRestored = reject;
      }),
      shell: {
        add: jest.fn(),
        currentWidget: {
          update: jest.fn()
        }
      },
      docRegistry: {
        addWidgetExtension: jest.fn()
      },
      serviceManager: {
        contents: {
          save: jest.fn().mockResolvedValue({})
        }
      }
    };

    factoryMock = {
      tracker: {
        currentWidget: {
          model: {
            path: 'workspace/path'
          }
        }
      }
    };

    defaultFileBrowserMock = {};

    launcherMock = {
      add: jest.fn()
    };

    mainMenuMock = {};

    labShellMock = {
      currentChanged: {
        connect: jest.fn((cb: any) => {
          currentChangedCallback = cb;
        })
      }
    };

    notebookTrackerMock = {};

    themeManagerMock = {
      theme: 'JupyterLab Light',
      isLight: jest.fn().mockReturnValue(true),
      themeChanged: {
        connect: jest.fn((cb: any) => {
          themeChangedCallback = cb;
        })
      }
    };

    settingRegistryMock = {
      load: jest.fn().mockResolvedValue({
        get: jest.fn().mockReturnValue({ composite: 'us-central1' })
      })
    };

    documentManagerMock = {};
  });

  afterEach(() => {
    registeredEmitterListeners.splice(0).forEach(({ event, listener }) => {
      eventEmitter.off(event, listener);
    });
    document.title = initialDocumentTitle;
    jest.restoreAllMocks();
  });

  describe('1. Plugin metadata and initial activation sequence', () => {
    it('should have correct plugin properties', () => {
      expect(extension.id).toBe(PLUGIN_ID);
      expect(extension.autoStart).toBe(true);
      expect(Array.isArray(extension.optional)).toBe(true);
    });

    it('should attach DataprocLoggingService, setup notifications, and register notebook widget extension', async () => {
      await activateExtension();

      expect(DataprocLoggingService.attach).toHaveBeenCalled();
      expect(appMock.docRegistry.addWidgetExtension).toHaveBeenCalledWith(
        'Notebook',
        expect.any(NotebookButtonExtension)
      );
      expect(setupNotificationSystem).toHaveBeenCalledWith(appMock);
    });

    it('should handle window beforeunload event by removing notebookValue from localStorage', async () => {
      localStorage.setItem('notebookValue', 'test-cluster');

      await activateExtension();

      window.dispatchEvent(new Event('beforeunload'));
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });

    it('should run executeApiChecks after app.restored resolves when document is complete', async () => {
      await activateExtension();

      resolveRestored();
      await flushPromises();

      expect(RuntimeService.checkDataprocApiEnabledService).toHaveBeenCalled();
      expect(
        BigQueryService.checkBigQueryDatasetsAPIService
      ).toHaveBeenCalled();
      expect(requestAPI).toHaveBeenCalledWith(
        'jupyterlabVersion?packageName=dataproc_jupyter_plugin',
        { method: 'GET' }
      );
    });

    it('should defer executeApiChecks until window load event when document.readyState is loading', async () => {
      jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');

      await activateExtension();

      resolveRestored();
      await flushPromises();

      expect(requestAPI).not.toHaveBeenCalledWith(
        'jupyterlabVersion?packageName=dataproc_jupyter_plugin',
        { method: 'GET' }
      );

      window.dispatchEvent(new Event('load'));
      await flushPromises();

      expect(requestAPI).toHaveBeenCalledWith(
        'jupyterlabVersion?packageName=dataproc_jupyter_plugin',
        { method: 'GET' }
      );
    });

    it('should log error when app.restored rejects', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await activateExtension();

      const restoreError = new Error('restoration failed');
      rejectRestored(restoreError);
      await flushPromises();

      expect(errorSpy).toHaveBeenCalledWith(
        'Error during app restoration:',
        restoreError
      );
    });
  });

  describe('2. Side panels initialization and theme switching', () => {
    it('should initialize BigQuery and DPMS side panels when enabled in settings', async () => {
      await activateExtension();

      expect(BigQueryWidget).toHaveBeenCalled();
      expect(dpmsWidget).toHaveBeenCalled();

      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(Panel),
        'left',
        { rank: 1000 }
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(Panel),
        'left',
        { rank: 1001 }
      );
    });

    it('should coerce string feature flags ("true" and "1") to enable side panels', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: 'true',
            enable_metastore_integration: '1'
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(BigQueryWidget).toHaveBeenCalled();
      expect(dpmsWidget).toHaveBeenCalledTimes(1);
    });

    it('should not initialize side panels for falsy string ("false") or undefined flags and should early-return on theme change', async () => {
      localStorage.setItem('notebookValue', 'existing-c1/clusters');
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: 'false',
            enable_metastore_integration: undefined
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(BigQueryWidget).not.toHaveBeenCalled();
      expect(dpmsWidget).not.toHaveBeenCalled();
      expect(appMock.shell.add).not.toHaveBeenCalledWith(
        expect.any(Panel),
        'left',
        expect.anything()
      );

      themeManagerMock.isLight.mockClear();
      themeChangedCallback!();
      expect(themeManagerMock.isLight).not.toHaveBeenCalled();
    });

    it('should reload DPMS widget and dispose previous dpmsWidget when notebookValue is preset in localStorage', async () => {
      localStorage.setItem('notebookValue', 'existing-c1/clusters');

      await activateExtension();

      const dpmsMock = dpmsWidget as unknown as jest.Mock;
      expect(dpmsMock).toHaveBeenCalledTimes(2);
      const firstInstance = dpmsMock.mock.results[0].value;
      const secondInstance = dpmsMock.mock.results[1].value;
      expect(firstInstance.isDisposed).toBe(true);
      expect(secondInstance.isDisposed).toBe(false);
    });

    it('should update side panel icons on theme change and default to light icons when theme is null', async () => {
      await activateExtension();

      const leftShellCalls = (appMock.shell.add as jest.Mock).mock.calls.filter(
        call => call[1] === 'left'
      );
      const bqPanel: Panel = leftShellCalls[0][0];
      const dpmsPanel: Panel = leftShellCalls[1][0];

      expect(themeChangedCallback).toBeDefined();

      // Dark theme icons
      themeManagerMock.isLight.mockReturnValue(false);
      themeChangedCallback!();
      expect((bqPanel.title.icon as any).name).toBe(
        'launcher:dataset-explorer-icon-dark'
      );
      expect((dpmsPanel.title.icon as any).name).toBe(
        'launcher:dpms-icon-dark'
      );

      // Light theme icons
      themeManagerMock.isLight.mockReturnValue(true);
      themeChangedCallback!();
      expect((bqPanel.title.icon as any).name).toBe(
        'launcher:dataset-explorer-icon'
      );
      expect((dpmsPanel.title.icon as any).name).toBe('launcher:dpms-icon');

      // Null theme falls back to light icons without calling isLight
      themeManagerMock.isLight.mockReturnValue(false);
      themeChangedCallback!();
      expect((dpmsPanel.title.icon as any).name).toBe(
        'launcher:dpms-icon-dark'
      );

      themeManagerMock.theme = null;
      themeManagerMock.isLight.mockClear();
      themeChangedCallback!();
      expect(themeManagerMock.isLight).not.toHaveBeenCalled();
      expect((bqPanel.title.icon as any).name).toBe(
        'launcher:dataset-explorer-icon'
      );
      expect((dpmsPanel.title.icon as any).name).toBe('launcher:dpms-icon');
    });
  });

  describe('3. Event emitter signal handlers and API enablement checks', () => {
    it('should respond to dataprocConfigChange signal by re-checking APIs and reloading panels', async () => {
      await activateExtension();
      (BigQueryWidget as unknown as jest.Mock).mockClear();
      (dpmsWidget as unknown as jest.Mock).mockClear();

      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(RuntimeService.checkDataprocApiEnabledService).toHaveBeenCalled();
      expect(
        BigQueryService.checkBigQueryDatasetsAPIService
      ).toHaveBeenCalled();
      expect(BigQueryWidget).toHaveBeenCalled();
      expect(dpmsWidget).toHaveBeenCalled();
    });

    it('should notify error and open enable links when Dataproc and BigQuery APIs are disabled', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      await activateExtension();

      (
        RuntimeService.checkDataprocApiEnabledService as jest.Mock
      ).mockResolvedValueOnce({ is_enabled: false });
      (
        BigQueryService.checkBigQueryDatasetsAPIService as jest.Mock
      ).mockResolvedValueOnce({ is_enabled: false });

      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        'The Cloud Dataproc API is not enabled.',
        expect.any(Object)
      );
      expect(Notification.error).toHaveBeenCalledWith(
        'The BigQuery API is not enabled.',
        expect.any(Object)
      );

      for (const [, options] of (Notification.error as jest.Mock).mock.calls) {
        options?.actions?.[0]?.callback();
      }

      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/dataproc.googleapis.com?project=test-project',
        '_blank'
      );
      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/bigquery.googleapis.com?project=test-project',
        '_blank'
      );
    });

    it('should skip BigQuery API check when enable_bigquery_integration is false', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            enable_metastore_integration: false
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(RuntimeService.checkDataprocApiEnabledService).toHaveBeenCalled();
      expect(
        BigQueryService.checkBigQueryDatasetsAPIService
      ).not.toHaveBeenCalled();
    });

    it('should skip Dataproc and BigQuery API checks when authApi returns login_error', async () => {
      await activateExtension();

      (authApi as jest.Mock).mockResolvedValueOnce({
        login_error: true,
        config_error: false
      });

      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(
        RuntimeService.checkDataprocApiEnabledService
      ).not.toHaveBeenCalled();
      expect(
        BigQueryService.checkBigQueryDatasetsAPIService
      ).not.toHaveBeenCalled();
    });

    it('should still run API checks when authApi resolves to undefined', async () => {
      await activateExtension();

      (authApi as jest.Mock).mockResolvedValueOnce(undefined);
      (
        RuntimeService.checkDataprocApiEnabledService as jest.Mock
      ).mockResolvedValueOnce({ is_enabled: false });

      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        'The Cloud Dataproc API is not enabled.',
        expect.any(Object)
      );
    });
  });

  describe('4. Resource Manager and JupyterLab version checks', () => {
    it('should notify error and open enable link when Cloud Resource Manager API is not enabled', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            enable_metastore_integration: false
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({
            status: 'ERROR',
            error:
              'API [cloudresourcemanager.googleapis.com] not enabled on project'
          });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Cloud Resource Manager API is not enabled'),
        expect.any(Object)
      );

      const actions = (Notification.error as jest.Mock).mock.calls[0][1]
        .actions;
      actions[0].callback();
      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com?project=test-project',
        '_blank'
      );
    });

    it('should notify generic error message for other Resource Manager API errors', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({
            status: 'ERROR',
            error: 'Permission denied on resource'
          });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(Notification.error).toHaveBeenCalledWith(
        'Error calling into the Resource Manager API: Permission denied on resource',
        { autoClose: false }
      );
    });

    it('should notify generic error when Resource Manager returns status ERROR without error details and credentials are undefined', async () => {
      (authApi as jest.Mock).mockResolvedValueOnce(undefined);
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'ERROR' });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(Notification.error).toHaveBeenCalledWith(
        'Error calling into the Resource Manager API: undefined',
        { autoClose: false }
      );
    });

    it('should log error and not throw when checkResourceManager request rejects', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const networkError = new Error('network failure');
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.reject(networkError);
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(errorSpy).toHaveBeenCalledWith(
        'Resource manager Api not enabled:',
        networkError
      );
    });

    it('should prompt for update when a newer JupyterLab plugin version is available and handle Ignore action', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.resolve('99.0.0');
        }
        return Promise.resolve({});
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      expect(Notification.info).toHaveBeenCalledWith(
        'There is a new version of Dataproc extension available. Would you like to update the extension?',
        expect.objectContaining({ autoClose: false })
      );

      const actions = (Notification.info as jest.Mock).mock.calls[0][1].actions;
      actions[1].callback();
      expect(Notification.warning).toHaveBeenCalledWith(
        'Update Cancelled bu user'
      );
    });

    it('should call updatePlugin and reload page when user clicks Update', async () => {
      const reloadMock = jest.fn();
      jest.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        reload: reloadMock
      } as Location);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.resolve('99.0.0');
        }
        if (endpoint.startsWith('updatePlugin')) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      const actions = (Notification.info as jest.Mock).mock.calls[0][1].actions;
      await actions[0].callback();

      expect(logSpy).toHaveBeenCalledWith(
        'Update JupyterLab to the latest version'
      );
      expect(requestAPI).toHaveBeenCalledWith(
        'updatePlugin?packageName=dataproc_jupyter_plugin',
        { method: 'POST' }
      );
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('should notify error when updatePlugin fails during Update action', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.resolve('99.0.0');
        }
        if (endpoint.startsWith('updatePlugin')) {
          return Promise.reject(new Error('pip install failed'));
        }
        return Promise.resolve({});
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      const actions = (Notification.info as jest.Mock).mock.calls[0][1].actions;
      await actions[0].callback();

      expect(logSpy).toHaveBeenCalledWith(
        'Update JupyterLab to the latest version'
      );
      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Update failed.')
      );
    });

    it('should notify error and log failure when fetching JupyterLab version fails', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const versionError = new Error('version endpoint error');
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.reject(versionError);
        }
        return Promise.resolve({});
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch JupyterLab version:')
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to check API status:',
        versionError
      );
    });
  });

  describe('5. Component Commands Registration & Execution', () => {
    beforeEach(async () => {
      await activateExtension();
    });

    it('should register and execute create-runtime-template-component command', () => {
      const command = commandsMap.get('create-runtime-template-component');
      expect(command).toBeDefined();
      expect(command.caption).toBe('Create a new runtime template');
      expect(command.label).toBe('New Runtime Template');

      command.execute();
      expect(RuntimeTemplate).toHaveBeenCalledWith(
        appMock,
        launcherMock,
        themeManagerMock,
        settingRegistryMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(MainAreaWidget),
        'main'
      );
    });

    const lastOpenedTabTitle = () => {
      const calls = (appMock.shell.add as jest.Mock).mock.calls;
      return calls[calls.length - 1][0].title.label;
    };

    it('should register and execute create-runtime-profile-component command', () => {
      const command = commandsMap.get('create-runtime-profile-component');
      expect(command).toBeDefined();
      expect(command.caption).toBe('Create Runtime Profile');
      expect(command.label).toBe('Create Runtime Profile');

      command.execute();
      expect(CreateRuntimeProfile).toHaveBeenCalledWith(
        appMock,
        launcherMock,
        themeManagerMock,
        settingRegistryMock,
        undefined
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(MainAreaWidget),
        'main'
      );
      expect(lastOpenedTabTitle()).toBe('Create Runtime Profile');
    });

    it('should open create-runtime-profile-component in edit mode for the given profile', () => {
      const command = commandsMap.get('create-runtime-profile-component');
      const profile = {
        name: 'projects/test-project/locations/us-central1/sessionTemplates/sample-profile',
        jupyterSession: { displayName: 'sample-profile', kernel: 'PYTHON' }
      };

      command.execute({ mode: 'edit', profile });
      expect(CreateRuntimeProfile).toHaveBeenLastCalledWith(
        appMock,
        launcherMock,
        themeManagerMock,
        settingRegistryMock,
        profile
      );
      expect(lastOpenedTabTitle()).toBe('Edit Runtime Profile');

      // A profile without edit mode still opens the create form
      command.execute({ profile });
      expect(CreateRuntimeProfile).toHaveBeenLastCalledWith(
        appMock,
        launcherMock,
        themeManagerMock,
        settingRegistryMock,
        undefined
      );
      expect(lastOpenedTabTitle()).toBe('Create Runtime Profile');
    });

    it('should show the open edit tab instead of opening a second one for the same profile', () => {
      const command = commandsMap.get('create-runtime-profile-component');
      appMock.shell.activateById = jest.fn();
      const profile = {
        name: 'projects/test-project/locations/us-central1/sessionTemplates/sample-profile',
        jupyterSession: { displayName: 'sample-profile', kernel: 'PYTHON' }
      };
      const shellAdd = appMock.shell.add as jest.Mock;
      const addsBefore = shellAdd.mock.calls.length;

      command.execute({ mode: 'edit', profile });
      const editWidget = shellAdd.mock.calls[addsBefore][0];
      command.execute({ mode: 'edit', profile: { ...profile } });
      expect(shellAdd.mock.calls.length).toBe(addsBefore + 1);
      expect(appMock.shell.activateById).toHaveBeenCalledWith(editWidget.id);

      // Another profile gets its own tab
      command.execute({
        mode: 'edit',
        profile: { ...profile, name: `${profile.name}-2` }
      });
      expect(shellAdd.mock.calls.length).toBe(addsBefore + 2);

      // After the tab is closed, editing opens a new one
      editWidget.dispose();
      command.execute({ mode: 'edit', profile });
      expect(shellAdd.mock.calls.length).toBe(addsBefore + 3);
    });

    it('should register and execute create-cluster-component command', () => {
      const command = commandsMap.get('create-cluster-component');
      expect(command).toBeDefined();
      expect(command.caption).toBe('Clusters');
      expect(command.label).toBe('Clusters');

      command.execute();
      expect(Cluster).toHaveBeenCalledWith(
        settingRegistryMock,
        appMock,
        themeManagerMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(MainAreaWidget),
        'main'
      );
    });

    it('should register and execute create-batches-component command', () => {
      const command = commandsMap.get('create-batches-component');
      expect(command).toBeDefined();
      expect(command.caption).toBe('Serverless');
      expect(command.label).toBe('Serverless');

      command.execute();
      expect(Batches).toHaveBeenCalledWith(
        settingRegistryMock,
        appMock,
        themeManagerMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(MainAreaWidget),
        'main'
      );
    });

    it('should register and execute create-template-component command', () => {
      const command = commandsMap.get('create-template-component');
      expect(command).toBeDefined();
      expect(command.caption).toBe('Notebook Templates');
      expect(command.label).toBe('Notebook Templates');

      command.execute();
      expect(NotebookTemplates).toHaveBeenCalledWith(
        appMock,
        themeManagerMock,
        factoryMock,
        settingRegistryMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(MainAreaWidget),
        'main'
      );
    });

    it('should register and execute cloud-dataproc-settings:configure command', () => {
      const command = commandsMap.get('cloud-dataproc-settings:configure');
      expect(command).toBeDefined();
      expect(command.label).toBe('Google Cloud Settings');

      command.execute();
      expect(AuthLogin).toHaveBeenCalledWith(
        appMock,
        launcherMock,
        settingRegistryMock,
        themeManagerMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(MainAreaWidget),
        'main'
      );
    });

    it('should register and execute create-bigquery-notebook-component command', async () => {
      const command = commandsMap.get('create-bigquery-notebook-component');
      expect(command).toBeDefined();
      expect(command.caption).toBe('BigQuery DataFrames');
      expect(command.label).toBe('BigQuery DataFrames');

      await command.execute();
      expect(NotebookTemplateService.handleClickService).toHaveBeenCalled();
    });

    it('should download BigQuery notebook to local workspace path with injected PROJECT_ID and REGION', async () => {
      const command = commandsMap.get('create-bigquery-notebook-component');
      const notebookContent: any = {
        cells: [{}, {}, { source: ['# Config\n', '', ''] }]
      };
      (
        NotebookTemplateService.handleClickService as jest.Mock
      ).mockImplementationOnce(async (template, cb) => {
        await cb(notebookContent, template.url);
      });

      await command.execute();

      const expectedPath = `workspace/path${path.sep}bigframes_quickstart.ipynb`;
      expect(notebookContent.cells[2].source[1]).toBe(
        "PROJECT_ID = 'test-project' \n"
      );
      expect(notebookContent.cells[2].source[2]).toBe(
        "REGION = 'us-central1'\n"
      );
      expect(appMock.serviceManager.contents.save).toHaveBeenCalledWith(
        expectedPath,
        {
          type: 'file',
          format: 'text',
          content: JSON.stringify(notebookContent)
        }
      );
      expect(appMock.shell.currentWidget.update).toHaveBeenCalled();
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        path: expectedPath
      });
    });

    it('should download BigQuery notebook to root when file browser path starts with gs: and skip injection when credentials are null', async () => {
      const command = commandsMap.get('create-bigquery-notebook-component');
      factoryMock.tracker.currentWidget = {
        model: { path: 'gs://my-bucket/notebooks' }
      };
      appMock.shell.currentWidget = null;
      (authApi as jest.Mock).mockResolvedValueOnce(null);

      const gcsNotebookContent: any = {
        cells: [
          {},
          {},
          { source: ['', 'unchanged-project', 'unchanged-region'] }
        ]
      };
      (
        NotebookTemplateService.handleClickService as jest.Mock
      ).mockImplementationOnce(async (template, cb) => {
        await cb(gcsNotebookContent, template.url);
      });

      await command.execute();

      const expectedPath = `${path.sep}bigframes_quickstart.ipynb`;
      expect(gcsNotebookContent.cells[2].source[1]).toBe('unchanged-project');
      expect(gcsNotebookContent.cells[2].source[2]).toBe('unchanged-region');
      expect(appMock.serviceManager.contents.save).toHaveBeenCalledWith(
        expectedPath,
        expect.objectContaining({ type: 'file', format: 'text' })
      );
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        path: expectedPath
      });
    });

    it('should log error and abort download when no active file browser widget exists', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const command = commandsMap.get('create-bigquery-notebook-component');
      factoryMock.tracker.currentWidget = null;

      const notebookContent: any = {
        cells: [{}, {}, { source: ['', '', ''] }]
      };
      (
        NotebookTemplateService.handleClickService as jest.Mock
      ).mockImplementationOnce(async (template, cb) => {
        await cb(notebookContent, template.url);
      });

      await command.execute();

      expect(errorSpy).toHaveBeenCalledWith(
        'No active file browser widget found.'
      );
      expect(appMock.serviceManager.contents.save).not.toHaveBeenCalled();
    });

    it('should filter icon when isPalette is true on commands with icon functions', () => {
      const templateCmd = commandsMap.get('create-runtime-template-component');
      expect(templateCmd.icon({ isPalette: true })).toBeNull();
      expect(templateCmd.icon({ isPalette: false })).toBeDefined();

      const profileCmd = commandsMap.get('create-runtime-profile-component');
      expect(profileCmd.icon({ isPalette: true })).toBeNull();
      expect(profileCmd.icon({ isPalette: false })).toBeDefined();

      const clusterCmd = commandsMap.get('create-cluster-component');
      expect(clusterCmd.icon({ isPalette: true })).toBeNull();
      expect(clusterCmd.icon({ isPalette: false })).toBeDefined();

      const batchesCmd = commandsMap.get('create-batches-component');
      expect(batchesCmd.icon({ isPalette: true })).toBeNull();
      expect(batchesCmd.icon({ isPalette: false })).toBeDefined();

      const nbTemplatesCmd = commandsMap.get('create-template-component');
      expect(nbTemplatesCmd.icon({ isPalette: true })).toBeNull();
      expect(nbTemplatesCmd.icon({ isPalette: false })).toBeDefined();
    });
  });

  describe('6. Launcher Items & Dynamic Kernels', () => {
    it('should add BigQuery Notebooks launcher entry when bigquery is enabled', async () => {
      await activateExtension();

      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-bigquery-notebook-component',
          category: 'BigQuery Notebooks',
          rank: 1
        })
      );
    });

    it('should add serverless and cluster notebook kernel commands to launcher and execute serverless kernel command', async () => {
      await activateExtension();

      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'notebook:create-session-kernel',
          category: 'Dataproc Serverless Spark'
        })
      );
      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'notebook:create-cluster-kernel',
          category: 'Dataproc Cluster Notebooks'
        })
      );

      const sessionKernelCmd = commandsMap.get(
        'notebook:create-session-kernel'
      );
      expect(sessionKernelCmd).toBeDefined();
      expect(sessionKernelCmd.icon()).toBeDefined();
      expect(iconDisplay).toHaveBeenCalledWith(
        DEFAULT_KERNEL_SPECS.kernelspecs['session-kernel'],
        themeManagerMock
      );

      await sessionKernelCmd.execute();

      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'docmanager:new-untitled',
        expect.objectContaining({
          type: 'notebook',
          kernel: { name: 'session-kernel' }
        })
      );
      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'docmanager:open',
        expect.objectContaining({
          kernel: { name: 'session-kernel' },
          path: 'test-doc-path',
          factory: 'notebook'
        })
      );
    });

    it('should execute dynamic cluster notebook kernel command and resolve cluster kernel icon', async () => {
      await activateExtension();

      const clusterKernelCmd = commandsMap.get(
        'notebook:create-cluster-kernel'
      );
      expect(clusterKernelCmd).toBeDefined();
      expect(clusterKernelCmd.icon()).toBeDefined();
      expect(iconDisplay).toHaveBeenCalledWith(
        DEFAULT_KERNEL_SPECS.kernelspecs['cluster-kernel'],
        themeManagerMock
      );

      await clusterKernelCmd.execute();

      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'docmanager:new-untitled',
        {
          type: 'notebook',
          path: '',
          kernel: { name: 'cluster-kernel' }
        }
      );
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        kernel: { name: 'cluster-kernel' },
        path: 'test-doc-path',
        factory: 'notebook'
      });
    });

    it('should ignore undefined kernel specs and kernels without endpointParentResource', async () => {
      (KernelSpecAPI.getSpecs as jest.Mock).mockResolvedValueOnce({
        kernelspecs: {
          'undefined-spec': undefined,
          'no-endpoint-kernel': {
            name: 'no-endpoint-kernel',
            display_name: 'No Endpoint',
            argv: ['python'],
            resources: {},
            metadata: {}
          }
        }
      });

      await activateExtension();

      expect(commandsMap.has('notebook:create-undefined-spec')).toBe(false);
      expect(commandsMap.has('notebook:create-no-endpoint-kernel')).toBe(false);
      expect(launcherMock.add).not.toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Dataproc Cluster Notebooks'
        })
      );
    });

    it('should add static commands to launcher with correct categories and ranks', async () => {
      await activateExtension();

      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-runtime-profile-component',
          category: 'Dataproc Serverless Spark'
        })
      );
      expect(launcherMock.add).not.toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-runtime-template-component'
        })
      );
      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-cluster-component',
          rank: 1
        })
      );
      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-batches-component',
          rank: 2
        })
      );
      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-template-component',
          rank: 3
        })
      );
    });

    it('should add create-runtime-template-component to launcher when runtime profile is disabled', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            enable_metastore_integration: true,
            enable_cloud_storage_integration: true,
            enable_runtime_profile_integration: false
          });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-runtime-template-component',
          category: 'Dataproc Serverless Spark'
        })
      );
      expect(launcherMock.add).not.toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-runtime-profile-component'
        })
      );
    });

    it('should skip launcher registration when optional launcher is not provided', async () => {
      await activateExtension({ launcher: null });

      expect(launcherMock.add).not.toHaveBeenCalled();
    });

    it('should execute apputils:notify with BigQuery message on extension load when bigquery is enabled', async () => {
      await activateExtension();

      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'apputils:notify',
        expect.objectContaining({
          message: 'BigQuery Plugin Successfully Loaded',
          type: 'success'
        })
      );
    });

    it('should execute apputils:notify with Dataproc message on extension load when bigquery is disabled', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            enable_metastore_integration: false
          });
        }
        return Promise.resolve({});
      });

      await activateExtension();

      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'apputils:notify',
        expect.objectContaining({
          message: 'Dataproc Jupyter Plugin Successfully Loaded',
          type: 'success'
        })
      );
    });
  });

  describe('7. LabShell currentChanged and titleChanged lifecycle', () => {
    it('should handle tab switches and title changes for cluster NotebookPanel and stash oldNotebookValue on Launcher switch', async () => {
      await activateExtension();
      expect(currentChangedCallback).toBeDefined();

      const titleChangedConnectMock = jest.fn();
      const titleChangedDisconnectMock = jest.fn();
      const mockNotebookPanel = createMockNotebookPanel(
        'test.ipynb',
        'cluster-kernel',
        titleChangedConnectMock,
        titleChangedDisconnectMock
      );

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockNotebookPanel
      });

      expect(titleChangedConnectMock).toHaveBeenCalled();
      expect(mockNotebookPanel.toolbar.update).toHaveBeenCalled();

      const titleChangedHandler = titleChangedConnectMock.mock.calls[0][0];
      await titleChangedHandler(mockNotebookPanel.title);
      expect(localStorage.getItem('notebookValue')).toBe('c1/clusters');
      expect(document.title).toBe('test.ipynb');

      await currentChangedCallback!(labShellMock, {
        oldValue: mockNotebookPanel,
        newValue: { title: { label: 'Launcher' } }
      });

      expect(titleChangedDisconnectMock).toHaveBeenCalled();
      expect(localStorage.getItem('oldNotebookValue')).toBe('c1/clusters');
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });

    it('should update notebookValue for session kernels and avoid recreating dpmsWidget when session is unchanged', async () => {
      await activateExtension();

      const titleChangedConnectMock = jest.fn();
      const mockSessionPanel = createMockNotebookPanel(
        'session.ipynb',
        'session-kernel',
        titleChangedConnectMock
      );

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockSessionPanel
      });

      const onTitleChanged = titleChangedConnectMock.mock.calls[0][0];
      (dpmsWidget as unknown as jest.Mock).mockClear();

      await onTitleChanged(mockSessionPanel.title);
      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');
      expect(document.title).toBe('session.ipynb');
      expect(dpmsWidget).toHaveBeenCalledTimes(1);

      // Re-triggering with the same sessionValue should not recreate dpmsWidget
      (dpmsWidget as unknown as jest.Mock).mockClear();
      await onTitleChanged(mockSessionPanel.title);
      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');
      expect(dpmsWidget).not.toHaveBeenCalled();
    });

    it('should restore oldNotebookValue when switching from a plugin tab back to a regular widget', async () => {
      await activateExtension();

      const titleChangedConnectMock = jest.fn();
      const mockSessionPanel = createMockNotebookPanel(
        'session.ipynb',
        'session-kernel',
        titleChangedConnectMock
      );

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockSessionPanel
      });
      await titleChangedConnectMock.mock.calls[0][0](mockSessionPanel.title);

      await currentChangedCallback!(labShellMock, {
        oldValue: mockSessionPanel,
        newValue: { title: { label: 'Clusters' } }
      });
      expect(localStorage.getItem('oldNotebookValue')).toBe('kernel/sessions');
      expect(localStorage.getItem('notebookValue')).toBeNull();

      await currentChangedCallback!(labShellMock, {
        oldValue: { title: { label: 'Clusters' } },
        newValue: { title: { label: 'script.py' } }
      });
      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');
    });

    it('should default notebookValue to empty string when switching to a regular widget without oldNotebookValue', async () => {
      await activateExtension();

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: { title: { label: 'README.md' } }
      });

      expect(localStorage.getItem('notebookValue')).toBe('');
    });

    it('should clear notebookValue when NotebookPanel has no active kernel', async () => {
      await activateExtension();

      const titleChangedConnectMock = jest.fn();
      const mockKernelLessPanel = createMockNotebookPanel(
        'idle.ipynb',
        null,
        titleChangedConnectMock
      );

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockKernelLessPanel
      });

      localStorage.setItem('notebookValue', 'c1/clusters');
      const onTitleChanged = titleChangedConnectMock.mock.calls[0][0];
      await onTitleChanged(mockKernelLessPanel.title);

      expect(localStorage.getItem('notebookValue')).toBeNull();
      expect(document.title).toBe('idle.ipynb');
    });

    it('should update document.title without setting notebookValue for unmapped kernels or non-NotebookPanel owners', async () => {
      (KernelSpecAPI.getSpecs as jest.Mock).mockResolvedValueOnce({
        kernelspecs: {
          'no-endpoint-kernel': {
            name: 'no-endpoint-kernel',
            display_name: 'No Endpoint',
            argv: ['python'],
            resources: {},
            metadata: {}
          }
        }
      });

      await activateExtension();

      const titleChangedConnectMock = jest.fn();
      const mockPanel = createMockNotebookPanel(
        'unregistered.ipynb',
        'unregistered-kernel',
        titleChangedConnectMock
      );

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockPanel
      });

      const onTitleChanged = titleChangedConnectMock.mock.calls[0][0];
      (dpmsWidget as unknown as jest.Mock).mockClear();

      // 1. Kernel not in KernelSpecAPI specs
      await onTitleChanged(mockPanel.title);
      expect(document.title).toBe('unregistered.ipynb');
      expect(localStorage.getItem('notebookValue')).toBeNull();
      expect(dpmsWidget).not.toHaveBeenCalled();

      // 2. Kernel spec without endpointParentResource (distinct title so assertion is non-vacuous)
      mockPanel.title.label = 'no-endpoint.ipynb';
      mockPanel.sessionContext = {
        session: { kernel: { name: 'no-endpoint-kernel' } }
      };
      await onTitleChanged(mockPanel.title);
      expect(document.title).toBe('no-endpoint.ipynb');
      expect(localStorage.getItem('notebookValue')).toBeNull();
      expect(dpmsWidget).not.toHaveBeenCalled();

      // 3. Non-NotebookPanel title owner
      await onTitleChanged({ label: 'Plain Tab', owner: {} });
      expect(document.title).toBe('Plain Tab');
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });
  });
});
