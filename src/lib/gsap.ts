"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
}

// Export configured gsap instance
export { gsap, ScrollTrigger, ScrollToPlugin };

// Common animation presets
export const animations = {
  fadeIn: {
    opacity: 0,
    y: 20,
    duration: 0.6,
    ease: "power3.out",
  },
  fadeInUp: {
    opacity: 0,
    y: 40,
    duration: 0.8,
    ease: "power3.out",
  },
  fadeInDown: {
    opacity: 0,
    y: -40,
    duration: 0.8,
    ease: "power3.out",
  },
  fadeInLeft: {
    opacity: 0,
    x: -40,
    duration: 0.8,
    ease: "power3.out",
  },
  fadeInRight: {
    opacity: 0,
    x: 40,
    duration: 0.8,
    ease: "power3.out",
  },
  scaleIn: {
    opacity: 0,
    scale: 0.9,
    duration: 0.6,
    ease: "power3.out",
  },
  slideUp: {
    y: 100,
    opacity: 0,
    duration: 0.8,
    ease: "power4.out",
  },
};

// Utility function to create staggered animations
export function staggerAnimation(
  elements: HTMLElement[] | NodeListOf<HTMLElement>,
  fromVars: gsap.TweenVars,
  toVars: gsap.TweenVars,
  stagger = 0.1
) {
  return gsap.fromTo(elements, fromVars, {
    ...toVars,
    stagger,
  });
}

// Utility function to create scroll-triggered animations
export function scrollTriggeredAnimation(
  element: HTMLElement | string,
  animation: gsap.TweenVars,
  trigger?: HTMLElement | string,
  start = "top 80%"
) {
  return gsap.from(element, {
    ...animation,
    scrollTrigger: {
      trigger: trigger || element,
      start,
      toggleActions: "play none none reverse",
    },
  });
}











