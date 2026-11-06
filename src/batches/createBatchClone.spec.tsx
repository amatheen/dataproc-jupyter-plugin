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
      listClustersAPIService: jest.fn(async (set: any) => set(['hist-1'])),
      listKeyRingsAPIService: jest.fn(async (set: any) => set(['ring-1'])),
      runtimeSharedProjectService: jest.fn(async (host: any, set: any) => {
        host('host-proj');
        set(['shared-1']);
      }),
      listKeysAPIService: jest.fn(async (_r: any, set: any, pick: any) => {
        set(['key-1', 'key-2']);
        pick('key-1');
      }),
      // Resolves the network that owns the cloned subnetwork.
      listNetworksFromSubNetworkAPIService: jest.fn(
        async (_s: any, done: any, pick: any) => {
          pick('default');
          done(false);
        }
      ),
      regionListAPIService: jest.fn(),
      creatBatchSubmitService: jest.fn()
    }
  };
});
// Deterministic batch ID: 0xabc is padded to "batch-000abc".
Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (a: Uint32Array) => a.fill(0xabc) }
});

const NAME = 'projects/test-project/locations/us-central1/batches/batch-000abc';
const KMS =
  'projects/test-project/locations/us-central1/keyRings/ring-1/cryptoKeys/key-1';
const SHARED_SUBNET =
  'projects/host-proj/regions/us-central1/subnetworks/shared-1';
const END_USER = 'END_USER_CREDENTIALS';

// batchInfoResponse fixtures, shaped like the Dataproc batches API.
const SPARK_CLONE = {
  sparkBatch: {
    mainJarFileUri: 'gs://b/app.jar',
    jarFileUris: ['gs://b/dep.jar'],
    fileUris: ['gs://b/f.txt'],
    archiveUris: ['gs://b/a.zip'],
    args: ['--x']
  },
  runtimeConfig: {
    containerImage: 'gcr.io/p/img:1',
    properties: {
      'spark:spark.executor.cores': '4',
      'dataproc:dataproc.tier': 'premium',
      'spark:spark.dataproc.engine': 'lightningEngine'
    }
  },
  environmentConfig: {
    executionConfig: {
      serviceAccount: 'sa@p.iam',
      kmsKey: KMS,
      subnetworkUri: 'sub-2',
      networkTags: ['tag-a']
    },
    peripheralsConfig: {
      metastoreService: 'projects/meta-proj/locations/us-central1/services/ms',
      sparkHistoryServerConfig: {
        dataprocCluster:
          'projects/test-project/regions/us-central1/clusters/hist-1'
      }
    }
  },
  labels: { team: 'data' }
};
const PYSPARK_CLONE = {
  pysparkBatch: {
    mainPythonFileUri: 'gs://b/main.py',
    pythonFileUris: ['gs://b/util.py']
  },
  runtimeConfig: {
    properties: { 'spark:spark.app.name': 'demo', 'dataproc:internal.x': 'y' }
  },
  environmentConfig: {
    executionConfig: {
      subnetworkUri: SHARED_SUBNET,
      authenticationConfig: {
        userWorkloadAuthenticationType: END_USER,
        serviceAccount: 'ops@p.iam'
      }
    }
  }
};
const SPARKR_CLONE = {
  sparkRBatch: { mainRFileUri: 'gs://b/main.R' },
  runtimeConfig: { version: '2.1' },
  labels: { env: 'dev' }
};
const SQL_CLONE = {
  sparkSqlBatch: {
    queryFileUri: 'gs://b/q.sql',
    queryVariables: { env: 'prod' },
    jarFileUris: ['gs://b/udf.jar']
  },
  runtimeConfig: {
    properties: {
      'dataproc:dataproc.tier': 'premium',
      'spark:spark.dataproc.engine': 'default'
    }
  },
  environmentConfig: {
    peripheralsConfig: {
      sparkHistoryServerConfig: {
        dataprocCluster: 'projects/p/clusters/hist-2'
      }
    }
  },
  labels: {}
};
const USER_CLONE = {
  sparkBatch: { mainClass: 'com.example.Main' },
  environmentConfig: {
    executionConfig: {
      subnetworkUri: 'sub-1',
      authenticationConfig: { userWorkloadAuthenticationType: END_USER }
    }
  }
};

