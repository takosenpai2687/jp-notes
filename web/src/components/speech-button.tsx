"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { AlertCircle, LoaderCircle, Square } from "lucide-react";
import { claimSpeech, invalidateSpeech, requestSpeech } from "@/lib/speech-client";
import type { SpeechRequest, SpeechState, SpeechTransport } from "@/lib/speech-client";
import { useApp } from "./app-provider";

export function SpeechButton({ target, label, transport = requestSpeech }: {
  target: SpeechRequest; label: string; transport?: SpeechTransport;
}) {
  const { user, notify } = useApp();
  const reducedMotion = useReducedMotion();
  const present = useIsPresent();
  const [state, setState] = useState<SpeechState>("idle");
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const key = JSON.stringify(target);
  useEffect(() => () => stopRef.current?.(), [key, user?.id]);
  useEffect(() => { if (!present) stopRef.current?.(); }, [present]);

  function toggle() {
    if (stopRef.current) { stopRef.current(); return; }
    const controller = new AbortController();
    let audio: HTMLAudioElement | undefined;
    let objectUrl: string | undefined;
    function stop() {
      controller.abort();
      clearTimeout(timeout);
      if (audio) {
        audio.onended = null; audio.onerror = null;
        audio.pause(); audio.removeAttribute("src"); audio.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      release();
      if (stopRef.current === stop) stopRef.current = undefined;
      setState("idle");
    }
    const release = claimSpeech(stop);
    stopRef.current = stop;
    setState("loading");
    function fail(message: string) {
      stop();
      setState("error");
      notify(message, true);
    }
    const timeout = setTimeout(() => fail("发音请求超时，请重试。"), 20_000);
    void (async () => {
      try {
        const signal = controller.signal;
        const blob = await transport(target, signal);
        signal.throwIfAborted();
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        audio.onended = stop;
        audio.onerror = () => {
          void invalidateSpeech(target);
          fail("音频无法播放，请重试或检查浏览器的声音权限。");
        };
        await audio.play();
        if (!controller.signal.aborted) {
          clearTimeout(timeout);
          setState("playing");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "NotSupportedError") void invalidateSpeech(target);
        fail(error instanceof DOMException && error.name === "TimeoutError" ? "发音请求超时，请重试。" :
          error instanceof DOMException && error.name === "NotAllowedError" ? "浏览器阻止了声音播放，请允许本站播放音频后重试。" :
          error instanceof Error ? error.message : "暂时无法播放发音，请重试。");
      }
    })();
  }
  const active = state === "loading" || state === "playing";
  const action = state === "loading" ? "取消加载" : state === "playing" ? "停止播放" : state === "error" ? "重试播放" : "播放";
  if (!user) return null;
  return <motion.button type="button" className={`speech-button speech-${state}`} onClick={toggle}
    aria-label={`${action}${label}`} title={`${action}${label}`} aria-pressed={active} data-state={state}
    whileHover={reducedMotion ? undefined : { scale: 1.08, rotate: -5 }}
    whileTap={reducedMotion ? undefined : { scale: .88, rotate: 5 }}>
    <span className="speech-disc" aria-hidden="true">
      {state === "loading" ? <LoaderCircle className="speech-spinner" size={19} /> :
        state === "error" ? <AlertCircle size={19} /> : <svg viewBox="0 0 32 32" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor" fillOpacity=".14" />
          <path className="speech-wave speech-wave-near" d="M21 11a7 7 0 0 1 0 10" />
          <path className="speech-wave speech-wave-far" d="M25 7a13 13 0 0 1 0 18" />
        </svg>}
      {state === "playing" && <Square className="speech-stop-mark" size={8} fill="currentColor" />}
    </span>
  </motion.button>;
}
