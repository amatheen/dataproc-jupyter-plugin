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
import CreateBatch from './createBatch';
import { BatchService } from './batchService';
import { authApi } from '../utils/utils';

// const.ts resolves the service URLs at import time.
jest.mock('../handler/handler', () => ({
  requestAPI: jest.fn().mockResolvedValue({ storage_url: 'http://localhost/' })
}));
jest.mock('../utils/utils', () => ({ authApi: jest.fn() }));
jest.mock('../utils/projectService', () => ({ projectListAPI: jest.fn() }));
// Every form control is stubbed as a plain <input> named after its label.
function mockInput(label: string, value: any, onChange: any, off?: boolean) {
  return (
    <input
      aria-label={label.trim()}
      value={value}
      disabled={off}
      onChange={onChange}
    />
  );
}
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Autocomplete: (p: any) => {
    const { label, disabled } = p.renderInput({}).props;
    const show = (v: any) => (v && p.getOptionLabel ? p.getOptionLabel(v) : v);
    const find = (v: string) =>
      p.options.find((o: any) => o === v || o.value === v) ?? (v || null);
    return (
      <div>
        {label}
        {mockInput(
          typeof label === 'string' ? label : label.props.children[0],
          show(p.value) || '',
          (e: any) => p.onChange(e, find(e.target.value)),
          p.disabled || disabled
        )}
      </div>
    );
  }
}));
jest.mock('../controls/MuiWrappedInput', () => ({
  Input: (p: any) => mockInput(p.Label, p.value ?? '', p.onChange, p.disabled)
}));
jest.mock('mui-chips-input', () => ({
  MuiChipsInput: (p: any) =>
    mockInput(p.label, p.value.join(','), (e: any) =>
      p.onChange(e.target.value ? e.target.value.split(',') : [])
    )
}));
jest.mock('../controls/DynamicDropdown', () => ({
  DynamicDropdown: (p: any) =>
    mockInput(p.label, p.value, (e: any) =>
      p.onChange(e, e.target.value || null)
    )
}));
jest.mock('../jobs/labelProperties', () => ({
  __esModule: true,
  default: (p: any) =>
    mockInput(p.buttonText, p.labelDetailUpdated.join('|'), (e: any) => {
      const items = e.target.value ? e.target.value.split('|') : [];
      p.setLabelDetail(items);
      p.setLabelDetailUpdated(items);
    })
}));
jest.mock('../utils/errorPopup', () => ({
  __esModule: true,
  default: (p: any) => (
    <button type="button" className="error-popup" onClick={p.onCancel}>
      {p.errorMsg}
    </button>
  )
}));
jest.mock('../utils/apiErrorPopup', () => ({
  __esModule: true,
  default: (p: any) => (
    <div className="api-dialog">
      {p.enableLink}
      <button type="button" onClick={p.onCancel} />
      <button type="button" onClick={p.onEnable} />
    </div>
  )
}));
// BatchService mocks feed canned data to the component setters.
jest.mock('./batchService', () => {
  // Fills a list and, for new batches, preselects its first entry.
  const load = (list: string[], skip: number) =>
    jest.fn(async (...args: any[]) => {
      const [set, pick, info, done] = args.slice(skip);
      set(list);
      if (!info) {
        pick(list[0]);
      }
      done(false);
    });
  return {
    BatchService: {
      listNetworksAPIService: load(['default', 'net-2'], 0),
      listSubNetworksAPIService: load(['sub-1', 'sub-2'], 1),
      listClustersAPIService: jest.fn(async (set: any) => set(['cluster-1'])),
      listKeyRingsAPIService: jest.fn(async (set: any) => set(['ring-1'])),
      runtimeSharedProjectService: jest.fn(async (host: any, set: any) => {
        host('host-proj');
        set(['shared-1']);
      }),
      listKeysAPIService: jest.fn(async (_r: any, set: any, pick: any) => {
        set(['key-1', 'key-2']);
        pick('key-1');
      }),
      regionListAPIService: jest.fn(
        async (_p: any, _n: any, done: any, _r: any, set: any) => {
          set(['metastore-1']);
          done(false);
        }
      ),
      listNetworksFromSubNetworkAPIService: jest.fn(),
      creatBatchSubmitService: jest.fn()
    }
  };
});
// Deterministic batch ID: 0xabc is padded to "batch-000abc".
Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (a: Uint32Array) => a.fill(0xabc) }
});