describe('CreateBatch clone', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authApi).mockResolvedValue({ access_token: 'token' } as any);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (batchInfoResponse: any) => {
    await act(async () =>
      root.render(
        <CreateBatch
          regionName="us-central1"
          projectName="test-project"
          batchInfoResponse={batchInfoResponse}
          createBatch={true}
        />
      )
    );
  };
  const field = (label: string) =>
    container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  const value = (label: string) => field(label)?.value;
  const type = async (label: string, text: string) => {
    const input = field(label) as HTMLInputElement;
    const proto = Object.getPrototypeOf(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  // MUI radio rendered just before the text that describes it.
  const radio = (label: string) =>
    Array.from(container.querySelectorAll('div'))
      .find(div => !div.children.length && div.textContent?.trim() === label)
      ?.previousElementSibling?.querySelector('input') ?? null;
  const lightning = () =>
    container.querySelector<HTMLInputElement>('[name="lightningEngine"]');
  // Clicks SUBMIT and returns the payload passed to BatchService.
  const submit = async () => {
    const button = container.querySelector('[aria-label="submit Batch"] div');
    await act(async () => (button as HTMLElement).click());
    return jest.mocked(BatchService.creatBatchSubmitService).mock.lastCall?.[1];
  };

  describe('prefill per batch type', () => {
    it('prefills a Spark batch and resubmits its configuration', async () => {
      await render(SPARK_CLONE);

      expect(value('Batch type*')).toBe('Spark');
      expect(radio('Main jar URI')?.checked).toBe(true);
      expect(value('Main jar*')).toBe('gs://b/app.jar');
      expect(value('Jar files')).toBe('gs://b/dep.jar');
      expect(value('Files')).toBe('gs://b/f.txt');
      expect(value('Archive files')).toBe('gs://b/a.zip');
      expect(value('Arguments')).toBe('--x');
      expect(value('Custom container image')).toBe('gcr.io/p/img:1');
      expect(value('Network tags')).toBe('tag-a');
      const { calls } = jest.mocked(
        BatchService.listNetworksFromSubNetworkAPIService
      ).mock;
      expect(calls.map(call => call[0])).toEqual(['sub-2']);
      expect(value('Primary network*')).toBe('default');
      expect(value('Subnetwork*')).toBe('sub-2');
      expect(radio('Customer-managed encryption key (CMEK)')?.checked).toBe(
        true
      );
      expect(value('Key rings')).toBe('ring-1');
      expect(value('Keys')).toBe('key-1');
      expect(value('Project ID')).toBe('meta-proj');
      expect(value('Metastore services')).toBe(
        'projects/meta-proj/locations/us-central1/services/ms'
      );
      expect(value('History server cluster')).toBe('hist-1');
      expect(radio('Service Account')?.checked).toBe(true);
      expect(value('Service account')).toBe('sa@p.iam');
      expect(radio('Premium')?.checked).toBe(true);
      expect(lightning()?.checked).toBe(true);
      expect(value('ADD LABEL')).toBe('team:data');

      const payload = await submit();
      expect(payload.name).toBe(NAME);
      expect(payload.sparkBatch).toEqual(SPARK_CLONE.sparkBatch);
      expect(payload.labels).toEqual(SPARK_CLONE.labels);
      expect(payload.environmentConfig).toEqual(SPARK_CLONE.environmentConfig);
      // Tier and engine come back as dedicated properties; the cloned runtime
      // version is not restored (the default 2.2 is used).
      expect(payload.runtimeConfig).toEqual({
        version: '2.2',
        containerImage: 'gcr.io/p/img:1',
        properties: {
          'dataproc.tier': 'premium',
          'spark.dataproc.engine': 'lightningEngine',
          'spark.executor.cores': '4'
        }
      });
    });

    it('prefills a PySpark batch on a shared VPC with end-user credentials', async () => {
      await render(PYSPARK_CLONE);

      expect(value('Batch type*')).toBe('PySpark');
      expect(value('Main python file*')).toBe('gs://b/main.py');
      expect(value('Additional python files')).toBe('gs://b/util.py');
      const sharedVpc = '[value="sharedVpc"]';
      expect(
        container.querySelector<HTMLInputElement>(sharedVpc)?.checked
      ).toBe(true);
      expect(value('Shared subnetwork')).toBe('shared-1');
      expect(radio('User Account')?.checked).toBe(true);
      expect(value('Service account for system operations')).toBe('ops@p.iam');
      expect(radio('Google-managed encryption key')?.checked).toBe(true);
      // Without a cloned metastore the dropdown shows "None".
      expect(value('Metastore services')).toBe('None');
      // dataproc:internal properties are dropped.
      expect(value('ADD PROPERTY')).toBe('spark.app.name:demo');

      expect(await submit()).toEqual({
        pysparkBatch: PYSPARK_CLONE.pysparkBatch,
        labels: {},
        name: NAME,
        runtimeConfig: {
          version: '2.2',
          properties: { 'spark.app.name': 'demo' }
        },
        environmentConfig: {
          executionConfig: {
            authenticationConfig: { userWorkloadAuthenticationType: END_USER },
            serviceAccount: 'ops@p.iam',
            subnetworkUri: SHARED_SUBNET
          },
          peripheralsConfig: {}
        }
      });
    });

    it('prefills a SparkR batch without an environment config', async () => {
      await render(SPARKR_CLONE);

      expect(value('Batch type*')).toBe('SparkR');
      expect(value('Main R file*')).toBe('gs://b/main.R');
      expect(value('ADD LABEL')).toBe('env:dev');
      // Subnetworks are listed before and after the network lookup, but none
      // is preselected for a clone.
      const { calls } = jest.mocked(
        BatchService.listSubNetworksAPIService
      ).mock;
      expect(calls.map(call => call[0])).toEqual(['', 'default']);
      expect(value('Subnetwork*')).toBe('');
      expect(container.textContent).toContain(
        'Please select a valid network and subnetwork.'
      );
      expect(
        container.querySelector('.submit-button-disable-style')
      ).not.toBeNull();

      await type('Subnetwork*', 'sub-1');
      expect(await submit()).toEqual({
        sparkRBatch: SPARKR_CLONE.sparkRBatch,
        labels: { env: 'dev' },
        name: NAME,
        runtimeConfig: {
          version: '2.2',
          properties: {
            'dataproc.tier': 'standard',
            'spark.dataproc.engine': 'default'
          }
        },
        environmentConfig: {
          executionConfig: { subnetworkUri: 'sub-1' },
          peripheralsConfig: {}
        }
      });
    });

    it('prefills a SparkSql batch with its tier and history server', async () => {
      await render(SQL_CLONE);

      expect(value('Batch type*')).toBe('SparkSql');
      expect(value('Query file*')).toBe('gs://b/q.sql');
      expect(value('Jar files')).toBe('gs://b/udf.jar');
      expect(value('History server cluster')).toBe('hist-2');
      expect(radio('Premium')?.checked).toBe(true);
      expect(lightning()?.checked).toBe(false);
      expect(radio('Service Account')?.checked).toBe(true);
      expect(value('Service account')).toBe('');
      // Current behaviour: cloned queryVariables end up in the properties
      // list instead of the query parameters.
      expect(value('ADD PARAMETER')).toBe('');
      expect(value('ADD PROPERTY')).toBe(
        'dataproc.tier:premium|spark.dataproc.engine:default|env:prod'
      );
    });
  });

  describe('partial responses', () => {
    it('prefills a main class and end-user credentials without an account', async () => {
      await render(USER_CLONE);

      expect(radio('Main class')?.checked).toBe(true);
      expect(value('Main class*')).toBe('com.example.Main');
      expect(radio('User Account')?.checked).toBe(true);
      expect(value('Service account for system operations')).toBe('');

      const payload = await submit();
      expect(payload.sparkBatch).toEqual(USER_CLONE.sparkBatch);
      expect(payload.environmentConfig.executionConfig).toEqual({
        authenticationConfig: { userWorkloadAuthenticationType: END_USER },
        subnetworkUri: 'sub-1'
      });
    });

    it('treats an empty batchInfoResponse like a new Spark batch', async () => {
      await render({});

      expect(value('Batch type*')).toBe('Spark');
      expect(value('Main class*')).toBe('');
      expect(value('ADD LABEL')).toBe('');
      // The network is still looked up, but no subnetwork is preselected.
      const { calls } = jest.mocked(
        BatchService.listNetworksFromSubNetworkAPIService
      ).mock;
      expect(calls.map(call => call[0])).toEqual(['']);
      expect(value('Primary network*')).toBe('default');
      expect(value('Subnetwork*')).toBe('');
    });
  });
});
