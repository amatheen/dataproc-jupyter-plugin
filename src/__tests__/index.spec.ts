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

import { Panel } from '@lumino/widgets';
import { NotebookPanel } from '@jupyterlab/notebook';

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
  const dpmsWidget = jest.fn().mockImplementation(() => {
    const widget = new Widget();
    Object.setPrototypeOf(widget, dpmsWidget.prototype);
    return widget;
  });
  Object.setPrototypeOf(dpmsWidget.prototype, Widget.prototype);
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

jest.mock('../controls/NotebookButtonExtension', () => {
  return {
    NotebookButtonExtension: class MockNotebookButtonExtension {}
  };
});

jest.mock('../bigQuery/bigQueryService', () => ({
  BigQueryService: {
    checkBigQueryDatasetsAPIService: jest
      .fn()
      .mockResolvedValue({ is_enabled: true })
  }
}));

jest.mock('../runtime/runtimeService', () => ({
  RuntimeService: {
    checkDataprocApiEnabledService: jest
      .fn()
      .mockResolvedValue({ is_enabled: true })
  }
}));

jest.mock('../notebookTemplates/notebookTemplatesService', () => ({
  handleClickService: jest.fn()
}));

jest.mock('../handler/handler', () => ({
  requestAPI: jest.fn().mockResolvedValue({
    dataproc_url: 'https://dataproc.googleapis.com',
    compute_url: 'https://compute.googleapis.com',
    metastore_url: 'https://metastore.googleapis.com',
    cloudkms_url: 'https://cloudkms.googleapis.com',
    cloudresourcemanager_url: 'https://cloudresourcemanager.googleapis.com',
    datacatalog_url: 'https://datacatalog.googleapis.com',
    storage_url: 'https://storage.googleapis.com'
  })
}));

