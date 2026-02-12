"use client";

import { useRef, useMemo, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */

interface RagSceneProps {
  playing: boolean;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

type V3 = [number, number, number];
type ElRef = MutableRefObject<number>;

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Mutating version — writes into `out` to avoid allocation
function lerp3Into(out: V3, a: V3, b: V3, t: number) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function phaseT(elapsed: number, phase: readonly [number, number]) {
  return clamp01((elapsed - phase[0]) / (phase[1] - phase[0]));
}

/* ────────────────────────────────────────────
   Circular buffer for particle trails (O(1) add)
   ──────────────────────────────────────────── */

class TrailRing {
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
    const idx =
      (this.head - 1 - i + this.capacity * 2) % this.capacity;
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

/* ────────────────────────────────────────────
   Ambient floating particles (background)
   ──────────────────────────────────────────── */

function AmbientParticles() {
  const count = 180;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);


  // Pre-compute per-particle sin/cos phase offsets to reduce trig per frame
  const data = useMemo(() => {
    return Array.from({ length: count }, () => {
      const speed = 0.04 + Math.random() * 0.12;
      const phase = Math.random() * Math.PI * 2;
      return {
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 24,
        z: (Math.random() - 0.5) * 18 - 6,
        speed,
        speedY: speed * 0.7,
        phase,
        phaseY: phase + 1,
        scale: 0.015 + Math.random() * 0.025,
      };
    });
  }, []);

  // Only update every 2nd frame — ambient particles don't need 60fps
  const frameSkip = useRef(0);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    frameSkip.current++;
    if (frameSkip.current % 2 !== 0) return;

    const time = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = data[i];
      dummy.position.set(
        p.x + Math.sin(time * p.speed + p.phase) * 0.6,
        p.y + Math.sin(time * p.speedY + p.phaseY) * 0.4,
        p.z
      );
      dummy.scale.setScalar(p.scale + Math.sin(time * 1.5 + p.phase) * 0.005);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color={COLOR.bg}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   User avatar — sphere + ring
   ──────────────────────────────────────────── */

function UserNode({ elapsedRef }: { elapsedRef: ElRef }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.sin(time * 0.5) * 0.2;
      ringRef.current.rotation.y = time * 0.3;
    }
    if (lightRef.current) {
      const answerP = phaseT(t, PHASE.ANSWER);
      const glow = answerP > 0.7 ? easeOut((answerP - 0.7) / 0.3) : 0;
      lightRef.current.intensity = 0.5 + glow * 6;
    }
  });

  return (
    <group position={POS.user}>
      <pointLight
        ref={lightRef}
        color={COLOR.user}
        intensity={0.5}
        distance={6}
      />
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.user}
          emissive={COLOR.user}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.8, 0.06, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.user}
          emissive={COLOR.user}
          emissiveIntensity={0.5}
        />
      </mesh>
      <Text
        position={[0, -1.3, 0]}
        fontSize={0.28}
        color={COLOR.user}
        anchorX="center"
        anchorY="middle"
      >
        User
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Flying Query orb + particle trail
   ──────────────────────────────────────────── */

