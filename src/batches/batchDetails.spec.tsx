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
import BatchDetails from './batchDetails';
import { BatchService } from './batchService';
import CreateBatch from './createBatch';
import PollingTimer from '../utils/pollingTimer';
import { jobTimeFormat } from '../utils/utils';

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
    getBatchDetailsService: jest.fn(),
    deleteBatchAPIService: jest.fn()
  }
}));

jest.mock('../utils/pollingTimer', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('./createBatch', () => ({
  __esModule: true,
  default: jest.fn(({ setCreateBatch }: any) => (
    <button onClick={() => setCreateBatch(false)}>Close CreateBatch</button>
  ))
}));

jest.mock('../utils/viewLogs', () => ({
  __esModule: true,
  default: ({ batchInfoResponse }: any) => (
    <div data-testid="mock-view-logs">{batchInfoResponse.uuid}</div>
  )
}));

jest.mock('../utils/deletePopup', () => ({
  __esModule: true,
  default: ({ onCancel, onDelete, DeleteMsg }: any) => (
    <div data-testid="mock-delete-popup">
      {DeleteMsg}
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onDelete}>Delete</button>
    </div>
  )
}));

type DetailsService = typeof BatchService.getBatchDetailsService;
const mockGetBatchDetails = jest.mocked(BatchService.getBatchDetailsService);
const mockDeleteBatch = jest.mocked(BatchService.deleteBatchAPIService);
const mockPollingTimer = jest.mocked(PollingTimer);
const mockCreateBatch = jest.mocked(CreateBatch);

// Source-caused warnings: unkeyed list items, LabIcons redefined in render.
const SOURCE_WARNINGS = /unique "key" prop|Cannot update a component/;

const BATCH_ID = 'batch-123';
const SA = 'runner@test-project.iam.gserviceaccount.com';
const NETWORK = 'projects/test-project/global/networks/vpc';
const METASTORE = 'projects/test-project/locations/us-central1/services/hms';
const PHS = 'projects/test-project/regions/us-central1/clusters/phs';
const KMS_KEY = 'projects/p/locations/us-central1/keyRings/kr/cryptoKeys/k';
const SHS_URL = 'https://phs.example.com/sparkhistory/';
const IMAGE = 'us-docker.pkg.dev/test-project/spark/custom:1.0';
const JARS = ['gs://b/app.jar', 'gs://b/lib.jar'];
const TIER = 'dataproc:dataproc.tier';
const ENGINE = 'spark:spark.dataproc.engine';
const NOT_FOUND = { error: { code: 404, message: 'Batch not found' } };

// A batch resource as returned by the Dataproc batches.get API.
const makeBatch = (
  overrides: Record<string, unknown> = {},
  batchType: Record<string, unknown> = {
    sparkBatch: { mainClass: 'com.example.Job', jarFileUris: JARS }
  }
) => ({
  uuid: 'uuid-123',
  state: 'SUCCEEDED',
  createTime: '2024-01-15T10:00:00Z',
  stateTime: '2024-01-15T10:05:30Z',
  creator: 'user@example.com',
  runtimeInfo: {
    endpoints: {},
    approximateUsage: {
      milliDcuSeconds: '7200000',
      shuffleStorageGbSeconds: '5184000'
    }
  },
  runtimeConfig: {
    version: '2.2',
    properties: { 'spark:spark.executor.instances': '2' }
  },
  environmentConfig: {
    executionConfig: { serviceAccount: SA, subnetworkUri: 'default' },
    peripheralsConfig: { sparkHistoryServerConfig: {} }
  },
  stateHistory: [
    { state: 'PENDING', stateStartTime: '2024-01-15T10:00:00Z' },
    { state: 'RUNNING', stateStartTime: '2024-01-15T10:01:00Z' }
  ],
  ...batchType,
  ...overrides
});

// Mirrors BatchService.getBatchDetailsService once batches.get responds.
const respondWith =
  (res: any): DetailsService =>
  async (setRegion, setProject, _id, setBatch, setLabels, setLoad, setErr) => {
    setRegion('us-central1');
    setProject('test-project');
    if (res.error?.code === 404) {
      setErr(true);
    }
    setBatch(res);
    if (res.labels) {
      setLabels(Object.entries(res.labels).map(([k, v]) => `${k}:${v}`));
    }
    setLoad(false);
  };
const pending: DetailsService = () => new Promise<void>(() => undefined);