jest.mock('../utils/utils', () => ({
  authApi: jest.fn().mockResolvedValue({
    project_id: 'test-project',
    login_error: false,
    config_error: false
  }),
  iconDisplay: jest.fn().mockReturnValue({})
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

jest.mock('@jupyterlab/services', () => ({
  KernelAPI: {
    listRunning: jest.fn().mockResolvedValue([])
  },
  KernelSpecAPI: {
    getSpecs: jest.fn().mockResolvedValue({
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
    })
  }
}));

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
import { KernelSpecAPI } from '@jupyterlab/services';

describe('extension index.ts comprehensive test suite', () => {
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
  let launcherItems: any[];
  let currentChangedCallback:
    | ((sender: any, args: any) => Promise<void>)
    | null = null;
  let themeChangedCallback: (() => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (eventEmitter as any).events = {};
    commandsMap = new Map();
    launcherItems = [];
    currentChangedCallback = null;
    themeChangedCallback = null;

    (requestAPI as jest.Mock).mockImplementation(
      (endpoint: string, init?: any) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            enable_metastore_integration: true,
            enable_cloud_storage_integration: true,
            enable_runtime_profile_integration: true
          });
        }
        if (endpoint === 'getGcpServiceUrls') {
          return Promise.resolve({
            dataproc_url: 'https://dataproc.googleapis.com',
            compute_url: 'https://compute.googleapis.com',
            metastore_url: 'https://metastore.googleapis.com',
            cloudkms_url: 'https://cloudkms.googleapis.com',
            cloudresourcemanager_url:
              'https://cloudresourcemanager.googleapis.com',
            datacatalog_url: 'https://datacatalog.googleapis.com',
            storage_url: 'https://storage.googleapis.com'
          });
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
      }
    );

    appMock = {
      commands: {
        addCommand: jest.fn((id: string, options: any) => {
          commandsMap.set(id, options);
          return { dispose: jest.fn() };
        }),
        execute: jest.fn().mockResolvedValue({ path: 'test-doc-path' })
      },
      restored: Promise.resolve(),
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
      add: jest.fn((item: any) => {
        launcherItems.push(item);
      })
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

  describe('1. Plugin metadata and initial activation sequence', () => {
    it('should have correct plugin properties', () => {
      expect(extension.id).toBe(PLUGIN_ID);
      expect(extension.autoStart).toBe(true);
      expect(Array.isArray(extension.optional)).toBe(true);
    });

    it('should attach DataprocLoggingService and register notebook widget extension', async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(DataprocLoggingService.attach).toHaveBeenCalled();
      expect(appMock.docRegistry.addWidgetExtension).toHaveBeenCalledWith(
        'Notebook',
        expect.any(NotebookButtonExtension)
      );
    });

    it('should handle window beforeunload event by removing notebookValue from localStorage', async () => {
      localStorage.setItem('notebookValue', 'test-cluster');

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      window.dispatchEvent(new Event('beforeunload'));
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });
  });

  describe('2. Side panels initialization and theme switching', () => {
    it('should initialize BigQuery and DPMS side panels when enabled in settings', async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

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

    it('should update side panel icons on theme change', async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(themeChangedCallback).toBeDefined();

      // Trigger dark theme
      themeManagerMock.isLight.mockReturnValue(false);
      themeChangedCallback!();

      // Trigger light theme
      themeManagerMock.isLight.mockReturnValue(true);
      themeChangedCallback!();
    });
  });

  describe('3. Event emitter signal handlers', () => {
    it('should respond to dataprocConfigChange signal', async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      eventEmitter.emit('dataprocConfigChange', 'config updated');
    });
  });

  describe('4. Resource Manager and JupyterLab version checks', () => {
    it('should notify error if resource manager API returns error', async () => {
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: false,
            enable_metastore_integration: false
          });
        }
        if (endpoint === 'getGcpServiceUrls') {
          return Promise.resolve({
            dataproc_url: 'https://dataproc.googleapis.com',
            compute_url: 'https://compute.googleapis.com',
            metastore_url: 'https://metastore.googleapis.com',
            cloudkms_url: 'https://cloudkms.googleapis.com',
            cloudresourcemanager_url:
              'https://cloudresourcemanager.googleapis.com',
            datacatalog_url: 'https://datacatalog.googleapis.com',
            storage_url: 'https://storage.googleapis.com'
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({
            status: 'ERROR',
            error:
              'API [cloudresourcemanager.googleapis.com] not enabled on project'
          });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.resolve('0.1.0');
        }
        return Promise.resolve({
          dataproc_url: 'https://dataproc.googleapis.com',
          compute_url: 'https://compute.googleapis.com',
          metastore_url: 'https://metastore.googleapis.com',
          cloudkms_url: 'https://cloudkms.googleapis.com',
          cloudresourcemanager_url:
            'https://cloudresourcemanager.googleapis.com',
          datacatalog_url: 'https://datacatalog.googleapis.com',
          storage_url: 'https://storage.googleapis.com'
        });
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Cloud Resource Manager API is not enabled'),
        expect.any(Object)
      );
    });
  });

  describe('5. Component Commands Registration & Execution', () => {
    beforeEach(async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );
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
    beforeEach(async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );
    });

    it('should add BigQuery Notebooks launcher entry when bigquery is enabled', () => {
      expect(launcherMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'create-bigquery-notebook-component',
          category: 'BigQuery Notebooks',
          rank: 1
        })
      );
    });

    it('should add serverless and cluster notebook kernel commands to launcher', async () => {
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

      // Test executing dynamic notebook creation command
      const sessionKernelCmd = commandsMap.get(
        'notebook:create-session-kernel'
      );
      expect(sessionKernelCmd).toBeDefined();
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

    it('should add static commands to launcher with correct categories and ranks', () => {
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
      launcherMock.add.mockClear();
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

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

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

    it('should execute apputils:notify on extension load', () => {
      expect(appMock.commands.execute).toHaveBeenCalledWith(
        'apputils:notify',
        expect.objectContaining({
          message: 'BigQuery Plugin Successfully Loaded',
          type: 'success'
        })
      );
    });
  });

  describe('7. LabShell currentChanged and titleChanged lifecycle', () => {
    it('should handle tab switches and title changes for NotebookPanel', async () => {
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(currentChangedCallback).toBeDefined();

      const titleChangedConnectMock = jest.fn();
      const titleChangedDisconnectMock = jest.fn();

      const mockNotebookPanel = Object.create(NotebookPanel.prototype, {
        title: {
          value: {
            label: 'test.ipynb',
            owner: null,
            changed: {
              connect: titleChangedConnectMock,
              disconnect: titleChangedDisconnectMock
            }
          }
        },
        toolbar: {
          value: {
            update: jest.fn()
          }
        },
        sessionContext: {
          value: {
            session: {
              kernel: {
                name: 'cluster-kernel'
              }
            }
          }
        }
      });
      mockNotebookPanel.title.owner = mockNotebookPanel;

      // Simulate tab switch to NotebookPanel
      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockNotebookPanel
      });

      expect(titleChangedConnectMock).toHaveBeenCalled();
      expect(mockNotebookPanel.toolbar.update).toHaveBeenCalled();

      // Trigger title changed handler
      const titleChangedHandler = titleChangedConnectMock.mock.calls[0][0];
      await titleChangedHandler(mockNotebookPanel.title);
      expect(localStorage.getItem('notebookValue')).toBe('c1/clusters');

      // Simulate tab switch to Launcher widget
      const mockLauncherWidget: any = {
        title: { label: 'Launcher' }
      };
      await currentChangedCallback!(labShellMock, {
        oldValue: mockNotebookPanel,
        newValue: mockLauncherWidget
      });

      expect(titleChangedDisconnectMock).toHaveBeenCalled();
      expect(localStorage.getItem('oldNotebookValue')).toBe('c1/clusters');
      expect(localStorage.getItem('notebookValue')).toBeNull();
    });
  });

  describe('8. App restoration, API enablement checks, and JupyterLab version updates', () => {
    const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

    it('should run executeApiChecks after app.restored resolves when document is ready', async () => {
      let resolveRestored!: () => void;
      appMock.restored = new Promise<void>(resolve => {
        resolveRestored = resolve;
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

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
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        document,
        'readyState'
      );
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => 'loading'
      });

      try {
        let resolveRestored!: () => void;
        appMock.restored = new Promise<void>(resolve => {
          resolveRestored = resolve;
        });

        await (extension.activate as any)(
          appMock,
          factoryMock,
          defaultFileBrowserMock,
          launcherMock,
          mainMenuMock,
          labShellMock,
          notebookTrackerMock,
          themeManagerMock,
          settingRegistryMock,
          documentManagerMock
        );

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
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(document, 'readyState', originalDescriptor);
        } else {
          Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => 'complete'
          });
        }
      }
    });

    it('should log error when app.restored rejects', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      appMock.restored = Promise.reject(new Error('restoration failed'));

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      await flushPromises();

      expect(errorSpy).toHaveBeenCalledWith(
        'Error during app restoration:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });

    it('should notify and open enable links when Dataproc or BigQuery APIs are disabled', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      let resolveRestored!: () => void;
      appMock.restored = new Promise<void>(resolve => {
        resolveRestored = resolve;
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

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
      openSpy.mockRestore();
    });

    it('should skip API checks on login_error and skip BigQuery check when integration is disabled', async () => {
      appMock.restored = new Promise<void>(() => {});
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

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      (
        BigQueryService.checkBigQueryDatasetsAPIService as jest.Mock
      ).mockClear();
      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(
        BigQueryService.checkBigQueryDatasetsAPIService
      ).not.toHaveBeenCalled();

      (RuntimeService.checkDataprocApiEnabledService as jest.Mock).mockClear();
      (authApi as jest.Mock).mockResolvedValueOnce({
        login_error: true,
        config_error: false
      });
      eventEmitter.emit('dataprocConfigChange', 'config updated');
      await flushPromises();

      expect(
        RuntimeService.checkDataprocApiEnabledService
      ).not.toHaveBeenCalled();
    });

    it('should prompt for JupyterLab plugin update and handle Update success, Update failure, and Ignore actions', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let resolveRestored!: () => void;
      appMock.restored = new Promise<void>(resolve => {
        resolveRestored = resolve;
      });

      let failUpdate = false;
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            enable_metastore_integration: true
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'OK' });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.resolve('99.0.0');
        }
        if (endpoint.startsWith('updatePlugin')) {
          return failUpdate
            ? Promise.reject(new Error('pip install failed'))
            : Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      resolveRestored();
      await flushPromises();

      expect(Notification.info).toHaveBeenCalledWith(
        'There is a new version of Dataproc extension available. Would you like to update the extension?',
        expect.objectContaining({ autoClose: false })
      );

      const actions = (Notification.info as jest.Mock).mock.calls[0][1].actions;

      // Ignore action
      actions[1].callback();
      expect(Notification.warning).toHaveBeenCalledWith(
        'Update Cancelled bu user'
      );

      // Update action (success)
      await actions[0].callback();
      expect(requestAPI).toHaveBeenCalledWith(
        'updatePlugin?packageName=dataproc_jupyter_plugin',
        { method: 'POST' }
      );

      // Update action (failure)
      failUpdate = true;
      await actions[0].callback();
      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Update failed.')
      );

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should notify error and catch when fetching JupyterLab version fails', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let resolveRestored!: () => void;
      appMock.restored = new Promise<void>(resolve => {
        resolveRestored = resolve;
      });

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
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.reject(new Error('version endpoint error'));
        }
        return Promise.resolve({});
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      resolveRestored();
      await flushPromises();

      expect(Notification.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch JupyterLab version:')
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to check API status:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('9. Side panel flag coercion, guards, and Resource Manager error paths', () => {
    it('should coerce string and undefined feature flags in onSidePanelEnabled and handle panel/theme guards', async () => {
      appMock.restored = new Promise<void>(() => {});
      localStorage.setItem('notebookValue', 'existing-c1/clusters');
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

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(BigQueryWidget).toHaveBeenCalled();
      // Initialized in onSidePanelEnabled and reloaded in loadDpmsWidget (disposing previous dpmsWidget)
      expect(dpmsWidget).toHaveBeenCalledTimes(2);

      // Theme fallback when themeManager.theme is null
      themeManagerMock.theme = null;
      themeChangedCallback!();

      // Activate with string 'false' and undefined flags to hit false coercion and early-return guards
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

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      // Both panels are undefined here, hitting early return in onThemeChanged
      themeChangedCallback!();
    });

    it('should handle Resource Manager Enable action, generic API errors, and request failures', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      appMock.restored = new Promise<void>(() => {});

      // 1. Not-enabled error Enable link callback
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
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

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      const rmActions = (Notification.error as jest.Mock).mock.calls[0][1]
        .actions;
      rmActions[0].callback();
      expect(openSpy).toHaveBeenCalledWith(
        'https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com?project=test-project',
        '_blank'
      );

      // 2. Generic Resource Manager API error
      (Notification.error as jest.Mock).mockClear();
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

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(Notification.error).toHaveBeenCalledWith(
        'Error calling into the Resource Manager API: Permission denied on resource',
        { autoClose: false }
      );

      // 3. Request rejection caught gracefully
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({});
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.reject(new Error('network failure'));
        }
        return Promise.resolve({});
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      expect(errorSpy).toHaveBeenCalledWith(
        'Resource manager Api not enabled:',
        expect.any(Error)
      );

      openSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('10. BigQuery notebook download, cluster kernel execution, and title/tab edge cases', () => {
    it('should download BigQuery quickstart notebook for local and gs: paths and handle missing file browser', async () => {
      appMock.restored = new Promise<void>(() => {});
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      const bqCmd = commandsMap.get('create-bigquery-notebook-component');

      // 1. Local workspace path with valid credentials
      const localNotebookContent: any = {
        cells: [{}, {}, { source: ['# Config\n', '', ''] }]
      };
      (
        NotebookTemplateService.handleClickService as jest.Mock
      ).mockImplementationOnce(async (template, cb) => {
        await cb(localNotebookContent, template.url);
      });

      await bqCmd.execute();

      expect(localNotebookContent.cells[2].source[1]).toBe(
        "PROJECT_ID = 'test-project' \n"
      );
      expect(localNotebookContent.cells[2].source[2]).toBe(
        "REGION = 'us-central1'\n"
      );
      expect(appMock.serviceManager.contents.save).toHaveBeenCalledWith(
        'workspace/path/bigframes_quickstart.ipynb',
        {
          type: 'file',
          format: 'text',
          content: JSON.stringify(localNotebookContent)
        }
      );
      expect(appMock.shell.currentWidget.update).toHaveBeenCalled();
      expect(appMock.commands.execute).toHaveBeenCalledWith('docmanager:open', {
        path: 'workspace/path/bigframes_quickstart.ipynb'
      });

      // 2. gs: path with null credentials and null currentWidget
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

      await bqCmd.execute();

      expect(gcsNotebookContent.cells[2].source[1]).toBe('unchanged-project');
      expect(appMock.serviceManager.contents.save).toHaveBeenCalledWith(
        '/bigframes_quickstart.ipynb',
        expect.objectContaining({ type: 'file', format: 'text' })
      );

      // 3. No active file browser widget
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      factoryMock.tracker.currentWidget = null;
      appMock.serviceManager.contents.save.mockClear();
      (
        NotebookTemplateService.handleClickService as jest.Mock
      ).mockImplementationOnce(async (template, cb) => {
        await cb(localNotebookContent, template.url);
      });

      await bqCmd.execute();

      expect(errorSpy).toHaveBeenCalledWith(
        'No active file browser widget found.'
      );
      expect(appMock.serviceManager.contents.save).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should execute cluster kernel command, resolve kernel icons, and handle missing launcher', async () => {
      appMock.restored = new Promise<void>(() => {});
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      const sessionKernelCmd = commandsMap.get(
        'notebook:create-session-kernel'
      );
      const clusterKernelCmd = commandsMap.get(
        'notebook:create-cluster-kernel'
      );

      expect(sessionKernelCmd.icon()).toBeDefined();
      expect(clusterKernelCmd.icon()).toBeDefined();
      expect(iconDisplay).toHaveBeenCalledTimes(2);

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

      // Activate without optional launcher
      launcherMock.add.mockClear();
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        null,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );
      expect(launcherMock.add).not.toHaveBeenCalled();
    });

    it('should handle session kernel title changes, missing kernels, non-notebook titles, and restoring oldNotebookValue', async () => {
      appMock.restored = new Promise<void>(() => {});
      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      const titleChangedConnectMock = jest.fn();
      const titleChangedDisconnectMock = jest.fn();

      const mockSessionPanel = Object.create(NotebookPanel.prototype, {
        title: {
          value: {
            label: 'session.ipynb',
            owner: null,
            changed: {
              connect: titleChangedConnectMock,
              disconnect: titleChangedDisconnectMock
            }
          }
        },
        toolbar: {
          value: { update: jest.fn() }
        },
        sessionContext: {
          writable: true,
          value: {
            session: {
              kernel: { name: 'session-kernel' }
            }
          }
        }
      });
      mockSessionPanel.title.owner = mockSessionPanel;

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockSessionPanel
      });

      const onTitleChanged = titleChangedConnectMock.mock.calls[0][0];

      // Session kernel updates notebookValue and document.title
      await onTitleChanged(mockSessionPanel.title);
      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');
      expect(document.title).toBe('session.ipynb');

      // Calling again with same sessionValue leaves notebookValue unchanged
      await onTitleChanged(mockSessionPanel.title);
      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');

      // Switch to Clusters tab stashes oldNotebookValue and clears notebookValue
      await currentChangedCallback!(labShellMock, {
        oldValue: mockSessionPanel,
        newValue: { title: { label: 'Clusters' } }
      });
      expect(localStorage.getItem('oldNotebookValue')).toBe('kernel/sessions');
      expect(localStorage.getItem('notebookValue')).toBeNull();

      // Switch back to a non-plugin widget restores oldNotebookValue into notebookValue
      await currentChangedCallback!(labShellMock, {
        oldValue: { title: { label: 'Clusters' } },
        newValue: { title: { label: 'script.py' } }
      });
      expect(localStorage.getItem('notebookValue')).toBe('kernel/sessions');

      // Switch to Serverless then back when oldNotebookValue is removed
      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: { title: { label: 'Serverless' } }
      });
      localStorage.removeItem('oldNotebookValue');
      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: { title: { label: 'README.md' } }
      });
      expect(localStorage.getItem('notebookValue')).toBe('');

      // NotebookPanel without an active kernel clears notebookValue
      localStorage.setItem('notebookValue', 'kernel/sessions');
      mockSessionPanel.sessionContext = { session: null };
      await onTitleChanged(mockSessionPanel.title);
      expect(localStorage.getItem('notebookValue')).toBeNull();

      // Non-NotebookPanel title owner still updates document.title
      await onTitleChanged({ label: 'Plain Tab', owner: {} });
      expect(document.title).toBe('Plain Tab');
    });

    it('should safely handle undefined credentials, sparse kernel specs, and unmapped kernels', async () => {
      let resolveRestored!: () => void;
      appMock.restored = new Promise<void>(resolve => {
        resolveRestored = resolve;
      });
      (authApi as jest.Mock).mockResolvedValue(undefined);
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
      (requestAPI as jest.Mock).mockImplementation((endpoint: string) => {
        if (endpoint === 'settings') {
          return Promise.resolve({
            enable_bigquery_integration: true,
            enable_metastore_integration: false
          });
        }
        if (endpoint.startsWith('checkResourceManager')) {
          return Promise.resolve({ status: 'ERROR' });
        }
        if (endpoint.startsWith('jupyterlabVersion')) {
          return Promise.resolve('0.1.0');
        }
        return Promise.resolve({});
      });

      await (extension.activate as any)(
        appMock,
        factoryMock,
        defaultFileBrowserMock,
        launcherMock,
        mainMenuMock,
        labShellMock,
        notebookTrackerMock,
        themeManagerMock,
        settingRegistryMock,
        documentManagerMock
      );

      resolveRestored();
      await new Promise(resolve => setTimeout(resolve, 0));

      const titleChangedConnectMock = jest.fn();
      const mockUnknownKernelPanel = Object.create(NotebookPanel.prototype, {
        title: {
          value: {
            label: 'local.ipynb',
            owner: null,
            changed: {
              connect: titleChangedConnectMock,
              disconnect: jest.fn()
            }
          }
        },
        toolbar: {
          value: { update: jest.fn() }
        },
        sessionContext: {
          writable: true,
          value: {
            session: {
              kernel: { name: 'unregistered-kernel' }
            }
          }
        }
      });
      mockUnknownKernelPanel.title.owner = mockUnknownKernelPanel;

      await currentChangedCallback!(labShellMock, {
        oldValue: null,
        newValue: mockUnknownKernelPanel
      });

      const onTitleChanged = titleChangedConnectMock.mock.calls[0][0];
      await onTitleChanged(mockUnknownKernelPanel.title);
      expect(document.title).toBe('local.ipynb');

      mockUnknownKernelPanel.sessionContext = {
        session: { kernel: { name: 'no-endpoint-kernel' } }
      };
      await onTitleChanged(mockUnknownKernelPanel.title);
      expect(document.title).toBe('local.ipynb');

      // Reset authApi default mock for cleanliness
      (authApi as jest.Mock).mockResolvedValue({
        project_id: 'test-project',
        login_error: false,
        config_error: false
      });
    });
  });
});
