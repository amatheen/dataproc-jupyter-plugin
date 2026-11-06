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
import * as C from '../utils/const';

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
// BatchService mocks feed canned data to the component setters.
const mockData: Record<string, string[]> = {};
jest.mock('./batchService', () => {
  // Fills a list and, for new batches, preselects its first entry.
  const load = (key: string, skip: number) =>
    jest.fn(async (...args: any[]) => {
      const [set, pick, info, done] = args.slice(skip);
      set(mockData[key]);
      if (!info && mockData[key].length) {
        pick(mockData[key][0]);
      }
      done(false);
    });
  return {
    BatchService: {
      listNetworksAPIService: load('networks', 0),
      listSubNetworksAPIService: load('subnets', 1),
      listClustersAPIService: jest.fn(async (set: any) => set(['cluster-1'])),
      listKeyRingsAPIService: jest.fn(async (set: any) => set(['ring-1'])),
      runtimeSharedProjectService: jest.fn(async (host: any, set: any) => {
        host('host-proj');
        set(mockData.shared);
      }),
      listKeysAPIService: jest.fn(async (_r: any, set: any, pick: any) => {
        set(['key-1', 'key-2']);
        pick('key-1');
      }),
      listNetworksFromSubNetworkAPIService: jest.fn(),
      regionListAPIService: jest.fn(),
      creatBatchSubmitService: jest.fn()
    }
  };
});
// Deterministic batch ID: 0xabc is padded to "batch-000abc".
Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (a: Uint32Array) => a.fill(0xabc) }
});

const BASE = { regionName: 'us-central1', projectName: 'test-project' };
const KMS_KEY = 'projects/p/locations/l/keyRings/r/cryptoKeys/k';

