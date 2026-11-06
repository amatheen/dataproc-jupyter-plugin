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

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import ListBatches from './listBatches';
import { BatchService } from './batchService';
import {
  STATUS_CREATING,
  STATUS_DELETING,
  STATUS_FAIL,
  STATUS_PENDING,
  STATUS_PROVISIONING,
  STATUS_RUNNING,
  STATUS_SUCCESS
} from '../utils/const';

jest.mock('../handler/handler', () => ({
  requestAPI: jest.fn().mockResolvedValue({
    dataproc_url: 'https://dataproc.googleapis.com/',
    compute_url: 'https://compute.googleapis.com/compute/v1',
    metastore_url: 'https://metastore.googleapis.com/',
    cloudkms_url: 'https://cloudkms.googleapis.com/',
    cloudresourcemanager_url: 'https://cloudresourcemanager.googleapis.com/',
    datacatalog_url: 'https://datacatalog.googleapis.com/',
    storage_url: 'https://storage.googleapis.com/'
  })
}));

jest.mock('./batchService', () => ({
  BatchService: {
    listBatchAPIService: jest.fn(),
    deleteBatchAPIService: jest.fn()
  }
}));

jest.mock('./batchDetails', () => ({
  __esModule: true,
  default: (props: any) => (
    <div className="batch-details-stub">
      Details of {props.batchSelected}
      <button onClick={() => props.setBatchCreatedFromDetails(true)}>
        Submit clone
      </button>
      <button onClick={() => props.setDetailedBatchView(false)}>Back</button>
    </div>
  )
}));

jest.mock('./createBatch', () => ({
  __esModule: true,
  default: (props: any) => (
    <div className="create-batch-stub">
      Create batch in {props.regionName}/{props.projectName}
      <button onClick={() => props.setCreateBatchView(false)}>Close</button>
      <button
        onClick={() => {
          props.setBatchCreatedFromDetails(true);
          props.setNextPageTokens([]);
          props.setCreateBatchView(false);
        }}
      >
        Submit
      </button>
    </div>
  )
}));

jest.mock('../utils/deletePopup', () => ({
  __esModule: true,
  default: (props: any) => (
    <div className="delete-popup-stub">
      {props.DeleteMsg}
      <button onClick={props.onCancel}>Cancel delete</button>
      <button onClick={props.onDelete}>Confirm delete</button>
    </div>
  )
}));

jest.mock('../utils/apiErrorPopup', () => ({
  __esModule: true,
  default: (props: any) => (
    <div className="api-dialog-stub">
      {props.enableLink}
      <button onClick={props.onCancel}>Cancel</button>
      <button onClick={props.onEnable}>Enable</button>
    </div>
  )
}));

type FakeBatch = { name: string; state: string };
type FakePage = { batches: FakeBatch[]; next?: string };

const ENABLE_LINK = 'https://console.cloud.google.com/apis/library/dataproc';
const PAGER_ON = 'page-move-button';
const PAGER_OFF = 'page-move-button disabled';
const DELETE_CLASS = 'icon-buttons-style-delete-batch';
const listService = BatchService.listBatchAPIService as jest.Mock;
const deleteService = BatchService.deleteBatchAPIService as jest.Mock;

const batch = (id: string, state = STATUS_RUNNING): FakeBatch => ({
  name: `projects/test-project/locations/us-central1/batches/${id}`,
  state
});

// Pages served by the fake service, keyed by the last page token it receives.
let pages: Record<string, FakePage>;
let apiDisabled: boolean;

// Mirrors BatchService.listBatchAPIService: it calls the setters it receives,
// but rows and page tokens only change when shouldUpdatePagination is true.
const fakeListBatches = async (...args: any[]) => {
  const [setRegion, setProject, renderActions, setBatches, setLoading] = args;
  const [setLoggedIn, setDialogOpen, setPolling, setLink] = args.slice(5);
  const [tokens, setTokens, , shouldUpdatePagination] = args.slice(9);
  setRegion('us-central1');
  setProject('test-project');
  if (apiDisabled) {
    setLink(ENABLE_LINK);
    setDialogOpen(true);
    setPolling(true);
  }
  if (shouldUpdatePagination) {
    const page = pages[tokens[tokens.length - 1] ?? ''];
    setBatches(
      page.batches.map(data => ({
        batchID: data.name.split('/')[5],
        status: data.state,
        location: 'us-central1',
        tier: 'Standard',
        engine: 'Default',
        creationTime: 'Jan 1, 2026',
        elapsedTime: '5 min',
        type: 'PySpark',
        actions: renderActions(data)
      }))
    );
    setTokens(page.next ? [...tokens, page.next] : []);
    setLoading(false);
    setLoggedIn(true);
  }
};

