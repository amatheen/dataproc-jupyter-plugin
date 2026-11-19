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

const mockSessionDetailsProps = jest.fn();

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
  default: (props: any) => {
    mockSessionDetailsProps(props);
    return (
      <div data-testid="mock-session-details">
        <span>Details for {props.sessionSelected}</span>
        <button
          data-testid="back-to-sessions-btn"
          onClick={() => props.setDetailedSessionView(false)}
        >
          Back
        </button>
      </div>
    );
  }
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
  let root: Root | null = null;

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
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    jest.restoreAllMocks();
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

  const mockListSessions = (
    buildRows: (
      renderActions: (data: any) => React.JSX.Element
    ) => Array<ReturnType<typeof buildSessionRow>>
  ) =>
    jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(async (renderActions, setIsLoading, setList) => {
        setList(buildRows(renderActions));
        setIsLoading(false);
      });

  const renderComponent = async () => {
    await act(async () => {
      root?.render(<ListSessions />);
    });
  };

  it('displays loading spinner while sessions are being fetched and cleans up polling on unmount', async () => {
    jest
      .spyOn(SessionService, 'listSessionsAPIService')
      .mockImplementation(async () => undefined);

    await renderComponent();

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading Sessions');

    act(() => {
      root?.unmount();
      root = null;
    });

    expect(PollingTimer).toHaveBeenCalledWith(
      expect.any(Function),
      true,
      undefined
    );
  });

  it('displays "No rows to display" when session list is empty and starts polling', async () => {
    mockListSessions(() => []);

    await renderComponent();

    expect(container.querySelector('.no-data-style')?.textContent).toBe(
      'No rows to display'
    );
    expect(PollingTimer).toHaveBeenCalledWith(
      expect.any(Function),
      false,
      undefined
    );
  });

  test.each([
    ['Enable', true],
    ['Cancel', false]
  ])(
    'renders ApiEnableDialog and handles "%s" click (opensWindow=%s)',
    async (buttonLabel, shouldOpenWindow) => {
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

      const actionBtn = Array.from(
        document.body.querySelectorAll('button')
      ).find(b => b.textContent === buttonLabel);
      expect(actionBtn).toBeDefined();

      await act(async () => {
        actionBtn?.click();
      });

      if (shouldOpenWindow) {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          'https://console.cloud.google.com/apis/dataproc',
          '_blank'
        );
      } else {
        expect(windowOpenSpy).not.toHaveBeenCalled();
      }
      expect(document.body.textContent).not.toContain(
        'The Cloud Dataproc API is not enabled for this project.'
      );
    }
  );

  test.each([
    [STATUS_ACTIVE, 'active', false],
    [STATUS_TERMINATED, 'terminated', false],
    [STATUS_FAIL, 'failed', false],
    [STATUS_PROVISIONING, 'provisioning', true],
    [STATUS_CREATING, 'creating', true],
    [STATUS_PENDING, 'pending', true],
    [STATUS_TERMINATING, 'terminating', true],
    [STATUS_DELETING, 'deleting', true],
    ['', '', false]
  ])(
    'renders status cell for "%s" with expected text "%s" and spinner=%s',
    async (statusValue, expectedLower, expectSpinner) => {
      mockListSessions(renderActions => [
        buildSessionRow(renderActions, 'sess-status', statusValue)
      ]);

      await renderComponent();

      expect(container.querySelector('.cluster-status')?.textContent).toBe(
        expectedLower
      );
      expect(Boolean(container.querySelector('[data-testid="loader"]'))).toBe(
        expectSpinner
      );
    }
  );

  it('triggers terminate only for ACTIVE sessions and handles delete confirmation & cancellation', async () => {
    const terminateSpy = jest
      .spyOn(SessionService, 'terminateSessionAPI')
      .mockResolvedValue(undefined);
    const deleteSpy = jest
      .spyOn(SessionService, 'deleteSessionAPI')
      .mockResolvedValue(undefined);

    mockListSessions(renderActions => [
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

  it('opens SessionDetails when a Session ID is clicked and refreshes table on back', async () => {
    const listSpy = mockListSessions(renderActions => [
      buildSessionRow(
        renderActions,
        'sess-detail-01',
        STATUS_ACTIVE,
        ClusterStatus.STATUS_ACTIVE
      )
    ]);

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
    expect(mockSessionDetailsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionSelected: 'sess-detail-01',
        detailedSessionView: true
      })
    );

    const backBtn = container.querySelector(
      '[data-testid="back-to-sessions-btn"]'
    ) as HTMLButtonElement;
    await act(async () => {
      backBtn.click();
    });

    expect(
      container.querySelector('[data-testid="mock-session-details"]')
    ).toBeNull();
    expect(listSpy).toHaveBeenCalledTimes(3);
  });

  it('filters rows via GlobalFilter input (toggling pollingDisable) and navigates PaginationView when > 50 rows exist', async () => {
    const listSpy = mockListSessions(renderActions =>
      Array.from({ length: 52 }, (_, idx) =>
        buildSessionRow(renderActions, `sess-${idx}`, STATUS_ACTIVE)
      )
    );

    await renderComponent();

    expect(container.querySelector('.page-display-part')?.textContent).toBe(
      '1 - 50 of 52'
    );

    // Navigate to page 2 via Next button, then back to page 1 via Previous button
    const moveButtons = container.querySelectorAll('.page-move-button');
    expect(moveButtons.length).toBe(2);
    await act(async () => {
      (moveButtons[1] as HTMLElement).click();
    });
    expect(container.querySelector('.page-display-part')?.textContent).toBe(
      '51 - 52 of 52'
    );
    await act(async () => {
      (moveButtons[0] as HTMLElement).click();
    });
    expect(container.querySelector('.page-display-part')?.textContent).toBe(
      '1 - 50 of 52'
    );

    // Type into GlobalFilter to filter down to sess-51 and disable polling
    const filterInput = container.querySelector(
      'input[aria-label="filterd value"]'
    ) as HTMLInputElement;
    expect(filterInput).not.toBeNull();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      nativeInputValueSetter?.call(filterInput, 'sess-51');
      filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const visibleNameCells = container.querySelectorAll('td.cluster-name');
    expect(visibleNameCells.length).toBe(1);
    expect(visibleNameCells[0].textContent).toBe('sess-51');
    // Setting non-empty filter sets pollingDisable=true, so listSessionsAPI is NOT re-called
    expect(listSpy).toHaveBeenCalledTimes(1);
  });
});
