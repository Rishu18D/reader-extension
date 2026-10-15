'use client';

import React, { useEffect, useRef, useState } from 'react';

const PACE_OPTIONS = [250, 350, 450, 600, 800];

function getOpticalPoint(word, character) {
  const letters = [...word.matchAll(/[A-Za-z0-9]/g)];
  if (!letters.length) return { left: word, focus: '', right: '' };
  const focusIndex = letters[Math.min(character - 1, letters.length - 1)].index;
  return {
    left: word.slice(0, focusIndex),
    focus: word[focusIndex],
    right: word.slice(focusIndex + 1)
  };
}

export default function AnalyticalReaderPage() {
  const [article, setArticle] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [bionicActive, setBionicActive] = useState(true);
  const [activeMode, setActiveMode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(350);
  const [wordIndex, setWordIndex] = useState(0);
  const [words, setWords] = useState([]);
  const [rsvpGroupSize, setRsvpGroupSize] = useState(1);
  const [orpCharacter, setOrpCharacter] = useState(3);
  const [chunkSize, setChunkSize] = useState(3);
  const [tunnelEnabled, setTunnelEnabled] = useState(true);
  const [laserEnabled, setLaserEnabled] = useState(true);
  const [guidesEnabled, setGuidesEnabled] = useState(true);
  const [audioMode, setAudioMode] = useState('hum');
  const [audioBpm, setAudioBpm] = useState(80);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceBeat, setPracticeBeat] = useState(1);
  const [readingMode, setReadingMode] = useState('deep');
  const [fontSize, setFontSize] = useState(17);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFriendly, setDyslexiaFriendly] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioSessionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const articleId = new URLSearchParams(window.location.search).get('article');
    if (!articleId || typeof chrome === 'undefined' || !chrome.storage?.local) {
      setLoadError('Open FocusFlow on an article page and choose “Open focused reader”.');
      return () => {
        cancelled = true;
      };
    }

    const storageKey = `article:${articleId}`;
    chrome.storage.local.get(storageKey, (result) => {
      const storageError = chrome.runtime.lastError;
      if (cancelled) return;
      if (storageError) {
        setLoadError('The article could not be loaded from extension storage.');
        return;
      }

      const savedArticle = result[storageKey];
      if (!savedArticle?.rawText) {
        setLoadError('This reading session has expired. Reopen the reader from the article page.');
        return;
      }

      setArticle(savedArticle);
      setWords(savedArticle.rawText.trim().split(/\s+/).filter(Boolean));
      chrome.storage.local.remove(storageKey);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    audioSessionRef.current?.stop();
  }, []);

  useEffect(() => {
    const modeConfig = {
      deep: { wpm: 350, rsvpGroupSize: 1, chunkSize: 3, tunnelEnabled: true, laserEnabled: true, guidesEnabled: true },
      quick: { wpm: 500, rsvpGroupSize: 2, chunkSize: 4, tunnelEnabled: false, laserEnabled: true, guidesEnabled: false },
      study: { wpm: 260, rsvpGroupSize: 1, chunkSize: 3, tunnelEnabled: true, laserEnabled: false, guidesEnabled: true }
    }[readingMode];

    if (!modeConfig) return;
    setWpm(modeConfig.wpm);
    setRsvpGroupSize(modeConfig.rsvpGroupSize);
    setChunkSize(modeConfig.chunkSize);
    setTunnelEnabled(modeConfig.tunnelEnabled);
    setLaserEnabled(modeConfig.laserEnabled);
    setGuidesEnabled(modeConfig.guidesEnabled);
  }, [readingMode]);

  const stepSize = activeMode === 'rsvp' ? rsvpGroupSize : chunkSize;
  const currentGroupEnd = Math.min(wordIndex + stepSize, words.length);
  const progress = words.length ? (currentGroupEnd / words.length) * 100 : 0;

  useEffect(() => {
    if (!isPlaying || !activeMode || words.length === 0) return undefined;

    const lastWord = words[Math.min(wordIndex + stepSize - 1, words.length - 1)] || '';
    const pause = /[.!?]["')\]]*$/.test(lastWord) ? 350 : /[,;:]["')\]]*$/.test(lastWord) ? 140 : 0;
    const timer = window.setTimeout(() => {
      setWordIndex((current) => {
        if (current + stepSize >= words.length) {
          setIsPlaying(false);
          return current;
        }
        return current + stepSize;
      });
    }, (60_000 * stepSize) / wpm + pause);

    return () => window.clearTimeout(timer);
  }, [activeMode, isPlaying, stepSize, wordIndex, words, wpm]);

  const toggleMode = (mode) => {
    setIsPlaying(false);
    setWordIndex(0);
    setActiveMode((current) => current === mode ? null : mode);
  };

  const stopAudio = () => {
    audioSessionRef.current?.stop();
    audioSessionRef.current = null;
    setAudioPlaying(false);
  };

  const startAudio = async () => {
    setAudioError('');
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor || audioMode === 'off') {
      setAudioError('Choose an audio pattern and use a browser with Web Audio support.');
      return;
    }

    const context = new AudioContextConstructor();
    const masterGain = context.createGain();
    masterGain.gain.value = audioMode === 'hum' ? 0.012 : 0.025;
    masterGain.connect(context.destination);
    let oscillator = null;
    let noiseSource = null;
    let tickTimer = null;

    try {
      await context.resume();
      if (audioMode === 'hum') {
        oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 110;
        oscillator.connect(masterGain);
        oscillator.start();
      } else if (audioMode === 'pink-noise') {
        const sampleRate = context.sampleRate;
        const buffer = context.createBuffer(1, sampleRate * 3, sampleRate);
        const channel = buffer.getChannelData(0);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        for (let index = 0; index < channel.length; index += 1) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          channel[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
        noiseSource = context.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
        noiseSource.connect(masterGain);
        noiseSource.start();
      } else {
        const playTick = () => {
          const tick = context.createOscillator();
          const envelope = context.createGain();
          const startTime = context.currentTime;
          tick.type = 'sine';
          tick.frequency.value = 880;
          envelope.gain.setValueAtTime(0.0001, startTime);
          envelope.gain.exponentialRampToValueAtTime(0.08, startTime + 0.008);
          envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.065);
          tick.connect(envelope);
          envelope.connect(masterGain);
          tick.start(startTime);
          tick.stop(startTime + 0.07);
          tick.addEventListener('ended', () => {
            tick.disconnect();
            envelope.disconnect();
          }, { once: true });
        };
        playTick();
        tickTimer = window.setInterval(playTick, 60_000 / audioBpm);
      }

      audioSessionRef.current = {
        stop() {
          window.clearInterval(tickTimer);
          oscillator?.stop();
          noiseSource?.stop();
          masterGain.disconnect();
          if (context.state !== 'closed') void context.close();
        }
      };
      setAudioPlaying(true);
    } catch (error) {
      window.clearInterval(tickTimer);
      oscillator?.stop();
      noiseSource?.stop();
      masterGain.disconnect();
      if (context.state !== 'closed') void context.close();
      setAudioError(error instanceof Error ? error.message : 'The audio pattern could not be started.');
    }
  };

  const renderBionicWord = (word) => {
    if (!bionicActive) return word;
    const match = /^([^A-Za-z0-9]*)([A-Za-z0-9]+)(.*)$/.exec(word);
    if (!match) return word;
    const [, prefix, wordPart, suffix] = match;
    const boldLength = wordPart.length <= 3 ? 1 : Math.ceil(wordPart.length * 0.45);
    return (
      <>
        {prefix}
        <strong className="font-extrabold text-white">{wordPart.slice(0, boldLength)}</strong>
        {wordPart.slice(boldLength)}
        {suffix}
      </>
    );
  };

  const tapPractice = () => {
    setPracticeBeat((beat) => beat === 4 ? 1 : beat + 1);
  };

  const readingModeOptions = [
    { id: 'deep', label: 'Deep', description: 'Comfort reading' },
    { id: 'quick', label: 'Quick', description: 'Skim + scan' },
    { id: 'study', label: 'Study', description: 'Learn + retain' }
  ];

  const accessibilityTheme = highContrast
    ? 'bg-slate-950 text-slate-50'
    : 'bg-slate-950 text-slate-200';
  const articleTextStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: lineSpacing,
    fontFamily: dyslexiaFriendly ? '"Segoe UI", "Verdana", sans-serif' : undefined,
    letterSpacing: dyslexiaFriendly ? '0.01em' : undefined
  };

  const renderRsvpGroup = () => {
    const group = words.slice(wordIndex, currentGroupEnd);
    if (!group.length) return <span className="text-sm text-slate-500">Your article will appear here</span>;
    const gridClass = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4'
    }[group.length] || 'grid-cols-1';

    return (
      <div className={`grid w-full gap-1 ${gridClass}`}>
        {group.map((word, index) => {
          const { left, focus, right } = getOpticalPoint(word, orpCharacter);
          return (
            <span key={`${word}-${wordIndex + index}`} className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-baseline font-mono text-2xl sm:text-3xl">
              <span className="overflow-hidden text-right text-slate-400">{left}</span>
              <span className="border-b-2 border-rose-400 px-0.5 font-bold text-rose-400">{focus}</span>
              <span className="overflow-hidden text-left text-slate-100">{right}</span>
            </span>
          );
        })}
      </div>
    );
  };

  if (!article) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-200">
        <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-xl font-black text-indigo-300">F</div>
          <h1 className="mt-5 text-lg font-semibold text-white">FocusFlow reader</h1>
          <p role="status" className="mt-2 text-sm leading-relaxed text-slate-400">
            {loadError || 'Loading your article…'}
          </p>
        </section>
      </main>
    );
  }

  const paragraphs = article.rawText.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  let articleWordIndex = 0;

  return (
    <div className={`min-h-screen ${accessibilityTheme} ${reducedMotion ? 'motion-reduce:transition-none' : ''}`}>
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 px-5 py-3 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <a href="#" className="flex min-w-0 items-center gap-3 text-white no-underline" aria-label="FocusFlow reader">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 font-black text-indigo-300">F</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">FocusFlow</span>
              <span className="block truncate text-[11px] text-slate-500">Focused reading space</span>
            </span>
          </a>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1">
              {readingModeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReadingMode(option.id)}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    readingMode === option.id
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setBionicActive((active) => !active)}
              aria-pressed={bionicActive}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                bionicActive ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Bionic {bionicActive ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => toggleMode('rsvp')}
              aria-pressed={activeMode === 'rsvp'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                activeMode === 'rsvp' ? 'border-amber-400/40 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              RSVP Max
            </button>
            <button
              type="button"
              onClick={() => toggleMode('pacer')}
              aria-pressed={activeMode === 'pacer'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                activeMode === 'pacer' ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Visual pacer
            </button>
          </div>
        </div>
      </header>

      {activeMode && (
        <section className="border-b border-slate-800 bg-slate-900/60 px-5 py-7 sm:px-8" aria-label={activeMode === 'rsvp' ? 'RSVP Max controls' : 'Visual pacer controls'}>
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-[0.16em]">
                  {activeMode === 'rsvp' ? 'Rapid serial visual presentation' : 'Guided phrase pacing'}
                </span>
                <span>{words.length ? `${wordIndex + 1}–${currentGroupEnd} of ${words.length} words` : 'No words available'}</span>
              </div>

              {activeMode === 'rsvp' ? (
                <>
                  <div className="relative mt-5 flex min-h-32 items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 px-3">
                    <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 border-l border-rose-400/20" />
                    <div className="relative z-10 w-full">{renderRsvpGroup()}</div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-5">
                    <fieldset className="flex items-center gap-1.5">
                      <legend className="mb-2 text-xs text-slate-400">Words per flash</legend>
                      {[1, 2, 3, 4].map((size) => (
                        <button key={size} type="button" onClick={() => setRsvpGroupSize(size)} aria-pressed={rsvpGroupSize === size} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${rsvpGroupSize === size ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                          {size}
                        </button>
                      ))}
                    </fieldset>
                    <fieldset className="flex items-center gap-1.5">
                      <legend className="mb-2 text-xs text-slate-400">Red focus letter</legend>
                      {[3, 4].map((character) => (
                        <button key={character} type="button" onClick={() => setOrpCharacter(character)} aria-pressed={orpCharacter === character} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${orpCharacter === character ? 'border-rose-400/40 bg-rose-400/10 text-rose-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                          {character === 3 ? '3rd' : '4th'}
                        </button>
                      ))}
                    </fieldset>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Next phrase</p>
                    <p className="mt-2 text-lg leading-relaxed text-white sm:text-xl">
                      {words.slice(wordIndex, currentGroupEnd).join(' ') || 'Your article will appear here'}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-5">
                    <fieldset className="flex items-center gap-1.5">
                      <legend className="mb-2 text-xs text-slate-400">Words per chunk</legend>
                      {[3, 4].map((size) => (
                        <button key={size} type="button" onClick={() => setChunkSize(size)} aria-pressed={chunkSize === size} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${chunkSize === size ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                          {size} words
                        </button>
                      ))}
                    </fieldset>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={tunnelEnabled} onChange={(event) => setTunnelEnabled(event.target.checked)} className="accent-cyan-400" />
                      Guided highlight tunnel
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={laserEnabled} onChange={(event) => setLaserEnabled(event.target.checked)} className="accent-cyan-400" />
                      Moving underline
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={guidesEnabled} onChange={(event) => setGuidesEnabled(event.target.checked)} className="accent-cyan-400" />
                      Margin guides
                    </label>
                  </div>
                </>
              )}

              <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-800" aria-label="Reading progress">
                <div className="h-full rounded-full bg-indigo-400 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying((playing) => !playing)}
                  disabled={!words.length}
                  className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPlaying ? 'Pause' : wordIndex > 0 ? 'Resume' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setWordIndex(0);
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                >
                  Restart
                </button>
                <div className="flex min-w-[190px] flex-1 items-center gap-3 text-xs text-slate-400">
                  <label htmlFor="focusflow-wpm" className="shrink-0">{wpm} WPM</label>
                  <input
                    id="focusflow-wpm"
                    type="range"
                    min="150"
                    max="800"
                    step="25"
                    value={wpm}
                    aria-label="Words per minute"
                    onChange={(event) => setWpm(Number(event.target.value))}
                    className="w-full accent-indigo-400"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 border-t border-slate-800 pt-5 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="focusflow-audio" className="text-xs font-semibold text-slate-300">Background sound</label>
                    <select id="focusflow-audio" value={audioMode} disabled={audioPlaying} onChange={(event) => setAudioMode(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 disabled:opacity-60">
                      <option value="hum">Soft low hum</option>
                      <option value="ticks">Metronome ticks</option>
                      <option value="pink-noise">Pink noise</option>
                    </select>
                    {audioMode === 'ticks' && (
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        {audioBpm} BPM
                        <input type="range" min="60" max="120" step="5" value={audioBpm} disabled={audioPlaying} aria-label="Metronome beats per minute" onChange={(event) => setAudioBpm(Number(event.target.value))} className="w-20 accent-indigo-400 disabled:opacity-50" />
                      </label>
                    )}
                    <button type="button" onClick={() => audioPlaying ? stopAudio() : void startAudio()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                      {audioPlaying ? 'Stop sound' : 'Start sound'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Optional, quiet audio patterns generated in your browser. Sound starts only when you choose it.</p>
                  {audioError && <p role="status" className="mt-2 text-xs text-rose-300">{audioError}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPracticeActive((active) => !active);
                    setPracticeBeat(1);
                  }}
                  aria-pressed={practiceActive}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${practiceActive ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  {practiceActive ? 'End rhythm practice' : 'Try rhythm practice'}
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Accessibility</p>
                    <p className="mt-1 text-[11px] text-slate-500">Comfort settings for longer reading sessions.</p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.13em] text-slate-400">Reader+</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                    <span>High contrast</span>
                    <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} className="accent-indigo-400" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                    <span>Dyslexia-friendly font</span>
                    <input type="checkbox" checked={dyslexiaFriendly} onChange={(event) => setDyslexiaFriendly(event.target.checked)} className="accent-indigo-400" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                    <span>Reduce motion</span>
                    <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} className="accent-indigo-400" />
                  </label>
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Text size</span>
                      <span>{fontSize}px</span>
                    </div>
                    <input type="range" min="15" max="24" step="1" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} className="mt-2 w-full accent-indigo-400" />
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>Line spacing</span>
                      <span>{lineSpacing.toFixed(1)}x</span>
                    </div>
                    <input type="range" min="1.4" max="2.2" step="0.1" value={lineSpacing} onChange={(event) => setLineSpacing(Number(event.target.value))} className="mt-2 w-full accent-indigo-400" />
                  </div>
                </div>
              </div>

              {practiceActive && (
                <div
                  className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.code === 'Space' && event.target === event.currentTarget) {
                      event.preventDefault();
                      tapPractice();
                    }
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-emerald-100">Count or tap a steady 1–4 rhythm</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">Follow the moving phrase while you tap. This optional exercise may help interrupt inner speech, but cannot guarantee subvocalization will stop.</p>
                  </div>
                  <button type="button" onClick={tapPractice} className="min-w-32 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/15">
                    Tap · {practiceBeat}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12 lg:py-14">
        <article className="min-w-0">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Distraction-free article</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{article.title || 'Untitled article'}</h1>
            {article.byline && <p className="mt-3 text-sm text-slate-500">{article.byline}</p>}
            <div className="mt-7 h-px bg-slate-800" />
            <div
              className={`relative mt-8 space-y-6 text-base text-slate-300 ${guidesEnabled && activeMode === 'pacer' ? 'focusflow-margin-guides' : ''}`}
              style={articleTextStyle}
            >
              {paragraphs.length ? paragraphs.map((paragraph, paragraphIndex) => {
                const paragraphWords = paragraph.trim().split(/\s+/).filter(Boolean).length;
                const paragraphStart = articleWordIndex;
                articleWordIndex += paragraphWords;
                const paragraphIsActive = wordIndex >= paragraphStart && wordIndex < paragraphStart + paragraphWords;
                const tunnelClass = activeMode === 'pacer' && tunnelEnabled
                  ? paragraphIsActive ? 'opacity-100' : 'opacity-20 blur-[1px]'
                  : '';
                const paragraphTokens = paragraph.split(/(\s+)/);
                let paragraphWordOffset = 0;

                return (
                  <p key={paragraphIndex} className={`transition-[opacity,filter] duration-500 ${tunnelClass}`}>
                    {paragraphTokens.map((token, tokenIndex) => {
                      if (/^\s+$/.test(token)) return <React.Fragment key={tokenIndex}>{token}</React.Fragment>;
                      const currentWordIndex = paragraphStart + paragraphWordOffset;
                      paragraphWordOffset += 1;
                      const isCurrentChunk = activeMode === 'pacer' && currentWordIndex >= wordIndex && currentWordIndex < currentGroupEnd;
                      const wordStyle = isCurrentChunk ? { '--focusflow-pacer-duration': `${Math.max(0.45, (60 * chunkSize) / wpm)}s` } : undefined;
                      return (
                        <span
                          key={tokenIndex}
                          style={wordStyle}
                          className={`transition-[opacity,background-color,color] duration-500 ${activeMode === 'pacer' && tunnelEnabled && !isCurrentChunk ? 'opacity-25' : ''} ${isCurrentChunk ? `rounded-sm bg-cyan-400/15 px-0.5 text-cyan-50 ${laserEnabled ? 'focusflow-pacer-word' : ''}` : ''}`}
                        >
                          {renderBionicWord(token)}
                        </span>
                      );
                    })}
                  </p>
                );
              }) : <p className="text-slate-500">No article text available.</p>}
            </div>
          </div>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Key themes</h2>
              <span className="text-xs text-slate-600">{article.keywords?.length || 0}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.keywords?.length ? article.keywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className="rounded-full border border-indigo-400/15 bg-indigo-400/10 px-2.5 py-1.5 text-xs font-medium text-indigo-200">
                  {keyword}
                </span>
              )) : <p className="text-sm text-slate-500">No keywords were found.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Article highlights</h2>
              <span className="text-xs text-slate-600">{article.crux?.length || 0}</span>
            </div>
            {article.crux?.length ? (
              <ul className="mt-4 space-y-4">
                {article.crux.map((sentence, index) => (
                  <li key={`${sentence}-${index}`} className="border-l-2 border-indigo-400/70 pl-3 text-sm leading-relaxed text-slate-300">
                    {sentence}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm leading-relaxed text-slate-500">Highlights will appear when the article has enough text to analyze.</p>}
          </section>
        </aside>
      </main>
    </div>
  );
}