function QueryFlight({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const labelRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const TRAIL = 25;
  const trail = useRef(new TrailRing(TRAIL));

  // Reusable temp vector — no allocation per frame
  const _pos = useRef<V3>([0, 0, 0]);

  function computePos(t: number): boolean {
    if (t < 0.2 || t >= 2.5) return false;
    const p = easeInOut(clamp01((t - 0.2) / 2.3));
    _pos.current[0] = lerp(POS.user[0], POS.embed[0], p);
    _pos.current[1] =
      lerp(POS.user[1], POS.embed[1], p) + Math.sin(p * Math.PI) * 2.5;
    _pos.current[2] = Math.sin(p * Math.PI * 2) * 0.5;
    return true;
  }

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const hasPos = computePos(t);
    const cur = _pos.current;
    if (t < 0.1) trail.current.reset();

    // Orb
    if (orbRef.current) {
      if (hasPos) {
        orbRef.current.position.set(cur[0], cur[1], cur[2]);
        orbRef.current.visible = true;
        orbRef.current.scale.setScalar(
          0.3 + Math.sin(clock.elapsedTime * 8) * 0.04
        );
      } else {
        orbRef.current.visible = false;
      }
    }

    // Light
    if (lightRef.current) {
      if (hasPos) {
        lightRef.current.position.set(cur[0], cur[1], cur[2]);
        lightRef.current.intensity = 3;
      } else {
        lightRef.current.intensity = 0;
      }
    }

    // Label
    if (labelRef.current) {
      if (hasPos && t < 2.2) {
        labelRef.current.position.set(cur[0], cur[1] + 0.7, cur[2]);
        labelRef.current.visible = true;
      } else {
        labelRef.current.visible = false;
      }
    }

    // Trail — O(1) circular buffer push
    if (hasPos) {
      const ring = trail.current;
      if (ring.length === 0) {
        ring.push(cur[0], cur[1], cur[2]);
      } else {
        const last = ring.get(0);
        const dx = cur[0] - last[0];
        const dy = cur[1] - last[1];
        const dz = cur[2] - last[2];
        if (dx * dx + dy * dy + dz * dz > 0.0064) {
          ring.push(cur[0], cur[1], cur[2]);
        }
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && hasPos) {
          const p = ring.get(i);
          dummy.position.set(p[0], p[1], p[2]);
          dummy.scale.setScalar(((TRAIL - i) / TRAIL) * 0.15);
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        trailRef.current.setMatrixAt(i, dummy.matrix);
      }
      trailRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={orbRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.query}
          emissive={COLOR.query}
          emissiveIntensity={1.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.query}
        intensity={0}
        distance={6}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.query}
          emissive={COLOR.query}
          emissiveIntensity={1}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.35}
          color={COLOR.query}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Query?
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Embedding burst — query shatters into vectors
   Uses individual meshes (not InstancedMesh) for
   maximum compatibility. 24 meshes is lightweight.
   ──────────────────────────────────────────── */

const EMBED_COUNT = 24;

// Pre-compute particle data at module level (stable across renders)
const EMBED_PARTICLES = Array.from({ length: EMBED_COUNT }, (_, i) => {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / EMBED_COUNT);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  const dx = Math.sin(phi) * Math.cos(theta);
  const dy = Math.sin(phi) * Math.sin(theta);
  const dz = Math.cos(phi);
  return { dx, dy, dz };
});

