"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

/**
 * Custom hook for GSAP animations with automatic cleanup
 */
export function useGsap<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const contextRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (ref.current) {
      contextRef.current = gsap.context(() => {}, ref.current);
    }

    return () => {
      contextRef.current?.revert();
    };
  }, []);

  const animate = useCallback(
    (
      animation: (element: T, gsapInstance: typeof gsap) => void
    ) => {
      if (ref.current && contextRef.current) {
        contextRef.current.add(() => {
          animation(ref.current!, gsap);
        });
      }
    },
    []
  );

  return { ref, animate, gsap };
}

/**
 * Custom hook for GSAP timeline animations
 */
export function useGsapTimeline<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const contextRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (ref.current) {
      contextRef.current = gsap.context(() => {
        timelineRef.current = gsap.timeline({ paused: true });
      }, ref.current);
    }

    return () => {
      contextRef.current?.revert();
    };
  }, []);

  const play = useCallback(() => {
    timelineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    timelineRef.current?.pause();
  }, []);

  const reverse = useCallback(() => {
    timelineRef.current?.reverse();
  }, []);

  const restart = useCallback(() => {
    timelineRef.current?.restart();
  }, []);

  return {
    ref,
    timeline: timelineRef,
    play,
    pause,
    reverse,
    restart,
    gsap,
  };
}

export { gsap };











