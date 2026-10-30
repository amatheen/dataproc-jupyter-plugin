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

jest.mock('../utils/utils', () => ({
  loggedFetch: jest.fn()
}));

import React from 'react';
import NotebookTemplateService from './notebookTemplatesService';
import { loggedFetch } from '../utils/utils';
import { NOTEBOOK_TEMPLATES_LIST_URL } from '../utils/const';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('NotebookTemplateService', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('listNotebookTemplateAPIService', () => {
    const mockSetTemplateList = jest.fn();
    const mockRenderActions = jest
      .fn()
      .mockReturnValue(React.createElement('div', null, 'use-template'));
    const mockSetIsLoading = jest.fn();

    it('fetches templates list, transforms data, and updates state on success', async () => {
      const apiResponse = [
        {
          category: 'BigQuery',
          title: 'PySpark BigQuery Template',
          description: 'Read and write BigQuery tables using PySpark'
        },
        {
          category: 'GCS',
          title: 'GCS Data Processing',
          description: 'Process files in Cloud Storage'
        }
      ];

      (loggedFetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(apiResponse)
      });

      await NotebookTemplateService.listNotebookTemplateAPIService(
        mockSetTemplateList,
        mockRenderActions,
        mockSetIsLoading
      );
      await flushPromises();

      expect(loggedFetch).toHaveBeenCalledWith(NOTEBOOK_TEMPLATES_LIST_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.raw'
        }
      });
      expect(mockRenderActions).toHaveBeenCalledTimes(2);
      expect(mockSetTemplateList).toHaveBeenCalledWith([
        {
          category: 'BigQuery',
          name: 'PySpark BigQuery Template',
          description: 'Read and write BigQuery tables using PySpark',
          actions: expect.anything()
        },
        {
          category: 'GCS',
          name: 'GCS Data Processing',
          description: 'Process files in Cloud Storage',
          actions: expect.anything()
        }
      ]);
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });

    it('logs an error and clears loading state when response is not ok', async () => {
      (loggedFetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: jest.fn()
      });

      await NotebookTemplateService.listNotebookTemplateAPIService(
        mockSetTemplateList,
        mockRenderActions,
        mockSetIsLoading
      );
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching data:',
        expect.objectContaining({
          message: 'Failed to fetch notebook content. Status: 404'
        })
      );
      expect(mockSetTemplateList).not.toHaveBeenCalled();
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });

    it('logs an error and clears loading state when loggedFetch rejects', async () => {
      const networkError = new Error('Network failure');
      (loggedFetch as jest.Mock).mockRejectedValue(networkError);

      await NotebookTemplateService.listNotebookTemplateAPIService(
        mockSetTemplateList,
        mockRenderActions,
        mockSetIsLoading
      );
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching data:',
        networkError
      );
      expect(mockSetTemplateList).not.toHaveBeenCalled();
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('handleClickService', () => {
    const mockDownloadNotebook = jest.fn();
    const mockTemplate = {
      url: 'https://raw.githubusercontent.com/GoogleCloudPlatform/dataproc/main/template.ipynb'
    };

    it('fetches notebook content and invokes downloadNotebook on success', async () => {
      const mockNotebookJson = { cells: [], metadata: {}, nbformat: 4 };

      (loggedFetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockNotebookJson)
      });

      await NotebookTemplateService.handleClickService(
        mockTemplate,
        mockDownloadNotebook
      );
      await flushPromises();

      expect(loggedFetch).toHaveBeenCalledWith(mockTemplate.url, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.raw'
        }
      });
      expect(mockDownloadNotebook).toHaveBeenCalledWith(
        mockNotebookJson,
        mockTemplate.url
      );
    });

    it('logs an error and does not call downloadNotebook when response is not ok', async () => {
      (loggedFetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn()
      });

      await NotebookTemplateService.handleClickService(
        mockTemplate,
        mockDownloadNotebook
      );
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching notebook content',
        expect.objectContaining({
          message: 'Failed to fetch notebook content. Status: 500'
        })
      );
      expect(mockDownloadNotebook).not.toHaveBeenCalled();
    });

    it('logs an error and does not call downloadNotebook when loggedFetch rejects', async () => {
      const fetchError = new Error('Failed to connect');
      (loggedFetch as jest.Mock).mockRejectedValue(fetchError);

      await NotebookTemplateService.handleClickService(
        mockTemplate,
        mockDownloadNotebook
      );
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching notebook content',
        fetchError
      );
      expect(mockDownloadNotebook).not.toHaveBeenCalled();
    });
  });
});
