'use client';

import React, { useEffect, useState } from 'react';

export default function PopupPage() {
  const [bionicActive, setBionicActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const executeTabAction = async (action: string) => {
    try {
      const [tab] = await window.chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active browser tab found.');
      }
      return await window.chrome.tabs.sendMessage(tab.id, { action });
    } catch {
      throw new Error('This page does not allow extension access. Try a regular webpage.');
    }
  };

  useEffect(() => {
    executeTabAction('GET_BIONIC_STATE')
      .then((response) => setBionicActive(Boolean(response?.active)))
      .catch(() => setBionicActive(false));
  }, []);

  const handleToggleBionic = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const response = await executeTabAction('TOGGLE_BIONIC');
      setBionicActive(Boolean(response?.active));
      setStatusMessage(response?.active ? 'Bionic reading is on for this page.' : 'Original page text restored.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not update this page.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAnalyticalReader = async () => {
    setLoading(true);
    setStatusMessage('Preparing your reading view…');
    try {
      const response = await executeTabAction('GET_ARTICLE_CRUX');
      if (!response?.success || !response.data?.rawText?.trim()) {
        throw new Error(response?.error || 'No readable article text was found on this page.');
      }
      const result = await window.chrome.runtime.sendMessage({
        action: 'OPEN_READER_TAB',
        payload: response.data
      });
      if (result?.status !== 'ok') {
        throw new Error(result?.error || 'The reading view could not be opened.');
      }
      window.close();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not open the reading view.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-[360px] overflow-hidden bg-slate-950 p-5 text-slate-100">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl shadow-black/30">
        <header className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-lg font-black text-indigo-300">
            F
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight text-white">FocusFlow</h1>
            <p className="mt-0.5 text-xs text-slate-400">A calmer way to read the web</p>
          </div>
          <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400">
            READER
          </span>
        </header>

        <section className="mt-5 space-y-3" aria-label="Reading tools">
          <button
            type="button"
            onClick={handleToggleBionic}
            disabled={loading}
            aria-pressed={bionicActive}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
              bionicActive
                ? 'border-indigo-400/40 bg-indigo-500/15 text-white'
                : 'border-slate-700 bg-slate-800/70 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">Bionic highlighting</span>
              <span className="mt-1 block text-xs text-slate-400">Emphasize word beginnings as you read</span>
            </span>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${bionicActive ? 'bg-indigo-400/20 text-indigo-200' : 'bg-slate-700 text-slate-400'}`}>
              {bionicActive ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenAnalyticalReader}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-xl bg-indigo-500 px-4 py-3.5 text-left text-white shadow-lg shadow-indigo-950/40 transition-colors hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-semibold">{loading ? 'Opening reader…' : 'Open focused reader'}</span>
              <span className="mt-1 block text-xs text-indigo-100/80">Article insights, RSVP, visual pacing & audio</span>
            </span>
            <span aria-hidden="true" className="text-lg">↗</span>
          </button>
        </section>

        {statusMessage && (
          <p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-xs leading-relaxed text-slate-300">
            {statusMessage}
          </p>
        )}

        <footer className="mt-5 flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-500">
          <span>Shortcut <kbd className="ml-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">Alt+B</kbd></span>
          <span>FocusFlow · v1.0.0</span>
        </footer>
      </div>
    </main>
  );
}