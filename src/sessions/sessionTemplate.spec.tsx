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

jest.mock('./sessionDetails', () => ({
  __esModule: true,
  default: ({
    sessionSelected,
    setDetailedSessionView,
    detailedSessionView,
    fromPage,
    app
  }: any) => (
    <div data-testid="mock-session-details">
      <span data-testid="session-id">{sessionSelected}</span>
      <span data-testid="from-page">{fromPage}</span>
      <span data-testid="detailed-flag">{String(detailedSessionView)}</span>
      <span data-testid="has-app">{String(Boolean(app))}</span>
      <button
        data-testid="close-session-details-btn"
        onClick={() => setDetailedSessionView(false)}
      >
        Close
      </button>
    </div>
  )
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SessionTemplate } from './sessionTemplate';

describe('SessionTemplate Widget', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockApp: any = { shell: { activeWidget: { close: jest.fn() } } };
  const mockLauncher: any = { add: jest.fn() };
  const mockThemeManager: any = {
    theme: 'JupyterLab Light',
    isLight: jest.fn().mockReturnValue(true),
    themeChanged: {
      connect: jest.fn(),
      disconnect: jest.fn()
    }
  };

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

  const renderWidget = async (sessionId = 'session-template-01') => {
    const widget = new SessionTemplate(
      mockApp,
      mockLauncher,
      mockThemeManager,
      sessionId
    );
    await act(async () => {
      root.render(widget.renderInternal());
    });
    return widget;
  };

  it('stores constructor arguments on the SessionTemplate widget instance', () => {
    const widget = new SessionTemplate(
      mockApp,
      mockLauncher,
      mockThemeManager,
      'sess-abc'
    );

    expect(widget.app).toBe(mockApp);
    expect(widget.launcher).toBe(mockLauncher);
    expect(widget.sessionId).toBe('sess-abc');
  });

  it('renders SessionDetails inside session-template-container with Launcher props by default', async () => {
    await renderWidget('sess-xyz');

    const wrapper = container.querySelector('.session-template-container');
    expect(wrapper).not.toBeNull();
    expect(
      container.querySelector('[data-testid="mock-session-details"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="session-id"]')?.textContent
    ).toBe('sess-xyz');
    expect(
      container.querySelector('[data-testid="from-page"]')?.textContent
    ).toBe('Launcher');
    expect(
      container.querySelector('[data-testid="detailed-flag"]')?.textContent
    ).toBe('true');
    expect(
      container.querySelector('[data-testid="has-app"]')?.textContent
    ).toBe('true');
  });

  it('unmounts SessionDetails when setDetailedSessionView(false) is invoked', async () => {
    await renderWidget('sess-close-test');

    const closeBtn = container.querySelector(
      '[data-testid="close-session-details-btn"]'
    ) as HTMLElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });

    expect(
      container.querySelector('.session-template-container')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="mock-session-details"]')
    ).toBeNull();
  });
});
