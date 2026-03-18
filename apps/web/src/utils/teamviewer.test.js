import { describe, expect, it, vi } from 'vitest';
import {
  buildTeamviewerDeepLink,
  describeTeamviewerPresence,
  openTeamviewerOnClient
} from './teamviewer';

describe('teamviewer utils', () => {
  it('builds a sanitized TeamViewer deep link', () => {
    expect(buildTeamviewerDeepLink('123 456 789')).toBe('teamviewer10://control?device=123456789');
  });

  it('describes online, offline, and unknown presence without inventing remote state', () => {
    expect(
      describeTeamviewerPresence({
        presence: 'online',
        rawState: 'online',
        hasTeamviewerId: true,
        statusAvailable: true
      })
    ).toEqual({
      tone: 'online',
      label: 'Online',
      detail: 'online'
    });

    expect(
      describeTeamviewerPresence({
        presence: 'offline',
        rawState: 'offline',
        hasTeamviewerId: true,
        statusAvailable: true
      })
    ).toEqual({
      tone: 'offline',
      label: 'Offline',
      detail: 'offline'
    });

    expect(
      describeTeamviewerPresence({
        presence: 'unknown',
        rawState: 'busy',
        hasTeamviewerId: true,
        statusAvailable: true
      })
    ).toEqual({
      tone: 'unknown',
      label: 'Desconocido',
      detail: 'busy'
    });
  });

  it('opens the TeamViewer deep link on the client document', () => {
    const click = vi.fn();
    const documentStub = {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      createElement: vi.fn(() => ({
        click,
        style: {},
        rel: '',
        href: ''
      }))
    };

    const previousDocument = globalThis.document;
    globalThis.document = documentStub;

    const result = openTeamviewerOnClient('555 666 777');

    expect(result.ok).toBe(true);
    expect(result.deepLinkUrl).toBe('teamviewer10://control?device=555666777');
    expect(click).toHaveBeenCalledTimes(1);
    expect(documentStub.body.appendChild).toHaveBeenCalledTimes(1);
    expect(documentStub.body.removeChild).toHaveBeenCalledTimes(1);
    expect(documentStub.createElement).toHaveBeenCalledWith('a');

    globalThis.document = previousDocument;
  });
});