function EmbeddingParticle({
  index,
  elapsedRef,
  dbTarget,
}: {
  index: number;
  elapsedRef: ElRef;
  dbTarget: V3;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pt = EMBED_PARTICLES[index];

  const burstEnd = useMemo<V3>(
    () => [
      POS.embed[0] + pt.dx * 2.8,
      POS.embed[1] + pt.dy * 2.8,
      POS.embed[2] + pt.dz * 2.8,
    ],
    [pt]
  );

  useFrame(() => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.EMBED);

    if (p <= 0 || p >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    if (p < 0.4) {
      // Burst outward
      const bp = easeOut(p / 0.4);
      meshRef.current.position.set(
        POS.embed[0] + pt.dx * bp * 2.8,
        POS.embed[1] + pt.dy * bp * 2.8,
        POS.embed[2] + pt.dz * bp * 2.8
      );
      meshRef.current.scale.setScalar(0.08 + bp * 0.06);
    } else {
      // Converge to DB
      const cp = easeInOut((p - 0.4) / 0.6);
      meshRef.current.position.set(
        lerp(burstEnd[0], dbTarget[0], cp),
        lerp(burstEnd[1], dbTarget[1], cp),
        lerp(burstEnd[2], dbTarget[2], cp)
      );
      meshRef.current.scale.setScalar(0.12 * (1 - cp * 0.3));
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={COLOR.embed}
        emissive={COLOR.embed}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

function EmbeddingBurst({ elapsedRef }: { elapsedRef: ElRef }) {
  const lightRef = useRef<THREE.PointLight>(null);

  // Stable random DB targets, computed once
  const dbTargets = useMemo(
    () =>
      Array.from({ length: EMBED_COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.6;
        return [
          POS.db[0] + Math.cos(angle) * r,
          POS.db[1] + (Math.random() - 0.5) * 1.6,
          POS.db[2] + Math.sin(angle) * r,
        ] as V3;
      }),
    []
  );

  // Light that follows the burst
  useFrame(() => {
    if (!lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.EMBED);
    lightRef.current.intensity = p > 0 && p < 1 ? 4 * Math.sin(p * Math.PI) : 0;
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.embed}
        color={COLOR.embed}
        intensity={0}
        distance={8}
      />
      {dbTargets.map((target, i) => (
        <EmbeddingParticle
          key={i}
          index={i}
          elapsedRef={elapsedRef}
          dbTarget={target}
        />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Vector Database — cylinder with internal dots
   ──────────────────────────────────────────── */

function VectorDB({ elapsedRef }: { elapsedRef: ElRef }) {
  const DOT_COUNT = 40;
  const cylRef = useRef<THREE.Mesh>(null);
  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);


  // Pooled color objects — NEVER allocate in useFrame
  const tempColor = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const dbColor = useMemo(() => new THREE.Color(COLOR.db), []);

  const dots = useMemo(
    () =>
      Array.from({ length: DOT_COUNT }, (_, i) => {
        if (i < 10) {
          // First 10 = result dots — deterministic positions matching DATA_DOTS
          const angle = ((i * 137.508) * Math.PI) / 180;
          const r = (i / 10) * 0.7;
          return {
            pos: [
              Math.cos(angle) * r,
              (i / 10 - 0.5) * 2.2,
              Math.sin(angle) * r,
            ] as V3,
          };
        }
        // Remaining dots — seeded pseudo-random using index
        const angle = ((i * 137.508 + 42) * Math.PI) / 180;
        const r = ((i - 10) / (DOT_COUNT - 10)) * 0.7;
        return {
          pos: [
            Math.cos(angle) * r,
            (((i - 10) / (DOT_COUNT - 10)) - 0.5) * 2.2,
            Math.sin(angle) * r,
          ] as V3,
        };
      }),
    []
  );

  // Track previous searchP to skip color updates when nothing changes
  const prevSearchP = useRef(-1);

  useFrame(({ clock }) => {
    if (!cylRef.current || !dotsRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const searchP = phaseT(t, PHASE.SEARCH);

    cylRef.current.rotation.y = time * 0.12;

    // Only update colors when searchP actually changes (> threshold)
    const needsColorUpdate =
      Math.abs(searchP - prevSearchP.current) > 0.005 ||
      (prevSearchP.current === -1 && searchP === 0);
    prevSearchP.current = searchP;

    for (let i = 0; i < DOT_COUNT; i++) {
      const d = dots[i];
      const isResult = i < 10;

      if (isResult && searchP > 0.5) {
        const ep = easeOut(clamp01((searchP - 0.5 - i * 0.015) / 0.35));
        dummy.position.set(
          d.pos[0] * (1 + ep * 1.5),
          d.pos[1] + ep * 2.5,
          d.pos[2] * (1 + ep * 1.5)
        );
        dummy.scale.setScalar(0.06 + ep * 0.05);
      } else {
        dummy.position.set(
          d.pos[0],
          d.pos[1] + Math.sin(time + i) * 0.04,
          d.pos[2]
        );
        dummy.scale.setScalar(0.06);
      }
      dummy.updateMatrix();
      dotsRef.current!.setMatrixAt(i, dummy.matrix);

      // Color — skip if unchanged
      if (needsColorUpdate) {
        if (searchP > 0 && searchP < 0.5) {
          const wave = Math.sin((searchP * 5 - i / DOT_COUNT) * Math.PI);
          const brightness = Math.max(0, wave);
          tempColor.copy(dbColor).lerp(white, brightness * 0.85);
        } else if (isResult && searchP >= 0.5) {
          tempColor.copy(white);
        } else {
          tempColor.copy(dbColor);
        }
        dotsRef.current!.setColorAt(i, tempColor);
      }
    }

    dotsRef.current.instanceMatrix.needsUpdate = true;
    if (needsColorUpdate && dotsRef.current.instanceColor)
      dotsRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group position={POS.db}>
      <mesh ref={cylRef}>
        <cylinderGeometry args={[1.2, 1.2, 2.8, 32, 1, true]} />
        <meshStandardMaterial
          color={COLOR.db}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          emissive={COLOR.db}
          emissiveIntensity={0.15}
        />
      </mesh>
      {[1.4, -1.4].map((y) => (
        <mesh
          key={y}
          position={[0, y, 0]}
          rotation={[y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[1.2, 32]} />
          <meshStandardMaterial
            color={COLOR.db}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={dotsRef}
        args={[undefined, undefined, DOT_COUNT]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.db}
          emissive={COLOR.db}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </instancedMesh>
      <Text
        position={[0, -2.2, 0]}
        fontSize={0.26}
        color={COLOR.db}
        anchorX="center"
        anchorY="middle"
      >
        Vector DB
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Data stream — 10 dots fly from VectorDB → LLM
   Uses individual meshes for reliable rendering.
   Start positions match VectorDB's result dots
   (i < 10) at their fully-emerged state, so the
   dots visually continue from where the DB left them.
   ──────────────────────────────────────────── */

// Pre-compute start positions matching VectorDB result dots (i < 10)
// at full emergence (ep=1): pos * 2.5 for x/z spread, pos.y + 2.5
const DATA_DOTS = Array.from({ length: 10 }, (_, i) => {
  // Mirror VectorDB's dot generation (same seed logic)
  const angle = ((i * 137.508) * Math.PI) / 180; // golden angle spread
  const r = (i / 10) * 0.7;
  const basePos: V3 = [
    Math.cos(angle) * r,
    ((i / 10) - 0.5) * 2.2,
    Math.sin(angle) * r,
  ];
  // At full emergence (ep=1): spread 2.5x outward, rise 2.5
  const startPos: V3 = [
    POS.db[0] + basePos[0] * 2.5,
    POS.db[1] + basePos[1] + 2.5,
    POS.db[2] + basePos[2] * 2.5,
  ];
  return { start: startPos, delay: i * 0.06 };
});

function DataDot({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = DATA_DOTS[index];

  useFrame(() => {
    if (!meshRef.current) return;
    const dataP = phaseT(elapsedRef.current, PHASE.DATA);

    if (dataP <= 0 || dataP >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeInOut(clamp01((dataP - item.delay) / (1 - item.delay * 1.5)));

    // Fly from VectorDB emergence position to LLM
    const x = lerp(item.start[0], POS.llm[0], ip);
    const y = lerp(item.start[1], POS.llm[1], ip) + Math.sin(ip * Math.PI) * 1.8;
    const z = lerp(item.start[2], POS.llm[2], ip);
    meshRef.current.position.set(x, y, z);

    const s = 0.12 + ip * 0.04;
    meshRef.current.scale.set(s, s * 1.3, s * 0.4);
    meshRef.current.rotation.z = ip * Math.PI * 0.5;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.data}
        emissive={COLOR.data}
        emissiveIntensity={1.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function DataStream({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const dataP = phaseT(elapsedRef.current, PHASE.DATA);
    labelRef.current.visible = dataP > 0.1 && dataP < 0.9;
  });

  return (
    <group>
      {DATA_DOTS.map((_, i) => (
        <DataDot key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[3.5, 2.8, 0]}>
        <Text
          fontSize={0.3}
          color={COLOR.data}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Data ×10
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   LLM Core — distorted icosahedron + wireframe
   ──────────────────────────────────────────── */

function LLMCore({ elapsedRef }: { elapsedRef: ElRef }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<
    THREE.MeshStandardMaterial & { distort?: number; speed?: number }
  >(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const processP = phaseT(t, PHASE.LLM);
    const dataP = phaseT(t, PHASE.DATA);
    const activity = Math.max(processP, dataP * 0.4);

    if (outerRef.current) {
      outerRef.current.rotation.y = time * (0.2 + activity * 0.6);
      outerRef.current.rotation.x = Math.sin(time * 0.3) * 0.15;
      outerRef.current.scale.setScalar(1 + activity * 0.2);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.5;
      innerRef.current.rotation.z = time * 0.35;
    }
    if (matRef.current) {
      if (matRef.current.distort !== undefined)
        matRef.current.distort = 0.12 + activity * 0.38;
      matRef.current.emissiveIntensity = 0.2 + activity * 1.2;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.3 + activity * 5;
    }
  });

  return (
    <group position={POS.llm}>
      <pointLight
        ref={lightRef}
        color={COLOR.llm}
        intensity={0.3}
        distance={8}
      />
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.2, 4]} />
        <MeshDistortMaterial
          ref={matRef as never}
          color={COLOR.llm}
          emissive={COLOR.llm}
          emissiveIntensity={0.2}
          distort={0.12}
          speed={2}
          transparent
          opacity={0.65}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.6, 2]} />
        <meshStandardMaterial
          color={COLOR.llm}
          emissive={COLOR.llm}
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      <Text
        position={[0, -2, 0]}
        fontSize={0.3}
        color={COLOR.llm}
        anchorX="center"
        anchorY="middle"
      >
        LLM
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Answer orb — arcs from LLM back to user
   ──────────────────────────────────────────── */

function AnswerReturn({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const TRAIL = 30;
  const trail = useRef(new TrailRing(TRAIL));

  const _pos = useRef<V3>([0, 0, 0]);

  function computePos(t: number): boolean {
    const p = phaseT(t, PHASE.ANSWER);
    if (p <= 0 || p >= 1) return false;
    const e = easeInOut(p);
    _pos.current[0] = lerp(POS.llm[0], POS.user[0], e);
    _pos.current[1] = Math.sin(e * Math.PI) * 5;
    _pos.current[2] = Math.sin(e * Math.PI) * 2.5;
    return true;
  }

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const hasPos = computePos(t);
    const cur = _pos.current;
    if (t < 0.1) trail.current.reset();

    if (orbRef.current) {
      if (hasPos) {
        orbRef.current.position.set(cur[0], cur[1], cur[2]);
        orbRef.current.visible = true;
        orbRef.current.scale.setScalar(
          0.35 + Math.sin(clock.elapsedTime * 10) * 0.05
        );
      } else {
        orbRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      if (hasPos) {
        lightRef.current.position.set(cur[0], cur[1], cur[2]);
        lightRef.current.intensity = 4;
      } else {
        lightRef.current.intensity = 0;
      }
    }

    if (labelRef.current) {
      if (hasPos) {
        labelRef.current.position.set(cur[0], cur[1] + 0.8, cur[2]);
        labelRef.current.visible = true;
      } else {
        labelRef.current.visible = false;
      }
    }

    // Trail — O(1)
    if (hasPos) {
      const ring = trail.current;
      if (ring.length === 0) {
        ring.push(cur[0], cur[1], cur[2]);
      } else {
        const last = ring.get(0);
        const dx = cur[0] - last[0];
        const dy = cur[1] - last[1];
        const dz = cur[2] - last[2];
        if (dx * dx + dy * dy + dz * dz > 0.0036) {
          ring.push(cur[0], cur[1], cur[2]);
        }
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && hasPos) {
          const p = ring.get(i);
          dummy.position.set(p[0], p[1], p[2]);
          dummy.scale.setScalar(((TRAIL - i) / TRAIL) * 0.18);
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        trailRef.current.setMatrixAt(i, dummy.matrix);
      }
      trailRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={orbRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.answer}
          emissive={COLOR.answer}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.answer}
        intensity={0}
        distance={8}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.answer}
          emissive={COLOR.answer}
          emissiveIntensity={1.2}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.38}
          color={COLOR.answer}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Answer
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Connection lines (faint guides between stages)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.user, POS.embed, POS.db, POS.llm];
    const pts = stages.map((p) => new THREE.Vector3(...p));
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, []);

  return <primitive object={lineObj} />;
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function RagScene({
  playing,
  onStepChange,
  onComplete,
}: RagSceneProps) {
  const elapsedRef = useRef(0);
  const prevPlayingRef = useRef(false);
  const lastStepRef = useRef(-1);

  // Store callbacks in refs to avoid stale closures in useFrame
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useFrame((_, delta) => {
    if (playing && !prevPlayingRef.current) {
      elapsedRef.current = 0;
      lastStepRef.current = -1;
    }
    prevPlayingRef.current = playing;

    if (!playing) return;
    elapsedRef.current += delta;

    const t = elapsedRef.current;

    let step = -1;
    if (t >= PHASE.QUERY[0]) step = 0;
    if (t >= PHASE.EMBED[0]) step = 1;
    if (t >= PHASE.SEARCH[0]) step = 2;
    if (t >= PHASE.DATA[0]) step = 3;
    if (t >= PHASE.LLM[0]) step = 4;
    if (t >= PHASE.ANSWER[0]) step = 5;

    if (step !== lastStepRef.current && step < TOTAL_STEPS) {
      lastStepRef.current = step;
      onStepChangeRef.current(step);
    }

    if (t >= TOTAL_DURATION) {
      onCompleteRef.current();
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 5]} intensity={0.35} />
      <directionalLight position={[-8, 4, -3]} intensity={0.15} />

      {/* Background */}
      <AmbientParticles />
      <ConnectionLines />

      {/* Stage elements */}
      <UserNode elapsedRef={elapsedRef} />
      <VectorDB elapsedRef={elapsedRef} />
      <LLMCore elapsedRef={elapsedRef} />

      {/* Animated flow */}
      <QueryFlight elapsedRef={elapsedRef} />
      <EmbeddingBurst elapsedRef={elapsedRef} />
      <DataStream elapsedRef={elapsedRef} />
      <AnswerReturn elapsedRef={elapsedRef} />
    </>
  );
}