describe('ListBatches', () => {
  let container: HTMLDivElement;
  let root: Root;
  const setLoggedIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    pages = { '': { batches: [batch('batch-a'), batch('batch-b')] } };
    apiDisabled = false;
    listService.mockImplementation(fakeListBatches);
    deleteService.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderList = () =>
    act(async () => {
      root.render(<ListBatches setLoggedIn={setLoggedIn} />);
    });
  const click = async (element: Element | null | undefined) => {
    expect(element).toBeTruthy();
    await act(async () => (element as HTMLElement).click());
  };
  const byText = (selector: string, label: string) =>
    Array.from(container.querySelectorAll(selector)).find(
      element => element.textContent?.trim() === label
    );
  // Batch ID cells, toolbar actions and stub buttons are clicked by label.
  const clickText = (label: string) =>
    click(byText('td, button, .create-batch-overlay', label));
  const text = () => container.textContent;
  const rows = () => Array.from(container.querySelectorAll('tbody tr'));
  const batchIds = () =>
    Array.from(container.querySelectorAll('td.cluster-name')).map(
      cell => cell.textContent
    );
  const pageRange = () =>
    container.querySelector('.page-display-part')?.textContent;
  const pagerButtons = () =>
    Array.from(container.querySelectorAll('.page-move-button'));
  const pagerClasses = () => pagerButtons().map(button => button.className);
  const previousPage = () => click(pagerButtons()[0]);
  const nextPage = () => click(pagerButtons()[1]);
  // listBatchAPIService calls as '[page tokens] update=shouldUpdatePagination'.
  const listRequests = () =>
    listService.mock.calls.map(call => `[${call[9]}] update=${call[12]}`);

  const goToSecondPage = async () => {
    pages = {
      '': { batches: [batch('batch-a'), batch('batch-b')], next: 'tok-1' },
      'tok-1': { batches: [batch('batch-c')] }
    };
    await renderList();
    await nextPage();
    expect(pageRange()).toBe('51 - 51 of 51');
    listService.mockClear();
  };

  describe('initial load', () => {
    it('shows the loading spinner while the first page is being fetched', async () => {
      listService.mockImplementation(() => new Promise(() => undefined));
      await renderList();

      expect(container.querySelector('.spin-loader-main')).not.toBeNull();
      expect(text()).toContain('Loading Batches');
      expect(text()).not.toContain('No rows to display');
      expect(container.querySelector('table')).toBeNull();
    });

    it('fetches the first page on mount and shows "No rows to display" when empty', async () => {
      pages = { '': { batches: [] } };
      await renderList();

      // One call from the view effect and one from the initial load effect.
      expect(listRequests()).toEqual(['[] update=false', '[] update=true']);
      expect(container.querySelector('.no-data-style')?.textContent).toBe(
        'No rows to display'
      );
      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
      expect(container.querySelector('table')).toBeNull();
    });

    it('forwards setLoggedIn to the batch service', async () => {
      await renderList();

      expect(listService.mock.calls[0][5]).toBe(setLoggedIn);
      expect(setLoggedIn).toHaveBeenCalledWith(true);
    });
  });

  describe('batch table', () => {
    it('renders each batch field under its column header', async () => {
      await renderList();

      const header = container.querySelectorAll('th');
      const firstRow = Array.from(rows()[0].querySelectorAll('td')).map(
        (td, i) => `${header[i].textContent}=${td.textContent?.trim()}`
      );
      expect(firstRow).toEqual([
        'Batch ID=batch-a',
        'Status=running',
        'Location=us-central1',
        'Tier=Standard',
        'Engine=Default',
        'Creation time=Jan 1, 2026',
        'Elapsed time=5 min',
        'Type=PySpark',
        'Actions='
      ]);
      expect(batchIds()).toEqual(['batch-a', 'batch-b']);
      expect(text()).toContain('Rows per page: 50');
      expect(pageRange()).toBe('1 - 2 of 2');
      expect(pagerClasses()).toEqual([PAGER_OFF, PAGER_OFF]);
    });

    it('shows the icon or spinner matching each batch status', async () => {
      const expected: Record<string, string> = {
        [STATUS_RUNNING]: 'launcher:cluster-running-icon',
        [STATUS_FAIL]: 'launcher:cluster-error-icon',
        [STATUS_SUCCESS]: 'launcher:succeeded-icon',
        [STATUS_PENDING]: 'spinner',
        [STATUS_CREATING]: 'spinner',
        [STATUS_PROVISIONING]: 'spinner',
        [STATUS_DELETING]: 'spinner',
        '': 'none'
      };
      const states = Object.keys(expected);
      pages = { '': { batches: states.map((s, i) => batch(`id-${i}`, s)) } };
      await renderList();

      const shown = rows().map(row => {
        const cell = row.querySelectorAll('td')[1];
        const icon = cell.querySelector('svg[data-icon]');
        const spinner = cell.querySelector('[data-testid="loader"]');
        const kind = spinner ? 'spinner' : icon?.getAttribute('data-icon');
        return [cell.textContent?.trim(), kind ?? 'none'];
      });
      expect(shown).toEqual(states.map(s => [s.toLowerCase(), expected[s]]));
    });
  });

  describe('views', () => {
    it('opens BatchDetails for the clicked batch ID and returns to the list', async () => {
      await renderList();
      listService.mockClear();

      await clickText('batch-b');
      expect(text()).toContain('Details of batch-b');
      expect(container.querySelector('table')).toBeNull();
      expect(listService).not.toHaveBeenCalled();

      await clickText('Back');
      expect(container.querySelector('.batch-details-stub')).toBeNull();
      expect(batchIds()).toEqual(['batch-a', 'batch-b']);
      expect(listRequests()).toEqual(['[] update=false']);
    });

    it('opens CreateBatch with the region and project and returns on close', async () => {
      await renderList();
      listService.mockClear();

      await clickText('Create Batch');
      expect(text()).toContain('Create batch in us-central1/test-project');
      expect(container.querySelector('table')).toBeNull();
      expect(listService).not.toHaveBeenCalled();

      await clickText('Close');
      expect(container.querySelector('.create-batch-stub')).toBeNull();
      expect(batchIds()).toEqual(['batch-a', 'batch-b']);
      expect(listRequests()).toEqual(['[] update=false', '[] update=false']);
    });

    it.each([
      ['BatchDetails', ['batch-c', 'Submit clone', 'Back']],
      ['CreateBatch', ['Create Batch', 'Submit']]
    ])(
      'resets to the first page after a batch is created from %s',
      async (_view, labels) => {
        await goToSecondPage();
        for (const label of labels) {
          await clickText(label);
        }
        expect(listRequests()).toContain('[] update=true');
        expect(batchIds()).toEqual(['batch-a', 'batch-b']);
        expect(pageRange()).toBe('1 - 2 of 100');
        expect(pagerClasses()).toEqual([PAGER_OFF, PAGER_ON]);
      }
    );
  });

  describe('refresh', () => {
    it('reloads the first page with pagination updates when on page one', async () => {
      await renderList();
      pages[''].batches.unshift(batch('batch-new'));
      listService.mockClear();

      await clickText('Refresh');
      expect(listRequests()).toEqual(['[] update=true']);
      expect(batchIds()).toEqual(['batch-new', 'batch-a', 'batch-b']);
    });

    it('requests the current page without updating pagination on later pages', async () => {
      pages = {
        '': { batches: [batch('batch-a')], next: 'tok-1' },
        'tok-1': { batches: [batch('batch-b')], next: 'tok-2' }
      };
      await renderList();
      await nextPage();
      expect(pageRange()).toBe('51 - 51 of 150');
      listService.mockClear();

      await clickText('Refresh');
      expect(listRequests()).toEqual(['[tok-1] update=false']);
      expect(batchIds()).toEqual(['batch-b']);
      expect(pageRange()).toBe('51 - 51 of 150');
    });
  });

  describe('pagination', () => {
    it('moves between pages and updates the range and disabled buttons', async () => {
      pages = {
        '': { batches: [batch('a'), batch('b'), batch('c')], next: 'tok-1' },
        'tok-1': { batches: [batch('d'), batch('e')] }
      };
      await renderList();
      expect(pageRange()).toBe('1 - 3 of 100');
      expect(pagerClasses()).toEqual([PAGER_OFF, PAGER_ON]);
      listService.mockClear();

      await previousPage();
      expect(listService).not.toHaveBeenCalled();

      await nextPage();
      expect(listRequests()).toEqual(['[tok-1] update=true']);
      expect(batchIds()).toEqual(['d', 'e']);
      expect(pageRange()).toBe('51 - 52 of 52');
      expect(pagerClasses()).toEqual([PAGER_ON, PAGER_OFF]);
      listService.mockClear();

      await nextPage();
      expect(listService).not.toHaveBeenCalled();

      await previousPage();
      expect(listRequests()).toEqual(['[] update=true']);
      expect(batchIds()).toEqual(['a', 'b', 'c']);
      expect(pageRange()).toBe('1 - 3 of 100');
    });
  });

  describe('delete', () => {
    const deleteButton = (row: number) =>
      rows()[row].querySelector('[title="Delete Batch"]');
    const popup = () => container.querySelector('.delete-popup-stub');

    it('disables the delete action for PENDING batches', async () => {
      pages = { '': { batches: [batch('p-1', STATUS_PENDING), batch('r-1')] } };
      await renderList();

      const actions = container.querySelectorAll('.actions-icon');
      expect(actions[0].getAttribute('aria-disabled')).toBe('true');
      expect(deleteButton(0)?.className).toBe(`${DELETE_CLASS}-disable`);
      expect(deleteButton(0)?.querySelector('.icon-delete')).not.toBeNull();
      expect(actions[1].getAttribute('aria-disabled')).toBe('false');
      expect(deleteButton(1)?.className).toBe(DELETE_CLASS);
      expect(deleteButton(1)?.querySelector('.icon-delete')).toBeNull();

      await click(deleteButton(0));
      expect(popup()).toBeNull();
      expect(deleteService).not.toHaveBeenCalled();
    });

    it('deletes the selected batch on confirm and reloads the list', async () => {
      // The next list response no longer contains the deleted batch.
      deleteService.mockImplementation(async () => pages[''].batches.pop());
      await renderList();

      await click(deleteButton(1));
      expect(popup()?.textContent).toContain(
        'This will delete batch-b and cannot be undone.'
      );
      listService.mockClear();

      await clickText('Confirm delete');
      expect(deleteService).toHaveBeenCalledWith('batch-b');
      expect(listRequests()).toEqual(['[] update=true']);
      expect(popup()).toBeNull();
      expect(batchIds()).toEqual(['batch-a']);
    });

    it('closes the popup on cancel without deleting', async () => {
      await renderList();
      await click(deleteButton(0));
      expect(popup()).not.toBeNull();

      await clickText('Cancel delete');
      expect(popup()).toBeNull();
      expect(deleteService).not.toHaveBeenCalled();
    });
  });

  describe('API enable dialog', () => {
    it('shows the enable link and closes on Cancel and on Enable', async () => {
      apiDisabled = true;
      pages = { '': { batches: [] } };
      await renderList();
      const dialog = () => container.querySelector('.api-dialog-stub');

      expect(text()).toContain('No rows to display');
      expect(dialog()?.textContent).toContain(ENABLE_LINK);

      await clickText('Cancel');
      expect(dialog()).toBeNull();

      // Refreshing hits the disabled API again and reopens the dialog.
      await clickText('Refresh');
      expect(dialog()).not.toBeNull();

      await clickText('Enable');
      expect(dialog()).toBeNull();
    });
  });
});
