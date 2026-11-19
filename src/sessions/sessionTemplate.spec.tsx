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

jest.mock('./sessionDetails', () => ({
  __esModule: true,
  default: (props: any) => {
    mockSessionDetailsProps(props);
    return (
      <div data-testid="mock-session-details">
        <button
          data-testid="close-session-details-btn"
          onClick={() => props.setDetailedSessionView(false)}
        >
          Close
        </button>
      </div>
    );
  }
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DataprocWidget } from '../controls/DataprocWidget';
import { SessionTemplate } from './sessionTemplate';

describe('SessionTemplate Widget', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

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
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    jest.restoreAllMocks();
  });

  const renderWidget = async (sessionId = 'session-template-01') => {
    const widget = new SessionTemplate(
      mockApp,
      mockLauncher,
      mockThemeManager,
      sessionId
    );
    await act(async () => {
      root?.render(widget.renderInternal());
    });
    return widget;
  };

  it('extends DataprocWidget and stores constructor arguments on the instance', () => {
    const widget = new SessionTemplate(
      mockApp,
      mockLauncher,
      mockThemeManager,
      'sess-abc'
    );

    expect(widget).toBeInstanceOf(DataprocWidget);
    expect(widget.app).toBe(mockApp);
    expect(widget.launcher).toBe(mockLauncher);
    expect(widget.sessionId).toBe('sess-abc');
  });

  test.each(['sess-xyz', ''])(
    'renders SessionDetails inside session-template-container with Launcher props for sessionId="%s"',
    async sessionId => {
      await renderWidget(sessionId);

      expect(
        container.querySelector('.session-template-container')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="mock-session-details"]')
      ).not.toBeNull();
      expect(mockSessionDetailsProps).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sessionSelected: sessionId,
          detailedSessionView: true,
          fromPage: 'Launcher',
          app: mockApp,
          setDetailedSessionView: expect.any(Function)
        })
      );
    }
  );

  it('unmounts SessionDetails while preserving container when setDetailedSessionView(false) is invoked', async () => {
    await renderWidget('sess-close-test');

    const closeBtn = container.querySelector(
      '[data-testid="close-session-details-btn"]'
    ) as HTMLButtonElement;
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
