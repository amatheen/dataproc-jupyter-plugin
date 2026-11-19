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

jest.mock('../utils/pollingTimer', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('../utils/viewLogs', () => ({
  __esModule: true,
  default: ({ sessionInfo }: any) => (
    <div data-testid="mock-view-logs">{sessionInfo?.name}</div>
  )
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import SessionDetails from './sessionDetails';
import { SessionService } from './sessionService';
import PollingTimer from '../utils/pollingTimer';
import {
  STATUS_ACTIVE,
  STATUS_CREATING,
  STATUS_DELETING,
  STATUS_ERROR,
  STATUS_FAIL,
  STATUS_PROVISIONING,
  STATUS_STARTING,
  STATUS_STOPPING,
  STATUS_TERMINATED,
  STATUS_TERMINATING
} from '../utils/const';

describe('SessionDetails Component', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const mockSetDetailedSessionView = jest.fn();

  const createMockSessionInfo = (overrides: Record<string, any> = {}) => ({
    state: STATUS_ACTIVE,
    name: 'projects/test-project/locations/us-central1/sessions/sess-alpha',
    uuid: 'uuid-1234-5678',
    elapsedTime: '',
    createTime: '2026-01-10T10:00:00Z',
    stateTime: '2026-01-10T10:15:00Z',
    stateHistory: [
      { stateStartTime: '2026-01-10T10:00:00Z' },
      { stateStartTime: '2026-01-10T10:02:00Z' }
    ],
    runtimeConfig: {
      properties: {
        'spark:spark.dataproc.engine': 'lightningEngine',
        'spark:spark.executor.cores': '4'
      }
    },
    stateMessage: '',
    environmentConfig: {
      executionConfig: {
        serviceAccount: 'sa@test-project.iam.gserviceaccount.com',
        networkUri: 'default-network',
        subnetworkUri: 'default-subnet',
        networkTags: ['tag-one', 'tag-two'],
        kmsKey: ''
      },
      peripheralsConfig: {
        metastoreService: '',
        sparkHistoryServerConfig: {
          dataprocCluster: ''
        }
      }
    },
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.restoreAllMocks();
  });

  const mockSessionDetailsResponse = (
    sessionOverrides?: Record<string, any> | null,
    labels: string[] = [],
    errorView = false
  ) =>
    jest
      .spyOn(SessionService, 'getSessionDetailsService')
      .mockImplementation(
        async (
          _selected,
          setErrorView,
          setIsLoading,
          setLabelDetail,
          setSessionInfo
        ) => {
          if (errorView) {
            setErrorView(true);
          }
          if (sessionOverrides !== null) {
            setSessionInfo(createMockSessionInfo(sessionOverrides));
            setLabelDetail(labels);
          }
          setIsLoading(false);
        }
      );

  const renderDetails = async (
    props: Partial<React.ComponentProps<typeof SessionDetails>> = {}
  ) => {
    await act(async () => {
      root?.render(
        <SessionDetails
          sessionSelected="sess-alpha"
          setDetailedSessionView={mockSetDetailedSessionView}
          detailedSessionView={true}
          {...props}
        />
      );
    });
  };

  it('displays Loading Session Details spinner while pending and cleans up polling on unmount', async () => {
    jest
      .spyOn(SessionService, 'getSessionDetailsService')
      .mockImplementation(async () => undefined);

    await renderDetails();

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading Session Details');

    act(() => {
      root?.unmount();
      root = null;
    });

    expect(PollingTimer).toHaveBeenLastCalledWith(
      expect.any(Function),
      true,
      undefined
    );
  });

  it('renders empty container without loader when fetch finishes with empty session name and no error', async () => {
    mockSessionDetailsResponse({ name: '' });

    await renderDetails();

    expect(container.querySelector('[data-testid="loader"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('.cluster-details-title')).toBeNull();
  });

  test.each([
    ['list view (no fromPage)', undefined, undefined, true, false],
    [
      'Launcher with activeWidget.close',
      'Launcher',
      () => ({ shell: { activeWidget: { close: jest.fn() } } }),
      false,
      true
    ],
    ['Launcher without app prop', 'Launcher', () => undefined, false, false],
    [
      'Launcher with null activeWidget',
      'Launcher',
      () => ({ shell: { activeWidget: null } }),
      false,
      false
    ]
  ])(
    'renders 404 error view and handles back-arrow click in %s',
    async (
      _scenario,
      fromPage,
      buildApp,
      expectExitDetailView,
      expectWidgetClosed
    ) => {
      mockSessionDetailsResponse(null, [], true);
      const mockApp: any = buildApp ? buildApp() : undefined;

      await renderDetails({ fromPage, app: mockApp });

      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        'Unable to find the resource you requested'
      );

      const backArrow = container.querySelector(
        '[aria-label="back-arrow-icon"]'
      ) as HTMLElement;
      await act(async () => {
        backArrow.click();
      });

      if (expectExitDetailView) {
        expect(mockSetDetailedSessionView).toHaveBeenCalledWith(false);
      } else {
        expect(mockSetDetailedSessionView).not.toHaveBeenCalled();
      }
      if (expectWidgetClosed) {
        expect(mockApp.shell.activeWidget.close).toHaveBeenCalledTimes(1);
      }
    }
  );

  it('renders full metadata, Lightning Engine, executionConfig, customer KMS key, peripheralsConfig, and labels', async () => {
    mockSessionDetailsResponse(
      {
        environmentConfig: {
          executionConfig: {
            serviceAccount: 'sa@test-project.iam.gserviceaccount.com',
            networkUri: 'vpc-main',
            subnetworkUri: 'subnet-us-central1',
            networkTags: ['spark-node', 'internal'],
            kmsKey:
              'projects/test-project/locations/us-central1/keyRings/kr/cryptoKeys/key1'
          },
          peripheralsConfig: {
            metastoreService:
              'projects/test-project/locations/us-central1/services/dpms-1',
            sparkHistoryServerConfig: {
              dataprocCluster:
                'projects/test-project/regions/us-central1/clusters/shs-cluster'
            },
            extraField: 'ignored'
          }
        }
      },
      ['env:prod', 'owner:dataproc']
    );

    await renderDetails();

    expect(container.textContent).toContain('sess-alpha');
    expect(container.textContent).toContain('uuid-1234-5678');
    expect(container.textContent).toContain('Lightning Engine');
    expect(container.textContent).toContain('Run time');
    expect(container.textContent).toContain('spark:spark.executor.cores');
    expect(container.textContent).toContain(
      'sa@test-project.iam.gserviceaccount.com'
    );
    expect(container.textContent).toContain('vpc-main');
    expect(container.textContent).toContain('subnet-us-central1');
    expect(container.textContent).toContain('spark-node');
    expect(container.textContent).toContain('Customer-managed');
    expect(container.textContent).toContain(
      'projects/test-project/locations/us-central1/keyRings/kr/cryptoKeys/key1'
    );
    expect(container.textContent).toContain('Peripherals config');
    expect(container.textContent).toContain(
      'projects/test-project/locations/us-central1/services/dpms-1'
    );
    expect(container.textContent).toContain('Spark History Server');
    expect(container.textContent).toContain(
      'projects/test-project/regions/us-central1/clusters/shs-cluster'
    );
    expect(container.textContent).toContain('env : prod');
    expect(container.textContent).toContain('owner : dataproc');
    expect(
      container.querySelector('[data-testid="mock-view-logs"]')
    ).not.toBeNull();

    const headerBackArrow = container.querySelector(
      '.back-arrow-icon'
    ) as HTMLElement;
    await act(async () => {
      headerBackArrow.click();
    });
    expect(mockSetDetailedSessionView).toHaveBeenCalledWith(false);
  });

  test.each([
    [
      'Spark History Server without metastore and empty second stateHistory timestamp',
      {
        state: STATUS_TERMINATED,
        stateHistory: [
          { stateStartTime: '2026-01-10T10:00:00Z' },
          { stateStartTime: '' }
        ],
        runtimeConfig: {
          properties: { 'spark:spark.dataproc.engine': 'unknownEngine' }
        },
        environmentConfig: {
          executionConfig: {
            serviceAccount: 'sa@test.iam.gserviceaccount.com',
            networkUri: 'net',
            subnetworkUri: 'subnet',
            networkTags: [],
            kmsKey: ''
          },
          peripheralsConfig: {
            metastoreService: '',
            sparkHistoryServerConfig: { dataprocCluster: 'shs-only-cluster' }
          }
        }
      },
      true
    ],
    [
      'undefined stateHistory and undefined sparkHistoryServerConfig',
      {
        state: STATUS_TERMINATED,
        stateHistory: undefined,
        runtimeConfig: { properties: {} },
        environmentConfig: {
          executionConfig: {
            serviceAccount: 'sa@test.iam.gserviceaccount.com',
            subnetworkUri: 'subnet',
            networkTags: [],
            kmsKey: ''
          },
          peripheralsConfig: {
            metastoreService: '',
            sparkHistoryServerConfig: undefined
          }
        }
      },
      false
    ]
  ])(
    'renders fallbacks cleanly for %s',
    async (_label, overrides, expectShsHeader) => {
      mockSessionDetailsResponse(overrides, []);

      await renderDetails();

      expect(container.textContent).toContain('Default');
      expect(container.textContent).toContain('Google-managed');
      expect(container.textContent).not.toContain('Encryption key');
      expect(container.textContent).toContain('None');
      expect(container.textContent?.includes('Spark History Server')).toBe(
        expectShsHeader
      );
    }
  );

  test.each([
    [STATUS_ACTIVE, 'active', false, false],
    [STATUS_TERMINATED, 'terminated', false, false],
    [STATUS_ERROR, 'error', false, false],
    [STATUS_FAIL, 'failed', false, true],
    [STATUS_CREATING, STATUS_PROVISIONING, true, false],
    [STATUS_PROVISIONING, 'provisioning', true, false],
    [STATUS_STARTING, 'starting', true, false],
    [STATUS_STOPPING, 'stopping', true, false],
    [STATUS_TERMINATING, 'terminating', true, false],
    [STATUS_DELETING, 'deleting', true, false]
  ])(
    'renders status badge for %s as "%s" (spinner=%s, showFailMsg=%s)',
    async (stateVal, expectedText, expectSpinner, expectStateMsg) => {
      mockSessionDetailsResponse({
        state: stateVal,
        stateMessage: 'Driver OOM failure',
        runtimeConfig: { properties: {} }
      });

      await renderDetails();

      expect(container.querySelector('.cluster-status')?.textContent).toBe(
        expectedText
      );
      expect(Boolean(container.querySelector('[data-testid="loader"]'))).toBe(
        expectSpinner
      );
      expect(container.textContent?.includes('Driver OOM failure')).toBe(
        expectStateMsg
      );
    }
  );

  test.each([
    [STATUS_CREATING, 'action-cluster-section', true],
    [STATUS_ACTIVE, 'action-cluster-section', false],
    [STATUS_TERMINATED, 'action-cluster-section disabled', false]
  ])(
    'handles TERMINATE button in %s state (class="%s", callsApi=%s)',
    async (state, expectedClass, expectApiCall) => {
      const terminateSpy = jest
        .spyOn(SessionService, 'terminateSessionAPI')
        .mockResolvedValue(undefined);
      mockSessionDetailsResponse({ state });

      await renderDetails();

      const terminateBtn = container.querySelector(
        '.action-cluster-section'
      ) as HTMLElement;
      expect(terminateBtn.className).toBe(expectedClass);

      await act(async () => {
        terminateBtn.click();
      });

      if (expectApiCall) {
        expect(terminateSpy).toHaveBeenCalledWith('sess-alpha');
      } else {
        expect(terminateSpy).not.toHaveBeenCalled();
      }
    }
  );

  it('hides details body when detailedSessionView is false and tolerates undefined runtimeConfig', async () => {
    mockSessionDetailsResponse({ runtimeConfig: undefined });

    await renderDetails({ detailedSessionView: false });

    expect(container.querySelector('.scroll')).not.toBeNull();
    expect(container.querySelector('.cluster-details-title')).toBeNull();
  });
});