// [batch field, its payload, displayed batch type, expected detail rows]
const TYPE_CASES: [string, object, string, Record<string, unknown>][] = [
  [
    'sparkBatch',
    { mainClass: 'com.example.Job', jarFileUris: JARS, args: ['1000'] },
    'Spark',
    { 'Main class': 'com.example.Job', 'Jar files': JARS, Arguments: ['1000'] }
  ],
  [
    'pysparkBatch',
    { mainPythonFileUri: 'gs://b/etl.py', pythonFileUris: ['gs://b/u.py'] },
    'PySpark',
    { 'Main python file': 'gs://b/etl.py', 'Python files': ['gs://b/u.py'] }
  ],
  [
    'sparkRBatch',
    { mainRFileUri: 'gs://b/r.R', fileUris: ['gs://b/x'], archiveUris: [] },
    'SparkR',
    { 'Main R file': 'gs://b/r.R', Files: ['gs://b/x'], Archives: [] }
  ],
  [
    'sparkSqlBatch',
    { queryFileUri: 'gs://b/q.sql', queryVariables: { env: 'dev' } },
    'SparkSQL',
    { 'Query file': 'gs://b/q.sql', 'Script variables': undefined, env: 'dev' }
  ]
];

describe('BatchDetails', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: jest.SpyInstance;
  const setDetailedBatchView = jest.fn();
  const setBatchCreatedFromDetails = jest.fn();
  const fakeTimer = {} as NodeJS.Timeout;

  beforeEach(() => {
    jest.clearAllMocks();
    const realError = console.error;
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((message, ...args) => {
        if (!SOURCE_WARNINGS.test(String(message))) {
          realError(message, ...args);
        }
      });
    mockPollingTimer.mockReturnValue(fakeTimer);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  const renderDetails = (impl: DetailsService = respondWith(makeBatch())) => {
    mockGetBatchDetails.mockImplementation(impl);
    return act(async () => {
      root.render(
        <BatchDetails
          batchSelected={BATCH_ID}
          setDetailedBatchView={setDetailedBatchView}
          setCreateBatchView={jest.fn()}
          batchCreatedFromDetails={false}
          setBatchCreatedFromDetails={setBatchCreatedFromDetails}
        />
      );
    });
  };
  const runPoll = () => act(async () => mockPollingTimer.mock.calls[0][0]());
  const click = (element: Element | null | undefined) =>
    act(async () => (element as HTMLElement).click());
  const findByText = (selector: string, text: string) =>
    Array.from(container.querySelectorAll(selector)).find(
      el => el.textContent === text
    );
  const button = (text: string) => findByText('button', text);
  const action = (text: string) => findByText('.action-cluster-text', text);
  const byTestId = (id: string) =>
    container.querySelector(`[data-testid="${id}"]`);
  const status = () => container.querySelector('.cluster-status')?.textContent;
  const labels = () =>
    Array.from(container.querySelectorAll('.row-details > :first-child'));
  const labelEl = (text: string) =>
    labels().find(el => el.textContent === text);
  const hasLabel = (text: string) => labelEl(text) !== undefined;
  const rowValue = (text: string) =>
    labelEl(text)?.nextElementSibling?.textContent?.trim();
  const rowItems = (text: string) =>
    Array.from(labelEl(text)?.nextElementSibling?.children ?? []).map(
      el => el.textContent
    );
  const labelsBetween = (from: string, to: string) => {
    const texts = labels().map(el => el.textContent);
    return texts.slice(texts.indexOf(from) + 1, texts.indexOf(to));
  };
  const expectRows = (expected: Record<string, unknown>) =>
    Object.entries(expected).forEach(([label, value]) => {
      const actual = Array.isArray(value) ? rowItems(label) : rowValue(label);
      expect(actual).toEqual(value);
    });

  describe('loading and not-found states', () => {
    it('shows a spinner while the batch details request is pending', async () => {
      await renderDetails(pending);
      expect(mockGetBatchDetails.mock.calls[0][2]).toBe(BATCH_ID);
      expect(byTestId('loader')).not.toBeNull();
      expect(container.textContent).toBe('Loading Batch Details');
    });

    it('shows the not-found view for a 404 and goes back from its arrow', async () => {
      await renderDetails(respondWith(NOT_FOUND));
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        'Unable to find the resource you requested'
      );
      expect(byTestId('loader')).toBeNull();
      expect(container.querySelector('.scroll')).toBeNull();

      await click(container.querySelector('[aria-label="back-arrow-icon"]'));
      expect(setDetailedBatchView).toHaveBeenCalledWith(false);
    });
  });

  describe('polling', () => {
    it('polls the batch details while mounted and stops on unmount', async () => {
      await renderDetails();
      const poll = mockPollingTimer.mock.calls[0][0];
      expect(mockPollingTimer).toHaveBeenCalledWith(poll, false, undefined);
      await runPoll();
      expect(mockGetBatchDetails).toHaveBeenCalledTimes(2);
      act(() => root.unmount());
      expect(mockPollingTimer).toHaveBeenCalledTimes(2);
      expect(mockPollingTimer).toHaveBeenLastCalledWith(poll, true, fakeTimer);
    });
  });

  describe('tier and engine', () => {
    const withProperties = (properties: Record<string, string>) =>
      respondWith(makeBatch({ runtimeConfig: { version: '2.2', properties } }));
    const tierAndEngine = () => [rowValue('Tier'), rowValue('Engine')];

    it('default to Standard and Default when the properties omit them', async () => {
      await renderDetails();
      expect(tierAndEngine()).toEqual(['Standard', 'Default']);
    });

    it('are derived from the properties, falling back for unknown values', async () => {
      await renderDetails(
        withProperties({ [TIER]: 'premium', [ENGINE]: 'lightningEngine' })
      );
      expect(tierAndEngine()).toEqual(['Premium', 'Lightning Engine']);

      mockGetBatchDetails.mockImplementation(
        withProperties({ [TIER]: 'enterprise', [ENGINE]: 'turbo' })
      );
      await runPoll();
      expect(tierAndEngine()).toEqual(['Standard', 'Default']);
    });
  });

  describe('header actions', () => {
    it('shows the batch id and goes back from the header arrow', async () => {
      await renderDetails();
      const header = container.querySelector('.scroll-fix-header');
      expect(header?.textContent).toContain(BATCH_ID);
      await click(header?.querySelector('.back-arrow-icon'));
      expect(setDetailedBatchView).toHaveBeenCalledWith(false);
    });

    it('opens CreateBatch with the batch on CLONE and returns when it closes', async () => {
      const batch = makeBatch();
      await renderDetails(respondWith(batch));
      await click(action('CLONE'));
      expect(container.querySelector('.scroll')).toBeNull();
      expect(mockCreateBatch.mock.lastCall?.[0]).toMatchObject({
        batchInfoResponse: batch,
        regionName: 'us-central1',
        projectName: 'test-project',
        createBatch: true,
        batchCreatedFromDetails: false,
        setBatchCreatedFromDetails
      });

      await click(button('Close CreateBatch'));
      expect(rowValue('Batch ID')).toBe(BATCH_ID);
    });

    it('closes the delete popup on cancel and deletes the batch on confirm', async () => {
      await renderDetails();
      await click(action('DELETE'));
      expect(byTestId('mock-delete-popup')?.textContent).toContain(
        `This will delete ${BATCH_ID} and cannot be undone.`
      );

      await click(button('Cancel'));
      expect(byTestId('mock-delete-popup')).toBeNull();
      expect(mockDeleteBatch).not.toHaveBeenCalled();
      expect(setDetailedBatchView).not.toHaveBeenCalled();

      await click(action('DELETE'));
      await click(button('Delete'));
      expect(mockDeleteBatch).toHaveBeenCalledWith(BATCH_ID);
      expect(setDetailedBatchView).toHaveBeenCalledWith(false);
      expect(byTestId('mock-delete-popup')).toBeNull();
    });
  });

  describe('overview', () => {
    it('renders the summary, status, timing and usage rows', async () => {
      await renderDetails();
      expect(status()).toBe('succeeded');
      expectRows({
        'Batch ID': BATCH_ID,
        'Batch UUID': 'uuid-123',
        'Resource type': 'Batch',
        'Start time': jobTimeFormat(makeBatch().createTime),
        'Elapsed time': '5 min 30 sec',
        'Run time': '4 min 30 sec',
        'Approximate DCU usage': '~ 2.000 DCU-hours',
        'Approximate shuffle storage usage': '~ 2.000 GB-months',
        Creator: 'user@example.com',
        Version: '2.2',
        Region: 'us-central1'
      });
      expect(byTestId('mock-view-logs')?.textContent).toBe('uuid-123');
    });

    it('omits run time, usage, image and endpoint rows not yet reported', async () => {
      const batch = makeBatch({ state: 'PENDING', runtimeInfo: {} });
      await renderDetails(respondWith({ ...batch, stateHistory: undefined }));
      expect(status()).toBe('pending');
      expect(labelsBetween('Start time', 'Creator')).toEqual(['Elapsed time']);
      expect(hasLabel('Image') || hasLabel('End Points')).toBe(false);
    });
  });

  describe('batch type details', () => {
    it.each(TYPE_CASES)('shows %s fields', async (key, fields, type, rows) => {
      await renderDetails(respondWith(makeBatch({}, { [key]: fields })));
      expect(rowValue('Batch type')).toBe(type);
      expect(labelsBetween('Batch type', 'Properties')).toEqual(
        Object.keys(rows)
      );
      expectRows(rows);
    });
  });

  describe('runtime config', () => {
    it('lists the image, every property and the History Server endpoint', async () => {
      const properties = {
        'spark:spark.executor.instances': '2',
        'spark:spark.driver.memory': '4g'
      };
      const batch = makeBatch({
        runtimeInfo: { endpoints: { 'Spark History Server': SHS_URL } },
        runtimeConfig: { version: '2.2', containerImage: IMAGE, properties }
      });
      await renderDetails(respondWith(batch));
      expect(labelsBetween('Image', 'End Points')).toEqual([
        'Properties',
        ...Object.keys(properties)
      ]);
      expectRows({ Image: IMAGE, ...properties });
      expect(rowValue('Spark History Server')).toBe(SHS_URL);
    });
  });

  describe('environment config', () => {
    const withEnvironment = (executionConfig: object, peripheralsConfig = {}) =>
      respondWith(
        makeBatch({ environmentConfig: { executionConfig, peripheralsConfig } })
      );
    const executionLabels = () =>
      labelsBetween('Execution config', 'Encryption type');

    it('shows the service account, subnetwork and Google-managed encryption', async () => {
      await renderDetails();
      expect(executionLabels()).toEqual(['Service account', 'Sub network']);
      expectRows({ 'Service account': SA, 'Sub network': 'default' });
      expect(rowValue('Encryption type')).toBe('Google-managed');
      expect(hasLabel('Encryption key')).toBe(false);
    });

    it('shows network, network tags and a customer-managed key only', async () => {
      const executionConfig = {
        serviceAccount: SA,
        networkUri: NETWORK,
        networkTags: ['allow-ssh', 'spark'],
        kmsKey: KMS_KEY
      };
      await renderDetails(withEnvironment(executionConfig));
      expect(executionLabels()).toEqual([
        'Service account',
        'Network',
        'Network tags'
      ]);
      expectRows({
        Network: NETWORK,
        'Network tags': ['allow-ssh', 'spark'],
        'Encryption type': 'Customer-managed',
        'Encryption key': KMS_KEY
      });
    });

    const MS = { metastoreService: METASTORE };
    const HS = { sparkHistoryServerConfig: { dataprocCluster: PHS } };
    it.each([
      ['a metastore and a history server', { ...MS, ...HS }, METASTORE, PHS],
      ['a history server only', HS, undefined, PHS],
      ['a metastore only', MS, METASTORE, undefined],
      ['nothing configured', {}, undefined, undefined],
      ['only an unrecognised entry', { futureConfig: {} }, undefined, undefined]
    ])('shows peripherals with %s', async (_, config, metastore, cluster) => {
      await renderDetails(withEnvironment({}, config));
      expect(hasLabel('Peripherals config')).toBe(!!(metastore || cluster));
      expect(rowValue('Metastore service')).toBe(metastore);
      expect(hasLabel('Spark History Server')).toBe(!!cluster);
      expect(rowValue('Dataproc cluster')).toBe(cluster);
    });
  });

  describe('labels', () => {
    it.each([
      [{ env: 'dev', team: 'data' }, ['env : dev', 'team : data']],
      [undefined, []]
    ])('renders "key : value" chips for labels %j', async (labelMap, chips) => {
      await renderDetails(respondWith(makeBatch({ labels: labelMap })));
      const rendered = container.querySelectorAll('.job-label-style');
      expect(Array.from(rendered, el => el.textContent)).toEqual(chips);
    });
  });
});
