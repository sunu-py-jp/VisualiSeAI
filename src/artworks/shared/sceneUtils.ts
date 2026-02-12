/**
 * Shared utilities for all 3D artwork scenes.
 * Import these instead of duplicating across scenes.
 */

import { type MutableRefObject } from "react";

export type V3 = [number, number, number];
export type ElRef = MutableRefObject<number>;

export interface SceneProps {
  playing: boolean;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

/* ── Math helpers ── */

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerp3Into(out: V3, a: V3, b: V3, t: number) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeIn(t: number) {
  return t * t * t;
}

export function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

export function phaseT(elapsed: number, phase: readonly [number, number]) {
  return clamp01((elapsed - phase[0]) / (phase[1] - phase[0]));
}

/* ── Circular buffer for particle trails (O(1) push) ── */

export class TrailRing {
  private buf: V3[];
  private head = 0;
  private _length = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = Array.from({ length: capacity }, () => [0, 0, 0] as V3);
  }

  push(x: number, y: number, z: number) {
    const slot = this.buf[this.head];
    slot[0] = x;
    slot[1] = y;
    slot[2] = z;
    this.head = (this.head + 1) % this.capacity;
    if (this._length < this.capacity) this._length++;
  }

  /** i=0 is the newest entry */
  get(i: number): V3 {
    const idx = (this.head - 1 - i + this.capacity * 2) % this.capacity;
    return this.buf[idx];
  }

  get length() {
    return this._length;
  }

  reset() {
    this._length = 0;
    this.head = 0;
  }
}
