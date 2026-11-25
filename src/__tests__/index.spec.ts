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
import { Panel, Widget } from '@lumino/widgets';
import {
  ILabShell,
  JupyterFrontEnd,
  JupyterLab
} from '@jupyterlab/application';
import {
  IThemeManager,
  MainAreaWidget,
  Notification
} from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import {
  IDefaultFileBrowser,
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { KernelAPI, KernelSpecAPI } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import extension from '../index';
import { PLUGIN_ID, TITLE_LAUNCHER_CATEGORY } from '../utils/const';
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
import NotebookTemplateService from '../notebookTemplates/notebookTemplatesService';
import { BigQueryService } from '../bigQuery/bigQueryService';
import { RuntimeService } from '../runtime/runtimeService';
import { authApi, iconDisplay } from '../utils/utils';
import { setupNotificationSystem } from '../notifications';

jest.mock('../cluster/cluster', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    Cluster: jest.fn().mockImplementation(() => new LuminoWidget())
  };
});

jest.mock('../batches/batches', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    Batches: jest.fn().mockImplementation(() => new LuminoWidget())
  };
});

jest.mock('../notebookTemplates/notebookTemplates', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    NotebookTemplates: jest.fn().mockImplementation(() => new LuminoWidget())
  };
});

jest.mock('../login/authLogin', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    AuthLogin: jest.fn().mockImplementation(() => new LuminoWidget())
  };
});

jest.mock('../dpms/dpmsWidget', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  class MockDpmsWidget extends LuminoWidget {}
  const dpmsWidgetMock = jest.fn(() => new MockDpmsWidget());
  // Preserve prototype chain so `widget instanceof dpmsWidget` succeeds in loadDpmsWidget
  dpmsWidgetMock.prototype = MockDpmsWidget.prototype;
  return { dpmsWidget: dpmsWidgetMock };
});

jest.mock('../bigQuery/bigQueryWidget', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    BigQueryWidget: jest.fn().mockImplementation(() => new LuminoWidget())
  };
});

jest.mock('../runtime/runtimeTemplate', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    RuntimeTemplate: jest.fn().mockImplementation(() => new LuminoWidget())
  };
});

jest.mock('../runtimeProfile/createRuntimeProfile', () => {
  const { Widget: LuminoWidget } = require('@lumino/widgets');
  return {
    CreateRuntimeProfile: jest.fn().mockImplementation(() => new LuminoWidget())
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

// Default resolved GCP service URLs satisfy src/utils/const.ts module-load IIFE.
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
  iconDisplay: jest.fn()
}));

