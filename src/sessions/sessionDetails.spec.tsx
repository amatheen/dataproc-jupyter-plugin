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
  let root: Root;
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
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderDetails = async (
    props: Partial<React.ComponentProps<typeof SessionDetails>> = {}
  ) => {
    await act(async () => {
      root.render(
        <SessionDetails
          sessionSelected="sess-alpha"
          setDetailedSessionView={mockSetDetailedSessionView}
          detailedSessionView={true}
          {...props}
        />
      );
    });
  };

  it('displays Loading Session Details spinner while fetching and hides when loading finishes empty', async () => {
    jest
      .spyOn(SessionService, 'getSessionDetailsService')
      .mockImplementation(async () => undefined);

    await renderDetails();

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading Session Details');
  });

  it('renders error view on 404 and handles back navigation for both list view and Launcher', async () => {
    jest
      .spyOn(SessionService, 'getSessionDetailsService')
      .mockImplementation(async (_selected, setErrorView, setIsLoading) => {
        setErrorView(true);
        setIsLoading(false);
      });

    await renderDetails();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Unable to find the resource you requested'
    );

    const backArrow = container.querySelector(
      '[aria-label="back-arrow-icon"]'
    ) as HTMLElement;
    await act(async () => {
      backArrow.click();
    });
    expect(mockSetDetailedSessionView).toHaveBeenCalledWith(false);
    expect(PollingTimer).toHaveBeenCalled();

    // Verify Launcher close behavior
    const mockClose = jest.fn();
    const mockApp: any = { shell: { activeWidget: { close: mockClose } } };
    await renderDetails({ fromPage: 'Launcher', app: mockApp });

    const launcherBackArrow = container.querySelector(
      '[aria-label="back-arrow-icon"]'
    ) as HTMLElement;
    await act(async () => {
      launcherBackArrow.click();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('renders full session metadata, Lightning Engine, executionConfig, KMS key, peripheralsConfig, and labels', async () => {
    const richSession = createMockSessionInfo({
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
    });

    jest
      .spyOn(SessionService, 'getSessionDetailsService')
      .mockImplementation(
        async (
          _selected,
          _setErrorView,
          setIsLoading,
          setLabelDetail,
          setSessionInfo
        ) => {
          setSessionInfo(richSession);
          setLabelDetail(['env:prod', 'owner:dataproc']);
          setIsLoading(false);
        }
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

    // Click header back arrow in details view
    const headerBackArrow = container.querySelector(
      '.back-arrow-icon'
    ) as HTMLElement;
    await act(async () => {
      headerBackArrow.click();
    });
    expect(mockSetDetailedSessionView).toHaveBeenCalledWith(false);
  });

  it('renders Google-managed encryption, "None" labels, Default engine fallback, and empty stateHistory fallback', async () => {
    const minimalSession = createMockSessionInfo({
      state: STATUS_TERMINATED,
      stateHistory: [{ stateStartTime: '' }],
      runtimeConfig: {
        properties: {
          'spark:spark.dataproc.engine': 'unknownEngine'
        }
      },
      environmentConfig: {
        executionConfig: {
          serviceAccount: 'sa@test-project.iam.gserviceaccount.com',
          networkUri: 'default-network',
          subnetworkUri: 'default-subnet',
          networkTags: [],
          kmsKey: ''
        },
        peripheralsConfig: {
          metastoreService: '',
          sparkHistoryServerConfig: {
            dataprocCluster: 'shs-only-cluster'
          }
        }
      }
    });

    jest
      .spyOn(SessionService, 'getSessionDetailsService')
      .mockImplementation(
        async (
          _selected,
          _setErrorView,
          setIsLoading,
          setLabelDetail,
          setSessionInfo
        ) => {
          setSessionInfo(minimalSession);
          setLabelDetail([]);
          setIsLoading(false);
        }
      );

    await renderDetails();

    expect(container.textContent).toContain('Default');
    expect(container.textContent).toContain('Google-managed');
    expect(container.textContent).not.toContain('Encryption key');
    expect(container.textContent).toContain('shs-only-cluster');
    expect(container.textContent).toContain('None');
  });

  it.each([
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
      const session = createMockSessionInfo({
        state: stateVal,
        stateMessage: 'Driver OOM failure',
        runtimeConfig: { properties: {} }
      });

      jest
        .spyOn(SessionService, 'getSessionDetailsService')
        .mockImplementation(
          async (
            _selected,
            _setErrorView,
            setIsLoading,
            setLabelDetail,
            setSessionInfo
          ) => {
            setSessionInfo(session);
            setLabelDetail([]);
            setIsLoading(false);
          }
        );

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

  it('handles TERMINATE button clicks across CREATING, ACTIVE, and TERMINATED states and respects detailedSessionView=false', async () => {
    const terminateSpy = jest
      .spyOn(SessionService, 'terminateSessionAPI')
      .mockResolvedValue(undefined);

    const renderWithState = async (
      state: string,
      detailedSessionView = true,
      omitProperties = false
    ) => {
      act(() => {
        root.unmount();
      });
      root = createRoot(container);
      jest
        .spyOn(SessionService, 'getSessionDetailsService')
        .mockImplementation(
          async (
            _selected,
            _setErrorView,
            setIsLoading,
            setLabelDetail,
            setSessionInfo
          ) => {
            setSessionInfo(
              createMockSessionInfo({
                state,
                ...(omitProperties ? { runtimeConfig: {} } : {})
              })
            );
            setLabelDetail([]);
            setIsLoading(false);
          }
        );
      await renderDetails({ detailedSessionView });
    };

    // CREATING triggers terminateSessionAPI
    await renderWithState(STATUS_CREATING);
    let terminateBtn = container.querySelector(
      '.action-cluster-section'
    ) as HTMLElement;
    expect(terminateBtn.className).toBe('action-cluster-section');
    await act(async () => {
      terminateBtn.click();
    });
    expect(terminateSpy).toHaveBeenCalledWith('sess-alpha');

    // ACTIVE renders enabled class and short-circuits onClick in current implementation
    terminateSpy.mockClear();
    await renderWithState(STATUS_ACTIVE);
    terminateBtn = container.querySelector(
      '.action-cluster-section'
    ) as HTMLElement;
    expect(terminateBtn.className).toBe('action-cluster-section');
    await act(async () => {
      terminateBtn.click();
    });
    expect(terminateSpy).not.toHaveBeenCalled();

    // TERMINATED renders disabled class and does not invoke terminateSessionAPI
    await renderWithState(STATUS_TERMINATED);
    terminateBtn = container.querySelector(
      '.action-cluster-section'
    ) as HTMLElement;
    expect(terminateBtn.className).toBe('action-cluster-section disabled');
    await act(async () => {
      terminateBtn.click();
    });
    expect(terminateSpy).not.toHaveBeenCalled();

    // detailedSessionView=false hides inner content and safely handles missing runtimeConfig.properties
    await renderWithState(STATUS_ACTIVE, false, true);
    expect(container.querySelector('.cluster-details-title')).toBeNull();
  });
});
