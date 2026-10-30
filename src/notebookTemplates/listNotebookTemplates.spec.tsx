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

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import * as path from 'path';
import ListNotebookTemplates from './listNotebookTemplates';
import NotebookTemplateService from './notebookTemplatesService';

describe('ListNotebookTemplates Component', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: jest.SpyInstance;

  const mockSave = jest.fn().mockResolvedValue({});
  const mockUpdate = jest.fn();
  const mockExecute = jest.fn().mockResolvedValue({});
  const mockThemeManager: any = {};

  const createMockApp = (hasCurrentShellWidget = true): any => ({
    serviceManager: {
      contents: {
        save: mockSave
      }
    },
    shell: {
      currentWidget: hasCurrentShellWidget ? { update: mockUpdate } : null
    },
    commands: {
      execute: mockExecute
    }
  });

  const createMockFactory = (widgetPath: string | null = 'workspace/dir'): any => ({
    tracker: {
      currentWidget:
        widgetPath !== null
          ? {
              model: {
                path: widgetPath
              }
            }
          : null
    }
  });

  const buildTemplateRow = (
    renderActions: (data: any) => React.JSX.Element,
    index: number
  ) => {
    const rawData = {
      category: `Category-${index}`,
      title: `Template-${index}`,
      description: `Description for template ${index}`,
      created_at: '2026-01-01',
      sub_category: 'Spark',
      url: `https://example.com/templates/notebook_${index}.ipynb`
    };
    return {
      category: rawData.category,
      name: rawData.title,
      title: rawData.title,
      description: rawData.description,
      actions: renderActions(rawData)
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  const renderComponent = async (
    app = createMockApp(),
    factory = createMockFactory()
  ) => {
    await act(async () => {
      root.render(
        <ListNotebookTemplates
          app={app}
          themeManager={mockThemeManager}
          factory={factory}
        />
      );
    });
  };

  it('renders loading spinner while templates are being fetched', async () => {
    const listSpy = jest
      .spyOn(NotebookTemplateService, 'listNotebookTemplateAPIService')
      .mockImplementation(async () => undefined);

    await renderComponent();

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(container.textContent).toContain('Loading Notebook Templates');
    listSpy.mockRestore();
  });

  it('renders "No rows to display" when template list is empty after loading completes', async () => {
    const listSpy = jest
      .spyOn(NotebookTemplateService, 'listNotebookTemplateAPIService')
      .mockImplementation(async (setTemplateList, renderActions, setIsLoading) => {
        setTemplateList([]);
        setIsLoading(false);
      });

    await renderComponent();

    expect(container.querySelector('.no-data-style')?.textContent).toBe(
      'No rows to display'
    );
    listSpy.mockRestore();
  });

  it('renders templates table and downloads/opens notebook in local path when "Use this template" is clicked', async () => {
    const mockNotebookContent = { cells: [{ cell_type: 'code' }] };
    const listSpy = jest
      .spyOn(NotebookTemplateService, 'listNotebookTemplateAPIService')
      .mockImplementation(async (setTemplateList, renderActions, setIsLoading) => {
        setTemplateList([buildTemplateRow(renderActions, 1)]);
        setIsLoading(false);
      });
    const clickSpy = jest
      .spyOn(NotebookTemplateService, 'handleClickService')
      .mockImplementation(async (template, downloadNotebook) => {
        await downloadNotebook(mockNotebookContent, template.url);
      });

    await renderComponent(createMockApp(true), createMockFactory('local/folder'));

    const cells = container.querySelectorAll('td.notebook-template-table-data');
    expect(cells.length).toBe(4);
    expect(cells[0].textContent).toBe('Category-1');
    expect(cells[1].textContent).toBe('Template-1');
    expect(cells[2].textContent).toBe('Description for template 1');

    const useTemplateBtn = container.querySelector(
      '.use-template-style'
    ) as HTMLElement;
    expect(useTemplateBtn).not.toBeNull();

    await act(async () => {
      useTemplateBtn.click();
    });

    const expectedPath = `local/folder${path.sep}notebook_1.ipynb`;
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(expectedPath, {
      type: 'file',
      format: 'text',
      content: JSON.stringify(mockNotebookContent)
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith('docmanager:open', {
      path: expectedPath
    });

    listSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('downloads notebook to root path when active file browser path is a GCS (gs:) path', async () => {
    const mockNotebookContent = { cells: [] };
    const listSpy = jest
      .spyOn(NotebookTemplateService, 'listNotebookTemplateAPIService')
      .mockImplementation(async (setTemplateList, renderActions, setIsLoading) => {
        setTemplateList([buildTemplateRow(renderActions, 2)]);
        setIsLoading(false);
      });
    const clickSpy = jest
      .spyOn(NotebookTemplateService, 'handleClickService')
      .mockImplementation(async (template, downloadNotebook) => {
        await downloadNotebook(mockNotebookContent, template.url);
      });

    await renderComponent(
      createMockApp(false),
      createMockFactory('gs:my-bucket/notebooks')
    );

    const useTemplateBtn = container.querySelector(
      '.use-template-style'
    ) as HTMLElement;

    await act(async () => {
      useTemplateBtn.click();
    });

    const expectedPath = `${path.sep}notebook_2.ipynb`;
    expect(mockSave).toHaveBeenCalledWith(expectedPath, {
      type: 'file',
      format: 'text',
      content: JSON.stringify(mockNotebookContent)
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledWith('docmanager:open', {
      path: expectedPath
    });

    listSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('logs an error and aborts download when no active file browser widget is found', async () => {
    const listSpy = jest
      .spyOn(NotebookTemplateService, 'listNotebookTemplateAPIService')
      .mockImplementation(async (setTemplateList, renderActions, setIsLoading) => {
        setTemplateList([buildTemplateRow(renderActions, 3)]);
        setIsLoading(false);
      });
    const clickSpy = jest
      .spyOn(NotebookTemplateService, 'handleClickService')
      .mockImplementation(async (template, downloadNotebook) => {
        await downloadNotebook({ cells: [] }, template.url);
      });

    await renderComponent(createMockApp(), createMockFactory(null));

    const useTemplateBtn = container.querySelector(
      '.use-template-style'
    ) as HTMLElement;

    await act(async () => {
      useTemplateBtn.click();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'No active file browser widget found.'
    );
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();

    listSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('renders PaginationView when templateList contains more than 50 templates', async () => {
    const listSpy = jest
      .spyOn(NotebookTemplateService, 'listNotebookTemplateAPIService')
      .mockImplementation(async (setTemplateList, renderActions, setIsLoading) => {
        const manyTemplates = Array.from({ length: 55 }, (_, i) =>
          buildTemplateRow(renderActions, i)
        );
        setTemplateList(manyTemplates);
        setIsLoading(false);
      });

    await renderComponent();

    expect(container.querySelector('.pagination-parent-view')).not.toBeNull();
    listSpy.mockRestore();
  });
});