jest.mock('../utils/loggingService', () => ({
  ...jest.requireActual('../utils/loggingService'),
  DataprocLoggingService: {
    attach: jest.fn(),
    log: jest.fn()
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

const flushPromises = () =>
  new Promise<void>(resolve => setTimeout(resolve, 0));

const DEFAULT_SETTINGS = {
  enable_bigquery_integration: true,
  enable_metastore_integration: true,
  enable_cloud_storage_integration: true,
  enable_runtime_profile_integration: true
};

const DEFAULT_CREDENTIALS = {
  project_id: 'test-project',
  login_error: false,
  config_error: false
};

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

const SAMPLE_RUNTIME_PROFILE = {
  name: 'projects/test-project/locations/us-central1/sessionTemplates/sample-profile',
  jupyterSession: { displayName: 'sample-profile', kernel: 'PYTHON' }
};

interface IMockRequestApiOverrides {
  settings?: Record<string, unknown>;
  checkResourceManager?:
    | { status: string; error?: string }
    | (() => Promise<unknown>);
  jupyterlabVersion?: string | (() => Promise<unknown>);
  updatePlugin?: Record<string, unknown> | (() => Promise<unknown>);
}

interface IMockNotebookContent {
  cells: Array<{ source?: string[] }>;
}

describe('extension index.ts comprehensive test suite', () => {
  const initialDocumentTitle = document.title;

  let appMock: {
    commands: {
      addCommand: jest.Mock;
      execute: jest.Mock;
    };
    restored: Promise<void>;
    shell: {
      add: jest.Mock;
      activateById: jest.Mock;
      currentWidget: { update: jest.Mock } | null;
    };
    docRegistry: {
      addWidgetExtension: jest.Mock;
    };
    serviceManager: {
      contents: {
        save: jest.Mock;
      };
    };
  };
  let factoryMock: {
    tracker: {
      currentWidget: { model: { path: string } } | null;
    };
  };
  let defaultFileBrowserMock: IDefaultFileBrowser;
  let launcherMock: { add: jest.Mock };
  let mainMenuMock: IMainMenu;
  let labShellMock: {
    currentChanged: { connect: jest.Mock };
  };
  let notebookTrackerMock: INotebookTracker;
  let themeManagerMock: {
    theme: string | null;
    isLight: jest.Mock;
    themeChanged: { connect: jest.Mock };
  };
  let settingRegistryMock: { load: jest.Mock };
  let documentManagerMock: IDocumentManager;

  let commandsMap: Map<string, any>;
  let currentChangedCallback:
    | ((
        sender: unknown,
        args: { oldValue: any; newValue: any }
      ) => Promise<void>)
    | null = null;
  let themeChangedCallback: (() => void) | null = null;
  let resolveRestored: () => void;
  let rejectRestored: (reason?: unknown) => void;
  let registeredEmitterListeners: Array<{
    event: string;
    listener: Parameters<typeof eventEmitter.on>[1];
  }>;
  let registeredWindowListeners: Array<{
    type: string;
    listener: EventListenerOrEventListenerObject;
  }>;

  const configureRequestAPI = (overrides: IMockRequestApiOverrides = {}) => {
    const settingsResponse = overrides.settings ?? DEFAULT_SETTINGS;
    const resourceManagerHandler = overrides.checkResourceManager ?? {
      status: 'OK'
    };
    const versionHandler = overrides.jupyterlabVersion ?? '0.1.0';
    const updatePluginHandler = overrides.updatePlugin ?? {};

    (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint === 'settings') {
        return Promise.resolve(settingsResponse);
      }
      if (endpoint.startsWith('checkResourceManager')) {
        return typeof resourceManagerHandler === 'function'
          ? resourceManagerHandler()
          : Promise.resolve(resourceManagerHandler);
      }
      if (endpoint.startsWith('jupyterlabVersion')) {
        return typeof versionHandler === 'function'
          ? versionHandler()
          : Promise.resolve(versionHandler);
      }
      if (endpoint.startsWith('updatePlugin')) {
        return typeof updatePluginHandler === 'function'
          ? updatePluginHandler()
          : Promise.resolve(updatePluginHandler);
      }
      return Promise.resolve({});
    });
  };

  const activateExtension = (overrides: { launcher?: ILauncher | null } = {}) =>
    extension.activate(
      appMock as unknown as JupyterFrontEnd,
      factoryMock as unknown as IFileBrowserFactory,
      defaultFileBrowserMock,
      ('launcher' in overrides
        ? overrides.launcher
        : (launcherMock as unknown as ILauncher)) as ILauncher,
      mainMenuMock,
      labShellMock as unknown as ILabShell,
      notebookTrackerMock,
      themeManagerMock as unknown as IThemeManager,
      settingRegistryMock as unknown as ISettingRegistry,
      documentManagerMock
    );

  const getLeftSidePanels = () => {
    const leftShellCalls = appMock.shell.add.mock.calls.filter(
      call => call[1] === 'left'
    );
    return {
      bqPanel: leftShellCalls[0]?.[0] as Panel | undefined,
      dpmsPanel: leftShellCalls[1]?.[0] as Panel | undefined
    };
  };

  const getLastOpenedMainTab = () => {
    const calls = appMock.shell.add.mock.calls;
    return calls[calls.length - 1][0] as MainAreaWidget;
  };

  const mockBigQueryDownloadCallback = (
    notebookContent: IMockNotebookContent
  ) => {
    (
      NotebookTemplateService.handleClickService as jest.Mock
    ).mockImplementationOnce(async (template, cb) => {
      await cb(notebookContent, template.url);
    });
  };

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

  const activateNotebookPanel = async (
    label: string,
    kernelName: string | null
  ) => {
    const titleChangedConnect = jest.fn();
    const titleChangedDisconnect = jest.fn();
    const panel = createMockNotebookPanel(
      label,
      kernelName,
      titleChangedConnect,
      titleChangedDisconnect
    );

    await currentChangedCallback!(labShellMock, {
      oldValue: null,
      newValue: panel
    });

    const onTitleChanged = titleChangedConnect.mock.calls[0][0] as (
      title: any
    ) => Promise<void>;

    return {
      panel,
      onTitleChanged,
      titleChangedConnect,
      titleChangedDisconnect
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.title = initialDocumentTitle;
    commandsMap = new Map();
    currentChangedCallback = null;
    themeChangedCallback = null;
    registeredEmitterListeners = [];
    registeredWindowListeners = [];

    const originalEmitterOn = eventEmitter.on.bind(eventEmitter);
    jest.spyOn(eventEmitter, 'on').mockImplementation((event, listener) => {
      registeredEmitterListeners.push({ event, listener });
      originalEmitterOn(event, listener);
    });

    const originalAddEventListener = window.addEventListener.bind(window);
    jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'beforeunload' || type === 'load') {
          registeredWindowListeners.push({ type, listener });
        }
        originalAddEventListener(type, listener, options);
      });

    (authApi as jest.Mock).mockResolvedValue(DEFAULT_CREDENTIALS);
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

    configureRequestAPI();

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
        activateById: jest.fn(),
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

    defaultFileBrowserMock = {} as IDefaultFileBrowser;
    launcherMock = { add: jest.fn() };
    mainMenuMock = {} as IMainMenu;

    labShellMock = {
      currentChanged: {
        connect: jest.fn(cb => {
          currentChangedCallback = cb;
        })
      }
    };

    notebookTrackerMock = {} as INotebookTracker;

    themeManagerMock = {
      theme: 'JupyterLab Light',
      isLight: jest.fn().mockReturnValue(true),
      themeChanged: {
        connect: jest.fn(cb => {
          themeChangedCallback = cb;
        })
      }
    };

    settingRegistryMock = {
      load: jest.fn().mockResolvedValue({
        get: jest.fn().mockReturnValue({ composite: 'us-central1' })
      })
    };

    documentManagerMock = {} as IDocumentManager;
  });

  afterEach(() => {
    registeredEmitterListeners.splice(0).forEach(({ event, listener }) => {
      eventEmitter.off(event, listener);
    });
    registeredWindowListeners.splice(0).forEach(({ type, listener }) => {
      window.removeEventListener(type, listener);
    });
    document.title = initialDocumentTitle;
    jest.restoreAllMocks();
  });

  describe('1. Plugin metadata and initial activation sequence', () => {
    it('should export plugin metadata with PLUGIN_ID, autoStart, and optional dependencies', () => {
      expect(extension.id).toBe(PLUGIN_ID);
      expect(extension.autoStart).toBe(true);
      expect(Array.isArray(extension.optional)).toBe(true);
    });

    it('should attach DataprocLoggingService on activation', async () => {
      await activateExtension();

      expect(DataprocLoggingService.attach).toHaveBeenCalledTimes(1);
    });

    it('should register NotebookButtonExtension on the Notebook document registry', async () => {
      await activateExtension();

      expect(appMock.docRegistry.addWidgetExtension).toHaveBeenCalledWith(
        'Notebook',
        expect.any(NotebookButtonExtension)
      );
    });

    it('should initialize notification system with app on activation', async () => {
      await activateExtension();

      expect(setupNotificationSystem).toHaveBeenCalledWith(appMock);
    });

    it('should remove notebookValue from localStorage on window beforeunload', async () => {
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

    it('should log an error when app.restored rejects', async () => {
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
    it('should add BigQuery Dataset Explorer side panel at rank 1000 when enabled', async () => {
      await activateExtension();

      expect(BigQueryWidget).toHaveBeenCalledWith(
        appMock as unknown as JupyterLab,
        settingRegistryMock,
        true,
        themeManagerMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(Panel),
        'left',
        { rank: 1000 }
      );
    });

    it('should add DPMS side panel at rank 1001 when enabled', async () => {
      await activateExtension();

      expect(dpmsWidget).toHaveBeenCalledWith(
        appMock as unknown as JupyterLab,
        themeManagerMock
      );
      expect(appMock.shell.add).toHaveBeenCalledWith(
        expect.any(Panel),
        'left',
        { rank: 1001 }
      );
    });

    it('should coerce string feature flags ("true" and "1") to enable side panels', async () => {
      configureRequestAPI({
        settings: {
          enable_bigquery_integration: 'true',
          enable_metastore_integration: '1'
        }
      });

      await activateExtension();

      expect(BigQueryWidget).toHaveBeenCalled();
      expect(dpmsWidget).toHaveBeenCalledTimes(1);
    });

    it('should not initialize side panels when feature flags are falsy string ("false") or undefined', async () => {
      localStorage.setItem('notebookValue', 'existing-c1/clusters');
      configureRequestAPI({
        settings: {
          enable_bigquery_integration: 'false',
          enable_metastore_integration: undefined
        }
      });

      await activateExtension();

      expect(BigQueryWidget).not.toHaveBeenCalled();
      expect(dpmsWidget).not.toHaveBeenCalled();
      expect(appMock.shell.add).not.toHaveBeenCalledWith(
        expect.any(Panel),
        'left',
        expect.anything()
      );
    });

    it('should early-return from theme change handler when no side panels are initialized', async () => {
      configureRequestAPI({
        settings: {
          enable_bigquery_integration: false,
          enable_metastore_integration: false
        }
      });

      await activateExtension();

      themeManagerMock.isLight.mockClear();
      themeChangedCallback!();
      expect(themeManagerMock.isLight).not.toHaveBeenCalled();
    });

    it('should reload DPMS widget and dispose previous dpmsWidget when notebookValue is preset in localStorage', async () => {
      localStorage.setItem('notebookValue', 'existing-c1/clusters');

      await activateExtension();

      const dpmsMock = dpmsWidget as unknown as jest.Mock;
      expect(dpmsMock).toHaveBeenCalledTimes(2);
      const firstInstance = dpmsMock.mock.results[0].value as Widget;
      const secondInstance = dpmsMock.mock.results[1].value as Widget;
      expect(firstInstance.isDisposed).toBe(true);
      expect(secondInstance.isDisposed).toBe(false);
    });

    it('should apply dark side panel icons when switching to a dark theme', async () => {
      await activateExtension();
      const { bqPanel, dpmsPanel } = getLeftSidePanels();

      themeManagerMock.isLight.mockReturnValue(false);
      themeChangedCallback!();

      expect((bqPanel?.title.icon as any).name).toBe(
        'launcher:dataset-explorer-icon-dark'
      );
      expect((dpmsPanel?.title.icon as any).name).toBe(
        'launcher:dpms-icon-dark'
      );
    });

    it('should apply light side panel icons when switching to a light theme', async () => {
      await activateExtension();
      const { bqPanel, dpmsPanel } = getLeftSidePanels();

      themeManagerMock.isLight.mockReturnValue(false);
      themeChangedCallback!();

      themeManagerMock.isLight.mockReturnValue(true);
      themeChangedCallback!();

      expect((bqPanel?.title.icon as any).name).toBe(
        'launcher:dataset-explorer-icon'
      );
      expect((dpmsPanel?.title.icon as any).name).toBe('launcher:dpms-icon');
    });

    it('should default to light side panel icons without calling isLight when theme is null', async () => {
      await activateExtension();
      const { bqPanel, dpmsPanel } = getLeftSidePanels();

      themeManagerMock.isLight.mockReturnValue(false);
      themeChangedCallback!();
      expect((dpmsPanel?.title.icon as any).name).toBe(
        'launcher:dpms-icon-dark'
      );

      themeManagerMock.theme = null;
      themeManagerMock.isLight.mockClear();
      themeChangedCallback!();

      expect(themeManagerMock.isLight).not.toHaveBeenCalled();
      expect((bqPanel?.title.icon as any).name).toBe(
        'launcher:dataset-explorer-icon'
      );
      expect((dpmsPanel?.title.icon as any).name).toBe('launcher:dpms-icon');
    });
  });

  describe('3. Event emitter signal handlers and API enablement checks', () => {
    it('should re-check APIs and Resource Manager on dataprocConfigChange signal', async () => {
      await activateExtension();
      (requestAPI as jest.Mock).mockClear();

      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(RuntimeService.checkDataprocApiEnabledService).toHaveBeenCalled();
      expect(
        BigQueryService.checkBigQueryDatasetsAPIService
      ).toHaveBeenCalled();
      expect(requestAPI).toHaveBeenCalledWith('checkResourceManager', {
        method: 'POST'
      });
    });

    it('should reload BigQuery and DPMS side panels on dataprocConfigChange signal', async () => {
      await activateExtension();
      (BigQueryWidget as unknown as jest.Mock).mockClear();
      (dpmsWidget as unknown as jest.Mock).mockClear();

      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(BigQueryWidget).toHaveBeenCalled();
      expect(dpmsWidget).toHaveBeenCalled();
    });

    it('should notify error and open Dataproc API library link when Cloud Dataproc API is disabled', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      await activateExtension();

      (
        RuntimeService.checkDataprocApiEnabledService as jest.Mock
      ).mockResolvedValueOnce({ is_enabled: false });

      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        'The Cloud Dataproc API is not enabled.',
        expect.objectContaining({ autoClose: 5000 })
      );

      const options = (Notification.error as jest.Mock).mock.calls[0][1];
      options.actions[0].callback();

      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/dataproc.googleapis.com?project=test-project',
        '_blank'
      );
    });

    it('should notify error and open BigQuery API library link when BigQuery API is disabled', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      await activateExtension();

      (
        BigQueryService.checkBigQueryDatasetsAPIService as jest.Mock
      ).mockResolvedValueOnce({ is_enabled: false });

      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        'The BigQuery API is not enabled.',
        expect.objectContaining({ autoClose: 5000 })
      );

      const options = (Notification.error as jest.Mock).mock.calls[0][1];
      options.actions[0].callback();

      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/bigquery.googleapis.com?project=test-project',
        '_blank'
      );
    });

    it('should skip BigQuery API check when enable_bigquery_integration is false', async () => {
      configureRequestAPI({
        settings: {
          enable_bigquery_integration: false,
          enable_metastore_integration: false
        }
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

    it('should skip Dataproc and BigQuery API checks when authApi returns config_error', async () => {
      await activateExtension();

      (authApi as jest.Mock).mockResolvedValueOnce({
        login_error: false,
        config_error: true
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
    it('should notify error when Cloud Resource Manager API is not enabled', async () => {
      configureRequestAPI({
        settings: {
          enable_bigquery_integration: false,
          enable_metastore_integration: false
        },
        checkResourceManager: {
          status: 'ERROR',
          error:
            'API [cloudresourcemanager.googleapis.com] not enabled on project'
        }
      });

      await activateExtension();

      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Cloud Resource Manager API is not enabled'),
        expect.objectContaining({ autoClose: false })
      );
    });

    it('should open Cloud Resource Manager API library link when Enable action is clicked', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      configureRequestAPI({
        settings: {},
        checkResourceManager: {
          status: 'ERROR',
          error:
            'API [cloudresourcemanager.googleapis.com] not enabled on project'
        }
      });

      await activateExtension();

      const actions = (Notification.error as jest.Mock).mock.calls[0][1]
        .actions;
      actions[0].callback();

      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com?project=test-project',
        '_blank'
      );
    });

    it('should notify generic error message for other Resource Manager API errors', async () => {
      configureRequestAPI({
        settings: {},
        checkResourceManager: {
          status: 'ERROR',
          error: 'Permission denied on resource'
        }
      });

      await activateExtension();

      expect(Notification.error).toHaveBeenCalledWith(
        'Error calling into the Resource Manager API: Permission denied on resource',
        { autoClose: false }
      );
    });

    it('should notify generic error when Resource Manager returns status ERROR without error details and credentials are undefined', async () => {
      (authApi as jest.Mock).mockResolvedValueOnce(undefined);
      configureRequestAPI({
        settings: {},
        checkResourceManager: { status: 'ERROR' }
      });

      await activateExtension();

      expect(Notification.error).toHaveBeenCalledWith(
        'Error calling into the Resource Manager API: undefined',
        { autoClose: false }
      );
    });

    it('should skip Resource Manager error notification when authApi returns login_error', async () => {
      (authApi as jest.Mock).mockResolvedValueOnce({
        login_error: true,
        config_error: false
      });
      configureRequestAPI({
        settings: {},
        checkResourceManager: {
          status: 'ERROR',
          error:
            'API [cloudresourcemanager.googleapis.com] not enabled on project'
        }
      });

      await activateExtension();

      expect(Notification.error).not.toHaveBeenCalled();
    });

    it('should skip Resource Manager error notification when authApi returns config_error', async () => {
      (authApi as jest.Mock).mockResolvedValueOnce({
        login_error: false,
        config_error: true
      });
      configureRequestAPI({
        settings: {},
        checkResourceManager: {
          status: 'ERROR',
          error:
            'API [cloudresourcemanager.googleapis.com] not enabled on project'
        }
      });

      await activateExtension();

      expect(Notification.error).not.toHaveBeenCalled();
    });

    it('should log error and not throw when checkResourceManager request rejects', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const networkError = new Error('network failure');
      configureRequestAPI({
        settings: {},
        checkResourceManager: () => Promise.reject(networkError)
      });

      await activateExtension();

      expect(errorSpy).toHaveBeenCalledWith(
        'Resource manager Api not enabled:',
        networkError
      );
    });

    it('should not prompt for update when installed JupyterLab plugin version is up to date', async () => {
      configureRequestAPI({
        settings: {},
        jupyterlabVersion: '0.1.0'
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      expect(Notification.info).not.toHaveBeenCalled();
    });

    it('should prompt for update when a newer JupyterLab plugin version is available', async () => {
      configureRequestAPI({
        settings: {},
        jupyterlabVersion: '99.0.0'
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      expect(Notification.info).toHaveBeenCalledWith(
        'There is a new version of Dataproc extension available. Would you like to update the extension?',
        expect.objectContaining({ autoClose: false })
      );
    });

    it('should show warning notification when user clicks Ignore on update prompt', async () => {
      configureRequestAPI({
        settings: {},
        jupyterlabVersion: '99.0.0'
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

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

      configureRequestAPI({
        settings: {},
        jupyterlabVersion: '99.0.0'
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
      const updateError = new Error('pip install failed');

      configureRequestAPI({
        settings: {},
        jupyterlabVersion: '99.0.0',
        updatePlugin: () => Promise.reject(updateError)
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
        `Update failed.${updateError}`
      );
    });

    it('should notify error and log failure when fetching JupyterLab version fails', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const versionError = new Error('version endpoint error');

      configureRequestAPI({
        settings: {},
        jupyterlabVersion: () => Promise.reject(versionError)
      });

      await activateExtension();
      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        `Failed to fetch JupyterLab version:${versionError}`
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
      expect(getLastOpenedMainTab().title.label).toBe('Create Runtime Profile');
    });

    it('should open create-runtime-profile-component in edit mode when mode is edit', () => {
      const command = commandsMap.get('create-runtime-profile-component');

      command.execute({ mode: 'edit', profile: SAMPLE_RUNTIME_PROFILE });

      expect(CreateRuntimeProfile).toHaveBeenLastCalledWith(
        appMock,
        launcherMock,
        themeManagerMock,
        settingRegistryMock,
        SAMPLE_RUNTIME_PROFILE
      );
      expect(getLastOpenedMainTab().title.label).toBe('Edit Runtime Profile');
    });

    it('should open create-runtime-profile-component in create mode when profile is passed without edit mode', () => {
      const command = commandsMap.get('create-runtime-profile-component');

      command.execute({ profile: SAMPLE_RUNTIME_PROFILE });

      expect(CreateRuntimeProfile).toHaveBeenLastCalledWith(
        appMock,
        launcherMock,
        themeManagerMock,
        settingRegistryMock,
        undefined
      );
      expect(getLastOpenedMainTab().title.label).toBe('Create Runtime Profile');
    });

    it('should activate existing edit tab instead of opening a duplicate for the same profile', () => {
      const command = commandsMap.get('create-runtime-profile-component');
      const addsBefore = appMock.shell.add.mock.calls.length;

      command.execute({ mode: 'edit', profile: SAMPLE_RUNTIME_PROFILE });
      const editWidget = appMock.shell.add.mock.calls[addsBefore][0];

      command.execute({ mode: 'edit', profile: { ...SAMPLE_RUNTIME_PROFILE } });

      expect(appMock.shell.add).toHaveBeenCalledTimes(addsBefore + 1);
      expect(appMock.shell.activateById).toHaveBeenCalledWith(editWidget.id);
    });

    it('should open a separate edit tab for a different runtime profile', () => {
      const command = commandsMap.get('create-runtime-profile-component');
      const addsBefore = appMock.shell.add.mock.calls.length;

      command.execute({ mode: 'edit', profile: SAMPLE_RUNTIME_PROFILE });
      command.execute({
        mode: 'edit',
        profile: {
          ...SAMPLE_RUNTIME_PROFILE,
          name: `${SAMPLE_RUNTIME_PROFILE.name}-2`
        }
      });

      expect(appMock.shell.add).toHaveBeenCalledTimes(addsBefore + 2);
    });

    it('should open a new edit tab after a previously opened edit tab is disposed', () => {
      const command = commandsMap.get('create-runtime-profile-component');
      const addsBefore = appMock.shell.add.mock.calls.length;

      command.execute({ mode: 'edit', profile: SAMPLE_RUNTIME_PROFILE });
      const editWidget = appMock.shell.add.mock.calls[addsBefore][0];
      editWidget.dispose();

      command.execute({ mode: 'edit', profile: SAMPLE_RUNTIME_PROFILE });

      expect(appMock.shell.add).toHaveBeenCalledTimes(addsBefore + 2);
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
      const notebookContent: IMockNotebookContent = {
        cells: [{}, {}, { source: ['# Config\n', '', ''] }]
      };
      mockBigQueryDownloadCallback(notebookContent);

      await command.execute();

      const expectedPath = `workspace/path${path.sep}bigframes_quickstart.ipynb`;
      expect(notebookContent.cells[2].source?.[1]).toBe(
        "PROJECT_ID = 'test-project' \n"
      );
      expect(notebookContent.cells[2].source?.[2]).toBe(
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
      expect(appMock.shell.currentWidget?.update).toHaveBeenCalled();
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        path: expectedPath
      });
    });

    it('should download BigQuery notebook to root directory when file browser path starts with gs:', async () => {
      const command = commandsMap.get('create-bigquery-notebook-component');
      factoryMock.tracker.currentWidget = {
        model: { path: 'gs://my-bucket/notebooks' }
      };
      const notebookContent: IMockNotebookContent = {
        cells: [{}, {}, { source: ['# Config\n', '', ''] }]
      };
      mockBigQueryDownloadCallback(notebookContent);

      await command.execute();

      const expectedPath = `${path.sep}bigframes_quickstart.ipynb`;
      expect(appMock.serviceManager.contents.save).toHaveBeenCalledWith(
        expectedPath,
        expect.objectContaining({ type: 'file', format: 'text' })
      );
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        path: expectedPath
      });
    });

    it('should skip PROJECT_ID and REGION injection when authApi returns null during notebook download', async () => {
      const command = commandsMap.get('create-bigquery-notebook-component');
      appMock.shell.currentWidget = null;
      (authApi as jest.Mock).mockResolvedValueOnce(null);

      const notebookContent: IMockNotebookContent = {
        cells: [
          {},
          {},
          { source: ['', 'unchanged-project', 'unchanged-region'] }
        ]
      };
      mockBigQueryDownloadCallback(notebookContent);

      await command.execute();

      expect(notebookContent.cells[2].source?.[1]).toBe('unchanged-project');
      expect(notebookContent.cells[2].source?.[2]).toBe('unchanged-region');
      expect(appMock.serviceManager.contents.save).toHaveBeenCalledWith(
        `workspace/path${path.sep}bigframes_quickstart.ipynb`,
        expect.objectContaining({ type: 'file', format: 'text' })
      );
    });

    it('should log error and abort download when no active file browser widget exists', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const command = commandsMap.get('create-bigquery-notebook-component');
      factoryMock.tracker.currentWidget = null;
      mockBigQueryDownloadCallback({
        cells: [{}, {}, { source: ['', '', ''] }]
      });

      await command.execute();

      expect(errorSpy).toHaveBeenCalledWith(
        'No active file browser widget found.'
      );
      expect(appMock.serviceManager.contents.save).not.toHaveBeenCalled();
    });

    it.each([
      'create-runtime-template-component',
      'create-runtime-profile-component',
      'create-cluster-component',
      'create-batches-component',
      'create-template-component'
    ])(
      'should return null icon in command palette and a valid icon otherwise for %s',
      commandId => {
        const command = commandsMap.get(commandId);
        expect(command.icon({ isPalette: true })).toBeNull();
        expect(command.icon({ isPalette: false })).toBeDefined();
      }
    );
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

    it('should register serverless and cluster notebook kernel commands in launcher', async () => {
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
    });

    it('should resolve icon for dynamic serverless kernel command via iconDisplay', async () => {
      await activateExtension();

      const sessionKernelCmd = commandsMap.get(
        'notebook:create-session-kernel'
      );
      expect(sessionKernelCmd.icon()).toBeDefined();
      expect(iconDisplay).toHaveBeenCalledWith(
        DEFAULT_KERNEL_SPECS.kernelspecs['session-kernel'],
        themeManagerMock
      );
    });

    it('should execute dynamic serverless notebook kernel command to create and open a notebook', async () => {
      await activateExtension();

      const sessionKernelCmd = commandsMap.get(
        'notebook:create-session-kernel'
      );
      await sessionKernelCmd.execute();

      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'docmanager:new-untitled',
        {
          type: 'notebook',
          path: '',
          kernel: { name: 'session-kernel' }
        }
      );
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        kernel: { name: 'session-kernel' },
        path: 'test-doc-path',
        factory: 'notebook'
      });
    });

    it('should resolve icon for dynamic cluster kernel command via iconDisplay', async () => {
      await activateExtension();

      const clusterKernelCmd = commandsMap.get(
        'notebook:create-cluster-kernel'
      );
      expect(clusterKernelCmd.icon()).toBeDefined();
      expect(iconDisplay).toHaveBeenCalledWith(
        DEFAULT_KERNEL_SPECS.kernelspecs['cluster-kernel'],
        themeManagerMock
      );
    });

    it('should execute dynamic cluster notebook kernel command to create and open a notebook', async () => {
      await activateExtension();

      const clusterKernelCmd = commandsMap.get(
        'notebook:create-cluster-kernel'
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

    it('should add create-runtime-profile-component to launcher when runtime profile is enabled', async () => {
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
    });

    it('should add create-runtime-template-component to launcher when runtime profile is disabled', async () => {
      configureRequestAPI({
        settings: {
          ...DEFAULT_SETTINGS,
          enable_runtime_profile_integration: false
        }
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

    it.each([
      ['create-cluster-component', 1],
      ['create-batches-component', 2],
      ['create-template-component', 3]
    ])(
      'should add static %s card to launcher at rank %i',
      async (command, rank) => {
        await activateExtension();

        expect(launcherMock.add).toHaveBeenCalledWith({
          command,
          category: TITLE_LAUNCHER_CATEGORY,
          rank
        });
      }
    );

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
      configureRequestAPI({
        settings: {
          enable_bigquery_integration: false,
          enable_metastore_integration: false
        }
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
    it('should connect title listener and update toolbar when switching to a NotebookPanel', async () => {
      await activateExtension();
      expect(currentChangedCallback).toBeDefined();

      const { panel, titleChangedConnect } = await activateNotebookPanel(
        'test.ipynb',
        'cluster-kernel'
      );

      expect(titleChangedConnect).toHaveBeenCalledTimes(1);
      expect(panel.toolbar.update).toHaveBeenCalledTimes(1);
    });

    it('should update notebookValue and document.title for a cluster kernel notebook', async () => {
      await activateExtension();
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'test.ipynb',
        'cluster-kernel'
      );

      await onTitleChanged(panel.title);

      expect(localStorage.getItem('notebookValue')).toBe('c1/clusters');
      expect(document.title).toBe('test.ipynb');
    });

    it('should disconnect title listener and stash oldNotebookValue when switching from a notebook to Launcher', async () => {
      await activateExtension();
      const { panel, onTitleChanged, titleChangedDisconnect } =
        await activateNotebookPanel('test.ipynb', 'cluster-kernel');
      await onTitleChanged(panel.title);

      await currentChangedCallback!(labShellMock, {
        oldValue: panel,
        newValue: { title: { label: 'Launcher' } }
      });

      expect(titleChangedDisconnect).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('oldNotebookValue')).toBe('c1/clusters');
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });

    it('should update notebookValue and reload dpmsWidget for a session kernel notebook', async () => {
      await activateExtension();
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'session.ipynb',
        'session-kernel'
      );
      (dpmsWidget as unknown as jest.Mock).mockClear();

      await onTitleChanged(panel.title);

      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');
      expect(document.title).toBe('session.ipynb');
      expect(dpmsWidget).toHaveBeenCalledTimes(1);
    });

    it('should not recreate dpmsWidget when session kernel notebookValue is unchanged', async () => {
      await activateExtension();
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'session.ipynb',
        'session-kernel'
      );
      await onTitleChanged(panel.title);

      (dpmsWidget as unknown as jest.Mock).mockClear();
      await onTitleChanged(panel.title);

      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');
      expect(dpmsWidget).not.toHaveBeenCalled();
    });

    it('should restore oldNotebookValue when switching from a plugin tab back to a regular widget', async () => {
      await activateExtension();
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'session.ipynb',
        'session-kernel'
      );
      await onTitleChanged(panel.title);

      await currentChangedCallback!(labShellMock, {
        oldValue: panel,
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
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'idle.ipynb',
        null
      );

      localStorage.setItem('notebookValue', 'c1/clusters');
      await onTitleChanged(panel.title);

      expect(localStorage.getItem('notebookValue')).toBeNull();
      expect(document.title).toBe('idle.ipynb');
    });

    it('should update document.title without setting notebookValue when kernel is not in kernel specs', async () => {
      await activateExtension();
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'unregistered.ipynb',
        'unregistered-kernel'
      );
      (dpmsWidget as unknown as jest.Mock).mockClear();

      await onTitleChanged(panel.title);

      expect(document.title).toBe('unregistered.ipynb');
      expect(localStorage.getItem('notebookValue')).toBeNull();
      expect(dpmsWidget).not.toHaveBeenCalled();
    });

    it('should update document.title without setting notebookValue when kernel spec lacks endpointParentResource', async () => {
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
      const { panel, onTitleChanged } = await activateNotebookPanel(
        'no-endpoint.ipynb',
        'no-endpoint-kernel'
      );
      (dpmsWidget as unknown as jest.Mock).mockClear();

      await onTitleChanged(panel.title);

      expect(document.title).toBe('no-endpoint.ipynb');
      expect(localStorage.getItem('notebookValue')).toBeNull();
      expect(dpmsWidget).not.toHaveBeenCalled();
    });

    it('should update document.title without modifying notebookValue for non-NotebookPanel title owners', async () => {
      await activateExtension();
      const { onTitleChanged } = await activateNotebookPanel(
        'test.ipynb',
        'cluster-kernel'
      );

      await onTitleChanged({ label: 'Plain Tab', owner: {} });

      expect(document.title).toBe('Plain Tab');
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });
  });
});
