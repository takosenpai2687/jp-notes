"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { captureContent, createRippleRenderer } from "@/lib/ripple-webgl";

type BookSnapshot = {
  target: string; direction: -1 | 1;
  texture: Promise<Awaited<ReturnType<typeof captureContent>> | undefined>;
  controller: AbortController; expires: ReturnType<typeof setTimeout>;
  windowScroll: { left: number; top: number };
  scroll: { left: number; top: number }[];
};
let pendingBook: BookSnapshot | undefined;
const rippleDuration = 1100;

function backdropColor(element: HTMLElement): number[] {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    const channels = color.match(/[\d.]+/g)?.map(Number);
    if (channels && channels.length >= 3 && (channels[3] ?? 1) > 0) {
      return channels.slice(0, 3).map((value) => value / 255);
    }
  }
  return [1, 1, 1];
}

function clearBook() {
  if (!pendingBook) return;
  clearTimeout(pendingBook.expires);
  pendingBook.controller.abort();
  pendingBook = undefined;
}

function visibleArea(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  let left = Math.max(0, box.left), top = Math.max(0, box.top);
  let right = Math.min(innerWidth, box.right), bottom = Math.min(innerHeight, box.bottom);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
    }
  }
  return { x: left - box.left, y: top - box.top, width: right - left, height: bottom - top };
}