const BASE = { regionName: 'us-central1', projectName: 'test-project' };
const PROPS = {
  ...BASE,
  setCreateBatchView: jest.fn(),
  setCreateBatch: jest.fn(),
  setNextPageTokens: jest.fn(),
  setBatchCreatedFromDetails: jest.fn()
};
const CREDENTIALS = { access_token: 'token', project_id: 'test-project' };
const STANDARD = {
  'dataproc.tier': 'standard',
  'spark.dataproc.engine': 'default'
};
const END_USER = { userWorkloadAuthenticationType: 'END_USER_CREDENTIALS' };
const KMS_KEY = 'projects/p/locations/l/keyRings/r/cryptoKeys/k';

describe('CreateBatch submission', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authApi).mockResolvedValue(CREDENTIALS as any);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (props: any = PROPS) => {
    await act(async () => root.render(<CreateBatch {...props} />));
  };
  const field = (label: string) =>
    container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  const type = async (label: string, value: string) => {
    const input = field(label) as HTMLInputElement;
    const proto = Object.getPrototypeOf(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const click = async (element: Element | null | undefined) => {
    await act(async () => (element as HTMLElement).click());
  };
  // MUI radio rendered just before the text that describes it.
  const radio = (label: string) =>
    Array.from(container.querySelectorAll('div'))
      .find(div => !div.children.length && div.textContent?.trim() === label)
      ?.previousElementSibling?.querySelector('input') ?? null;
  // Clicks SUBMIT and returns the payload passed to BatchService.
  const submit = async () => {
    await click(container.querySelector('[aria-label="submit Batch"] div'));
    return jest.mocked(BatchService.creatBatchSubmitService).mock.lastCall?.[1];
  };
  const exec = (payload: any) => payload.environmentConfig.executionConfig;
  const periph = (payload: any) => payload.environmentConfig.peripheralsConfig;
  // A valid Spark form that only needs a main class.
  const renderSpark = async (props: any = PROPS) => {
    await render(props);
    await type('Main class*', 'com.example.Main');
  };

  describe('batch types', () => {
    it('submits a Spark batch with its files, arguments and network tags', async () => {
      await renderSpark();
      await type('Jar files', 'gs://b/a.jar,gs://b/b.jar');
      await type('Files', 'gs://b/f.txt');
      await type('Archive files', 'gs://b/a.zip');
      await type('Arguments', '--x,1');
      await type('Network tags', 'tag');
      await submit();

      expect(BatchService.creatBatchSubmitService).toHaveBeenCalledWith(
        CREDENTIALS,
        {
          sparkBatch: {
            mainClass: 'com.example.Main',
            archiveUris: ['gs://b/a.zip'],
            fileUris: ['gs://b/f.txt'],
            jarFileUris: ['gs://b/a.jar', 'gs://b/b.jar'],
            args: ['--x', '1']
          },
          labels: {},
          name: 'projects/test-project/locations/us-central1/batches/batch-000abc',
          runtimeConfig: { version: '2.2', properties: STANDARD },
          environmentConfig: {
            executionConfig: { subnetworkUri: 'sub-1', networkTags: ['tag'] },
            // New batches always send an empty metastore service.
            peripheralsConfig: { metastoreService: '' }
          }
        },
        'batch-000abc',
        PROPS.setCreateBatchView,
        PROPS.setCreateBatch,
        expect.any(Function),
        { isOpen: false, message: '' },
        expect.any(Function),
        expect.any(Function)
      );
      expect(PROPS.setBatchCreatedFromDetails).toHaveBeenCalledWith(true);
    });

    it('submits the main jar URI, even without the list callbacks', async () => {
      await render(BASE);
      await click(radio('Main jar URI'));
      await type('Main jar*', 'gs://app.jar');
      const { sparkBatch } = await submit();
      expect(sparkBatch).toEqual({ mainJarFileUri: 'gs://app.jar' });
    });

    // Every optional field shown for the selected type gets a value.
    const OPTIONAL: Record<string, string> = {
      'Additional python files': 'gs://p',
      'Jar files': 'gs://j',
      Files: 'gs://f',
      'Archive files': 'gs://a',
      Arguments: '-a',
      'ADD PARAMETER': 'env:prod|day:mon'
    };
    it.each([
      [
        'SparkR',
        'Main R file*',
        'sparkRBatch',
        {
          mainRFileUri: 'gs://m',
          archiveUris: ['gs://a'],
          fileUris: ['gs://f'],
          args: ['-a']
        }
      ],
      [
        'PySpark',
        'Main python file*',
        'pysparkBatch',
        {
          pythonFileUris: ['gs://p'],
          mainPythonFileUri: 'gs://m',
          archiveUris: ['gs://a'],
          fileUris: ['gs://f'],
          jarFileUris: ['gs://j'],
          args: ['-a']
        }
      ],
      [
        'SparkSql',
        'Query file*',
        'sparkSqlBatch',
        {
          queryFileUri: 'gs://m',
          queryVariables: { env: 'prod', day: 'mon' },
          jarFileUris: ['gs://j']
        }
      ]
    ])('submits a %s batch', async (batchType, mainLabel, key, expected) => {
      await render();
      await type('Batch type*', batchType);
      await type(mainLabel, 'gs://m');
      for (const [label, value] of Object.entries(OPTIONAL)) {
        if (field(label)) {
          await type(label, value);
        }
      }
      expect((await submit())[key]).toEqual(expected);
    });
  });

  describe('runtime and execution options', () => {
    it('submits the container image, runtime, tier, properties and labels', async () => {
      await renderSpark();
      await type('Custom container image', 'gcr.io/p/img:1');
      await type('Runtime version*', '2.3');
      await type('ADD PROPERTY', 'spark.executor.cores:4|spark.repo:gs://r');
      await click(radio('Premium'));
      await type('ADD LABEL', 'team:data|env:dev');
      const { runtimeConfig, labels } = await submit();

      expect(runtimeConfig).toEqual({
        version: '2.3',
        containerImage: 'gcr.io/p/img:1',
        properties: {
          'dataproc.tier': 'premium',
          'spark.dataproc.engine': 'lightningEngine',
          'spark.executor.cores': '4',
          'spark.repo': 'gs://r'
        }
      });
      expect(labels).toEqual({ team: 'data', env: 'dev' });

      // A cleared runtime version is submitted as-is.
      await type('Runtime version*', '');
      expect((await submit()).runtimeConfig.version).toBe('');
    });

    it('submits end-user credentials or a service account', async () => {
      await renderSpark();
      await click(radio('User Account'));
      expect(field('Service account')).toBeNull();
      expect(exec(await submit())).toEqual({
        authenticationConfig: END_USER,
        subnetworkUri: 'sub-1'
      });

      await type('Service account for system operations', 'ops@p.iam');
      expect(exec(await submit())).toEqual({
        authenticationConfig: END_USER,
        serviceAccount: 'ops@p.iam',
        subnetworkUri: 'sub-1'
      });

      await click(radio('Service Account'));
      await type('Service account', 'sa@p.iam');
      expect(exec(await submit())).toEqual({
        serviceAccount: 'sa@p.iam',
        subnetworkUri: 'sub-1'
      });
    });

    it('submits the chosen project subnetwork or shared VPC subnetwork', async () => {
      await renderSpark();
      await type('Primary network*', 'net-2');
      await type('Subnetwork*', 'sub-2');
      // Cleared dropdowns keep their previous selection.
      await type('Primary network*', '');
      await type('Subnetwork*', '');
      expect(exec(await submit())).toEqual({ subnetworkUri: 'sub-2' });

      await click(container.querySelector('[value="sharedVpc"]'));
      await type('Shared subnetwork', 'shared-1');
      await type('Shared subnetwork', '');
      expect(exec(await submit())).toEqual({
        subnetworkUri:
          'projects/host-proj/regions/us-central1/subnetworks/shared-1'
      });
    });

    it('submits a KMS key from a key ring or a manual entry', async () => {
      await renderSpark();
      await click(radio('Customer-managed encryption key (CMEK)'));
      await type('Key rings', 'ring-1');
      await type('Keys', 'key-2');
      await type('Key rings', '');
      await type('Keys', '');
      expect(exec(await submit()).kmsKey).toBe(
        'projects/test-project/locations/us-central1/keyRings/ring-1/cryptoKeys/key-2'
      );

      await click(container.querySelector('.encrypt input'));
      await type('Enter key manually', KMS_KEY);
      expect(exec(await submit()).kmsKey).toBe(KMS_KEY);

      await click(radio('Google-managed encryption key'));
      expect(exec(await submit())).toEqual({ subnetworkUri: 'sub-1' });
    });
  });

  describe('peripherals', () => {
    it('loads and submits the metastore service of the selected project', async () => {
      jest
        .mocked(BatchService.regionListAPIService)
        .mockImplementationOnce(async (_p, _n, setLoading) => setLoading(true));
      await renderSpark();
      await type('Project ID', 'meta-proj');
      expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
      expect(field('Metastore services')).toBeNull();

      await type('Project ID', 'meta-proj-2');
      const { lastCall } = jest.mocked(BatchService.regionListAPIService).mock;
      expect(lastCall?.slice(0, 2)).toEqual(['meta-proj-2', 'default']);
      await type('Metastore services', 'metastore-1');
      await type('Metastore services', '');
      expect(periph(await submit())).toEqual({
        metastoreService: 'metastore-1'
      });

      // Clearing the project resets the chosen service.
      await type('Project ID', '');
      expect(field('Metastore services')?.value).toBe('');
    });

    it('submits the history server cluster until it is cleared', async () => {
      await renderSpark();
      await type('History server cluster', 'cluster-1');
      expect(periph(await submit())).toEqual({
        metastoreService: '',
        sparkHistoryServerConfig: {
          dataprocCluster:
            'projects/test-project/regions/us-central1/clusters/cluster-1'
        }
      });

      await type('History server cluster', '');
      expect(periph(await submit())).toEqual({ metastoreService: '' });
    });
  });

  describe('submission side effects', () => {
    it('skips the request without credentials and keeps the details flag', async () => {
      jest.mocked(authApi).mockResolvedValueOnce(undefined);
      await renderSpark({ ...PROPS, batchCreatedFromDetails: true });
      await submit();

      expect(PROPS.setBatchCreatedFromDetails).not.toHaveBeenCalled();
      expect(PROPS.setNextPageTokens).toHaveBeenCalledWith([]);
      expect(BatchService.creatBatchSubmitService).not.toHaveBeenCalled();
    });

    it('shows the error popup and the API enable dialog from the service', async () => {
      const service = jest.mocked(BatchService.creatBatchSubmitService);
      const openDialog = async (...args: any[]) => {
        args[7](true);
        args[8]('https://console.cloud.google.com/apis/enable');
      };
      service
        .mockImplementationOnce(async (...args: any[]) =>
          args[5]({ isOpen: true, message: 'Quota exceeded' })
        )
        .mockImplementationOnce(openDialog)
        .mockImplementationOnce(openDialog);
      const popup = () => container.querySelector('.error-popup');
      const dialog = () => container.querySelector('.api-dialog');
      await renderSpark();

      await submit();
      expect(popup()?.textContent).toBe('Quota exceeded');
      await click(popup());
      expect(popup()).toBeNull();

      await submit();
      expect(dialog()?.textContent).toContain('/apis/enable');
      await click(dialog()?.querySelector('button'));
      expect(dialog()).toBeNull();

      await submit();
      await click(dialog()?.querySelector('button:last-child'));
      expect(dialog()).toBeNull();
    });
  });
});