describe('CreateBatch form', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockData, {
      networks: ['default', 'net-2'],
      subnets: ['sub-1', 'sub-2'],
      shared: ['shared-1']
    });
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (props: any = {}) => {
    await act(async () => root.render(<CreateBatch {...BASE} {...props} />));
  };
  const field = (label: string) =>
    container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  const missing = (...labels: string[]) => labels.filter(l => !field(l));
  const present = (...labels: string[]) => labels.filter(l => field(l));
  // Error or helper text rendered right after a field.
  const hint = (label: string) =>
    field(label)?.parentElement?.nextElementSibling?.textContent?.trim();
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
  const canSubmit = () => !!container.querySelector('.submit-button-style');
  const text = () => container.textContent;

  describe('rendering', () => {
    it('shows the generated ID, region, defaults and the loaded networks', async () => {
      await render();

      expect(text()).toContain('Create batch');
      expect(field('Batch ID*')?.value).toBe('batch-000abc');
      expect(field('Region*')?.value).toBe('us-central1');
      expect(field('Region*')?.disabled).toBe(true);
      expect(field('Batch type*')?.value).toBe('Spark');
      expect(field('Runtime version*')?.value).toBe(
        '2.2 LTS (Spark 3.5, Java 17, Scala 2.13)'
      );
      expect(radio('Main class')?.checked).toBe(true);
      expect(missing('Main class*', 'Jar files', 'Files')).toEqual([]);
      expect(present('Main jar*', 'Main R file*', 'Query file*')).toEqual([]);
      expect(field('Primary network*')?.value).toBe('default');
      expect(field('Subnetwork*')?.value).toBe('sub-1');
      expect(text()).toContain('shared from host project: "host-proj"');
      expect(radio('Service Account')?.checked).toBe(true);
      expect(radio('Google-managed encryption key')?.checked).toBe(true);
      expect(field('ADD PROPERTY')?.value).toBe(
        'dataproc.tier:standard|spark.dataproc.engine:default'
      );

      // The main class is still missing, so SUBMIT does nothing.
      expect(canSubmit()).toBe(false);
      await click(container.querySelector('[aria-label="submit Batch"] div'));
      expect(authApi).not.toHaveBeenCalled();
      expect(BatchService.creatBatchSubmitService).not.toHaveBeenCalled();
    });

    it.each([
      [
        'SparkR',
        ['Main R file*', 'Files', 'Archive files', 'Arguments'],
        ['Jar files', 'Query file*', 'ADD PARAMETER']
      ],
      [
        'PySpark',
        ['Main python file*', 'Additional python files', 'Jar files'],
        ['Main R file*', 'Query file*', 'ADD PARAMETER']
      ],
      [
        'SparkSql',
        ['Query file*', 'Jar files', 'ADD PARAMETER'],
        ['Files', 'Archive files', 'Arguments', 'Main python file*']
      ]
    ])('shows only the %s fields', async (batchType, shown, hidden) => {
      await render();
      await type('Batch type*', batchType);

      expect(field('Batch type*')?.value).toBe(batchType);
      expect(radio('Main class')).toBeNull();
      expect(missing(...shown)).toEqual([]);
      expect(present(...hidden, 'Main class*')).toEqual([]);
    });

    it('clears entered files on a type change, even if the type is cleared', async () => {
      await render();
      await type('Files', 'gs://b/f.txt');
      await type('Batch type*', 'PySpark');
      expect(field('Files')?.value).toBe('');

      await type('Main python file*', 'gs://b/main.py');
      await type('Batch type*', '');
      expect(field('Batch type*')?.value).toBe('PySpark');
      expect(field('Main python file*')?.value).toBe('');
    });
  });

  describe('validation', () => {
    it('requires a batch ID and a main class', async () => {
      await render();
      await type('Main class*', 'com.example.Main');
      expect(canSubmit()).toBe(true);

      await type('Batch ID*', '');
      expect(hint('Batch ID*')).toBe('ID is required');
      expect(canSubmit()).toBe(false);

      await type('Batch ID*', 'my-batch');
      expect(text()).not.toContain('ID is required');
      expect(canSubmit()).toBe(true);

      await type('Main class*', '');
      expect(hint('Main class*')).toBe('Main class is required');
      expect(canSubmit()).toBe(false);
    });

    it('validates the main jar URI and requires it after switching back', async () => {
      await render();
      await click(radio('Main jar URI'));
      expect(field('Main class*')).toBeNull();

      await type('Main jar*', 'app.jar');
      expect(hint('Main jar*')).toContain('must include a valid scheme prefix');
      expect(canSubmit()).toBe(false);

      await type('Main jar*', 'gs://b/app.jar');
      expect(hint('Main jar*')).toBeUndefined();
      expect(canSubmit()).toBe(true);

      await click(radio('Main class'));
      expect(field('Main class*')?.value).toBe('');
      await click(radio('Main jar URI'));
      expect(field('Main jar*')?.value).toBe('');
      expect(hint('Main jar*')).toBe('Main jar is required');
    });

    it.each([
      ['SparkR', 'Main R file*'],
      ['PySpark', 'Main python file*'],
      ['SparkSql', 'Query file*']
    ])('validates the scheme of the %s "%s"', async (batchType, label) => {
      await render();
      await type('Batch type*', batchType);
      expect(canSubmit()).toBe(false); // the main file is required
      await type(label, 'bucket/main');
      expect(hint(label)).toContain('File must include a valid scheme prefix');
      expect(canSubmit()).toBe(false);

      await type(label, 'gs://bucket/main');
      expect(hint(label)).toBe(C.QUERY_FILE_MESSAGE);
      expect(canSubmit()).toBe(true);
    });

    it.each([
      ['Jar files', C.JAR_FILE_MESSAGE],
      ['Files', C.FILES_MESSAGE],
      ['Archive files', C.ARCHIVE_FILES_MESSAGE],
      ['Additional python files', '']
    ])('flags bad schemes and duplicate paths in "%s"', async (label, help) => {
      await render();
      await type('Batch type*', 'PySpark');
      await type('Main python file*', 'gs://b/main.py');

      await type(label, 'gs://b/one,bucket/two');
      expect(hint(label)).toContain('All files must include a valid scheme');
      expect(canSubmit()).toBe(false);

      // Duplicates are detected case-insensitively.
      await type(label, 'gs://b/One,gs://b/one');
      expect(hint(label)).toBe('Duplicate paths are not allowed');
      expect(canSubmit()).toBe(false);

      await type(label, '');
      expect(hint(label)).toBe(help);
      expect(canSubmit()).toBe(true);
    });

    it.each([
      ['Arguments', C.ARGUMENTS_MESSAGE],
      ['Network tags', C.NETWORK_TAG_MESSAGE]
    ])('flags duplicate %s', async (label, help) => {
      await render();
      await type('Main class*', 'com.example.Main');
      await type(label, 'tag-a,TAG-A');
      expect(hint(label)).toBe('Duplicate paths are not allowed');
      expect(canSubmit()).toBe(false);

      await type(label, 'tag-a,tag-b');
      expect(hint(label)).toBe(help);
      expect(canSubmit()).toBe(true);
    });
  });

  describe('network, encryption and tier', () => {
    const sharedVpc = () => container.querySelector('[value="sharedVpc"]');

    it('switches between project networks and shared VPC subnetworks', async () => {
      await render();
      await type('Main class*', 'com.example.Main');
      await click(sharedVpc());
      expect(field('Primary network*')).toBeNull();
      expect(field('Shared subnetwork')?.value).toBe('');
      expect(canSubmit()).toBe(false);

      await type('Shared subnetwork', 'shared-1');
      expect(canSubmit()).toBe(true);

      await click(radio('Networks in this project'));
      expect(field('Shared subnetwork')).toBeNull();
      expect(field('Primary network*')?.value).toBe('default');
    });

    it.each([
      ['networks', 'No local networks are available.'],
      ['subnets', 'Please select a valid network and subnetwork.'],
      ['shared', 'No shared subnetworks are available in this region.']
    ])('blocks submission when no %s are found', async (key, message) => {
      mockData[key] = [];
      await render();
      await type('Main class*', 'com.example.Main');
      if (key === 'shared') {
        await click(sharedVpc());
      }
      expect(text()).toContain(message);
      expect(canSubmit()).toBe(false);
    });

    it('requires a key ring or a valid manual key for CMEK', async () => {
      await render();
      await type('Main class*', 'com.example.Main');
      await click(radio('Customer-managed encryption key (CMEK)'));
      expect(field('Enter key manually')?.disabled).toBe(true);
      expect(canSubmit()).toBe(false);

      await type('Key rings', 'ring-1');
      expect(field('Keys')?.value).toBe('key-1');
      expect(canSubmit()).toBe(true);

      await click(container.querySelector('.encrypt input'));
      expect(field('Key rings')?.value).toBe('');
      expect(field('Keys')?.disabled).toBe(true);
      expect(canSubmit()).toBe(false);

      await type('Enter key manually', 'my-key');
      expect(text()).toContain(C.KEY_MESSAGE);
      await type('Enter key manually', KMS_KEY);
      expect(text()).not.toContain(C.KEY_MESSAGE);
      expect(canSubmit()).toBe(true);

      await click(container.querySelector('.create-batch-encrypt input'));
      expect(field('Enter key manually')?.value).toBe('');
      expect(field('Enter key manually')?.disabled).toBe(true);

      await click(radio('Google-managed encryption key'));
      expect(field('Key rings')).toBeNull();
      expect(canSubmit()).toBe(true);
    });

    it('enables Lightning Engine only for the Premium tier', async () => {
      await render();
      const lightning = () =>
        container.querySelector<HTMLInputElement>('[name="lightningEngine"]');
      const properties = () => field('ADD PROPERTY')?.value;
      expect(lightning()?.disabled).toBe(true);

      // Empty rows from the properties editor are dropped on tier changes.
      await type('ADD PROPERTY', 'spark.a:1|');
      await click(radio('Premium'));
      expect(lightning()?.checked).toBe(true);
      expect(properties()).toBe(
        'dataproc.tier:premium|spark.dataproc.engine:lightningEngine|spark.a:1'
      );

      await click(lightning());
      expect(properties()).toBe(
        'dataproc.tier:premium|spark.dataproc.engine:default|spark.a:1'
      );

      await click(radio('Standard'));
      expect(lightning()?.checked).toBe(false);
      expect(lightning()?.disabled).toBe(true);
      expect(properties()).toBe(
        'dataproc.tier:standard|spark.dataproc.engine:default|spark.a:1'
      );
    });
  });

  describe('navigation and links', () => {
    it.each(['setCreateBatchView', 'setCreateBatch'])(
      'calls only the provided %s from the back arrow and Cancel',
      async name => {
        const close = jest.fn();
        await render({ [name]: close });
        await click(container.querySelector('.back-arrow-icon'));
        await click(container.querySelector('[aria-label="cancel Batch"] div'));
        expect(close.mock.calls).toEqual([[false], [false]]);
      }
    );

    it('opens every documentation link in a new tab', async () => {
      const open = jest.spyOn(window, 'open').mockImplementation(() => null);
      await render();
      const links = '.learn-more-url, .submit-job-learn-more';
      for (const link of Array.from(container.querySelectorAll(links))) {
        await click(link);
      }
      await click(radio('User Account'));
      await click(container.querySelectorAll('.submit-job-learn-more')[1]);

      expect(open.mock.calls).toEqual([
        [C.CONTAINER_REGISTERY, '_blank'],
        [C.ARTIFACT_REGISTERY, '_blank'],
        [C.CUSTOM_CONTAINERS, '_blank'],
        [C.LIGHTNING_ENGINE_DOC, '_blank'],
        [C.SERVICE_ACCOUNT, '_blank'],
        [C.SHARED_VPC, '_blank'],
        [`${C.SECURITY_KEY}?project=test-project`, '_blank'],
        [C.SELF_MANAGED_CLUSTER, '_blank'],
        [C.SERVICE_ACCOUNT, '_blank']
      ]);
      open.mockRestore();
    });
  });
});