export function ContentTransition({ transitionKey, children, className = "", book = false, backgroundHue }: {
  transitionKey: string | number; children: ReactNode; className?: string; book?: boolean; backgroundHue?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const previous = useRef(transitionKey);
  const reduced = useReducedMotion();
  const stop = useRef<(() => void) | undefined>(undefined);

  function captureBook(event: MouseEvent<HTMLDivElement>) {
    stop.current?.();
    if (!book || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-book-direction]") : null;
    if (!link || link.target === "_blank" || !content.current) return;
    clearBook();
    const source = content.current;
    const area = visibleArea(source);
    if (area.width <= 0 || area.height <= 0) return;
    const controller = new AbortController();
    const texture = reduced ? Promise.resolve(undefined) : captureContent(source, area, controller.signal, true).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("[tako-jp] Page snapshot unavailable; normal navigation retained.", error);
      return undefined;
    });
    pendingBook = {
      target: link.dataset.bookTarget ?? "", direction: link.dataset.bookDirection === "-1" ? -1 : 1,
      texture, controller,
      windowScroll: { left: window.scrollX, top: window.scrollY },
      scroll: [...source.querySelectorAll<HTMLElement>(".reader-embedded, .table-scroll, pre")]
        .map((node) => ({ left: node.scrollLeft, top: node.scrollTop })),
      expires: setTimeout(clearBook, 8000),
    };
  }

  useLayoutEffect(() => {
    const changed = previous.current !== transitionKey;
    previous.current = transitionKey;
    const snapshot = book && pendingBook?.target === String(transitionKey) ? pendingBook : undefined;
    if (snapshot) { clearTimeout(snapshot.expires); pendingBook = undefined; }
    function resetBookScroll() {
      if (!snapshot || !content.current) return;
      content.current.querySelectorAll<HTMLElement>(".reader-embedded").forEach((node) => {
        node.scrollTo({ top: 0, behavior: "instant" });
      });
      window.scrollTo({ left: window.scrollX, top: 0, behavior: "instant" });
    }
    if (snapshot && content.current) {
      content.current.querySelectorAll<HTMLElement>(".reader-embedded, .table-scroll, pre").forEach((node, index) => {
        const position = snapshot.scroll[index];
        if (position) node.scrollTo({ ...position, behavior: "instant" });
      });
      window.scrollTo({ ...snapshot.windowScroll, behavior: "instant" });
    }
    if (reduced) { snapshot?.controller.abort(); resetBookScroll(); }
    if ((!changed && !snapshot) || reduced || !root.current || !content.current) return;
    stop.current?.();
    const host = root.current, target = content.current;
    if (snapshot) host.dataset.bookTurning = "";
    const initialWindowScroll = { left: window.scrollX, top: window.scrollY };
    const initialScroll = new Map(
      [...target.querySelectorAll<HTMLElement>("*")].map((node) =>
        [node, { left: node.scrollLeft, top: node.scrollTop }] as const),
    );
    const area = visibleArea(target);
    if (area.width <= 0 || area.height <= 0) { snapshot?.controller.abort(); delete host.dataset.bookTurning; resetBookScroll(); return; }
    let frameId = 0, cancelled = false;
    const controller = snapshot?.controller ?? new AbortController();
    const captureDeadline = setTimeout(() => {
      console.warn("[tako-jp] Content capture exceeded its time budget; normal navigation retained.");
      complete();
    }, 1200);
    let renderer: ReturnType<typeof createRippleRenderer>;
    const canvas = document.createElement("canvas");
    canvas.className = snapshot ? "ripple-canvas page-curl-canvas" : "ripple-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.left = `${area.x}px`; canvas.style.top = `${area.y}px`;
    canvas.style.width = `${area.width}px`; canvas.style.height = `${area.height}px`;
    function finish() {
      cancelled = true;
      controller.abort();
      clearTimeout(captureDeadline);
      cancelAnimationFrame(frameId);
      renderer?.dispose(); renderer = undefined;
      canvas.remove();
      delete host.dataset.bookTurning;
      window.removeEventListener("resize", finish);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("visibilitychange", finish);
      host.removeEventListener("pointerdown", finish, true);
      host.removeEventListener("keydown", finish, true);
      if (stop.current === finish) stop.current = undefined;
    }
    function complete() {
      finish();
      resetBookScroll();
    }
    function onScroll(event: Event) {
      if (event.target instanceof Element && event.target.closest("[data-content-capture]")) return;
      if (event.target instanceof HTMLElement) {
        const position = initialScroll.get(event.target);
        if (position && event.target.scrollLeft === position.left && event.target.scrollTop === position.top) return;
      } else if (window.scrollX === initialWindowScroll.left && window.scrollY === initialWindowScroll.top) return;
      finish();
    }
    stop.current = finish;
    window.addEventListener("resize", finish, { once: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", finish, { once: true });
    host.addEventListener("pointerdown", finish, true);
    host.addEventListener("keydown", finish, true);
    canvas.addEventListener("webglcontextlost", finish, { once: true });
    const captureStarted = performance.now();
    const texturePromise = snapshot?.texture ?? captureContent(target, area, controller.signal, true);
    void texturePromise.then((texture) => {
      if (cancelled) return;
      if (!texture) { complete(); return; }
      clearTimeout(captureDeadline);
      // Never replay stale content after slow font/image capture.
      if (performance.now() - captureStarted > 1200) { complete(); return; }
      const dark = host.closest('[data-theme="dark"]') !== null || getComputedStyle(host).colorScheme === "dark";
      renderer = createRippleRenderer(canvas, texture, area.width, area.height, dark, snapshot?.direction ?? 0);
      if (!renderer) { console.warn("[tako-jp] WebGL unavailable; ripple skipped."); complete(); return; }
      renderer.draw(0, backdropColor(host));
      host.append(canvas);
      const started = performance.now();
      function draw(now: number) {
        if (cancelled) return;
        const progress = Math.min(1, (now - started) / (snapshot ? 400 : rippleDuration));
        if (progress === 1) { complete(); return; }
        renderer?.draw(progress, backdropColor(host));
        frameId = requestAnimationFrame(draw);
      }
      frameId = requestAnimationFrame(draw);
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.warn("[tako-jp] Content capture/ripple unavailable; normal navigation retained.", error);
        complete();
      }
    });
    return finish;
  }, [transitionKey, reduced, book]);

  useEffect(() => () => stop.current?.(), []);

  return <div ref={root} className={`content-transition ${className}`} onClickCapture={captureBook}
    style={backgroundHue === undefined ? undefined : {
      backgroundColor: `hsl(${200 + backgroundHue} 65% 77%)`,
      transition: reduced ? "none" : `background-color ${rippleDuration * .75}ms ease-out`,
    }}>
    <div ref={content} className="ripple-content">{children}</div>
  </div>;
}
