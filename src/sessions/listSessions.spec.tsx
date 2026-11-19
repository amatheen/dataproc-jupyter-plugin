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

jest.mock('../utils/utils', () => ({
  ...jest.requireActual('../utils/utils'),
  authApi: jest.fn()
}));

jest.mock('./sessionDetails', () => ({
  __esModule: true,
  default: ({ sessionSelected, setDetailedSessionView }: any) => (
    <div data-testid="mock-session-details">
      <span>Details for {sessionSelected}</span>
      <button
        data-testid="back-to-sessions-btn"
        onClick={() => setDetailedSessionView(false)}
      >
        Back
      </button>
    </div>
  )
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import ListSessions from './listSessions';
import { SessionService } from './sessionService';
import PollingTimer from '../utils/pollingTimer';
import { authApi } from '../utils/utils';
import {
  ClusterStatus,
  STATUS_ACTIVE,
  STATUS_CREATING,
  STATUS_DELETING,
  STATUS_FAIL,
  STATUS_PENDING,
  STATUS_PROVISIONING,
  STATUS_TERMINATED,
  STATUS_TERMINATING
} from '../utils/const';

describe('ListSessions Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockCredentials = {
    project_id: 'test-project',
    region_id: 'us-central1',
    access_token: 'mock-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authApi as jest.Mock).mockResolvedValue(mockCredentials);
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

  const buildSessionRow = (
    renderActions: (data: any) => React.JSX.Element,
    sessionID: string,
    status: string,
    actionState: ClusterStatus = ClusterStatus.STATUS_ACTIVE
  ) => ({
    sessionID,
    status,
    location: 'us-central1',
    engine: 'Default',
    creator: 'user@example.com',
    creationTime: 'Jan 1, 2026',
    elapsedTime: '2m 30s',
    actions: renderActions({
      name: `projects/test-project/locations/us-central1/sessions/${sessionID}`,
      state: actionState
    })
  });

  const renderComponent = async () => {
    await act(async () => {
      root.render(<ListSessions />);
    });
  };

  it('displays loading spinner while sessions are being fetched', async () => {
    jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(async () => undefined);

    await renderComponent();

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading Sessions');
  });

  it('displays "No rows to display" when session list is empty and starts polling', async () => {
    jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(async (_renderActions, setIsLoading, setList) => {
        setList([]);
        setIsLoading(false);
      });

    await renderComponent();

    expect(container.querySelector('.no-data-style')?.textContent).toBe(
      'No rows to display'
    );
    expect(PollingTimer).toHaveBeenCalled();
  });

  it('renders ApiEnableDialog and handles both Enable and Cancel actions', async () => {
    const windowOpenSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => null);

    jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(
        async (
          _renderActions,
          setIsLoading,
          setList,
          setApiDialogOpen,
          _setPollingDisable,
          setEnableLink
        ) => {
          setList([]);
          setIsLoading(false);
          setEnableLink('https://console.cloud.google.com/apis/dataproc');
          setApiDialogOpen(true);
        }
      );

    await renderComponent();

    expect(document.body.textContent).toContain(
      'The Cloud Dataproc API is not enabled for this project.'
    );

    const cancelBtn = Array.from(document.body.querySelectorAll('button')).find(
      b => b.textContent === 'Cancel'
    );
    await act(async () => {
      cancelBtn?.click();
    });
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // Re-render to verify Enable button path
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await renderComponent();

    const enableBtn = Array.from(document.body.querySelectorAll('button')).find(
      b => b.textContent === 'Enable'
    );
    await act(async () => {
      enableBtn?.click();
    });
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://console.cloud.google.com/apis/dataproc',
      '_blank'
    );

    windowOpenSpy.mockRestore();
  });

  it.each([
    [STATUS_ACTIVE, 'active', false],
    [STATUS_TERMINATED, 'terminated', false],
    [STATUS_FAIL, 'failed', false],
    [STATUS_PROVISIONING, 'provisioning', true],
    [STATUS_CREATING, 'creating', true],
    [STATUS_PENDING, 'pending', true],
    [STATUS_TERMINATING, 'terminating', true],
    [STATUS_DELETING, 'deleting', true]
  ])(
    'renders status cell for %s with expected text "%s" and spinner=%s',
    async (statusValue, expectedLower, expectSpinner) => {
      jest
        .spyOn(SessionService, 'listSessionsAPIService')
        .mockImplementation(async (renderActions, setIsLoading, setList) => {
          setList([buildSessionRow(renderActions, 'sess-status', statusValue)]);
          setIsLoading(false);
        });

      await renderComponent();

      const statusText = container.querySelector('.cluster-status');
      expect(statusText?.textContent).toBe(expectedLower);
      const loader = container.querySelector('[data-testid="loader"]');
      expect(Boolean(loader)).toBe(expectSpinner);
    }
  );

  it('triggers terminate only for ACTIVE sessions and handles delete confirmation & cancellation', async () => {
    const terminateSpy = jest
      .spyOn(SessionService, 'terminateSessionAPI')
      .mockResolvedValue(undefined);
    const deleteSpy = jest
      .spyOn(SessionService, 'deleteSessionAPI')
      .mockResolvedValue(undefined);

    jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(async (renderActions, setIsLoading, setList) => {
        setList([
          buildSessionRow(
            renderActions,
            'sess-active',
            STATUS_ACTIVE,
            ClusterStatus.STATUS_ACTIVE
          ),
          buildSessionRow(
            renderActions,
            'sess-stopped',
            STATUS_TERMINATED,
            ClusterStatus.STATUS_STOPPED
          )
        ]);
        setIsLoading(false);
      });

    await renderComponent();

    const terminateButtons = container.querySelectorAll(
      '[title="Terminate Session"]'
    );
    expect(terminateButtons.length).toBe(2);
    expect(terminateButtons[0].getAttribute('aria-disabled')).toBe('false');
    expect(terminateButtons[1].getAttribute('aria-disabled')).toBe('true');

    await act(async () => {
      (terminateButtons[1] as HTMLElement).click();
    });
    expect(terminateSpy).not.toHaveBeenCalled();

    await act(async () => {
      (terminateButtons[0] as HTMLElement).click();
    });
    expect(terminateSpy).toHaveBeenCalledWith('sess-active');

    // Open DeletePopup and cancel first
    const deleteButtons = container.querySelectorAll(
      '[title="Delete Session"]'
    );
    await act(async () => {
      (deleteButtons[0] as HTMLElement).click();
    });
    expect(document.body.textContent).toContain(
      'This will delete sess-active and cannot be undone.'
    );

    const cancelDeleteBtn = Array.from(
      document.body.querySelectorAll('button')
    ).find(b => b.textContent === 'Cancel');
    await act(async () => {
      cancelDeleteBtn?.click();
    });
    expect(deleteSpy).not.toHaveBeenCalled();

    // Re-open DeletePopup and confirm deletion
    await act(async () => {
      (deleteButtons[0] as HTMLElement).click();
    });
    const confirmDeleteBtn = Array.from(
      document.body.querySelectorAll('button')
    ).find(b => b.textContent === 'Delete');
    await act(async () => {
      confirmDeleteBtn?.click();
    });
    expect(deleteSpy).toHaveBeenCalledWith('sess-active');
  });

  it('opens SessionDetails when a Session ID is clicked and returns to the table on back', async () => {
    const listSpy = jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(async (renderActions, setIsLoading, setList) => {
        setList([
          buildSessionRow(
            renderActions,
            'sess-detail-01',
            STATUS_ACTIVE,
            ClusterStatus.STATUS_ACTIVE
          )
        ]);
        setIsLoading(false);
      });

    await renderComponent();

    const sessionIdCell = container.querySelector(
      'td.cluster-name'
    ) as HTMLElement;
    expect(sessionIdCell?.textContent).toBe('sess-detail-01');

    await act(async () => {
      sessionIdCell.click();
    });

    expect(
      container.querySelector('[data-testid="mock-session-details"]')
    ).not.toBeNull();
    expect(container.textContent).toContain('Details for sess-detail-01');

    const backBtn = container.querySelector(
      '[data-testid="back-to-sessions-btn"]'
    ) as HTMLElement;
    await act(async () => {
      backBtn.click();
    });

    expect(
      container.querySelector('[data-testid="mock-session-details"]')
    ).toBeNull();
    expect(listSpy).toHaveBeenCalledTimes(3);
  });

  it('renders PaginationView when more than 50 sessions are loaded and disables polling when global filter disables it', async () => {
    const listSpy = jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(
        async (
          renderActions,
          setIsLoading,
          setList,
          _setApiDialogOpen,
          setPollingDisable
        ) => {
          const manyRows = Array.from({ length: 52 }, (_, idx) =>
            buildSessionRow(renderActions, `sess-${idx}`, STATUS_ACTIVE)
          );
          setList(manyRows);
          setIsLoading(false);
          setPollingDisable(true);
        }
      );

    await renderComponent();

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('1 - 50 of 52');
  });
});
