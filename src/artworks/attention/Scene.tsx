"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";
import {
  lerp,
  easeInOut,
  easeOut,
  clamp01,
  phaseT,
  type V3,
  type ElRef,
  type SceneProps,
} from "../shared/sceneUtils";

/* ────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────── */

const TOKEN_COUNT = 4;
// Pre-compute "attention scores" — some Q/K pairs have high similarity
const SCORES: number[][] = [
  [0.9, 0.2, 0.1, 0.05],
  [0.15, 0.8, 0.3, 0.1],
  [0.1, 0.25, 0.85, 0.2],
  [0.05, 0.15, 0.2, 0.9],
];
// Softmax-normalized (approximate)
const SOFTMAX: number[][] = SCORES.map((row) => {
  const expRow = row.map((v) => Math.exp(v * 3));
  const sum = expRow.reduce((a, b) => a + b, 0);
  return expRow.map((v) => v / sum);
});

/* ────────────────────────────────────────────
   Ambient floating particles (background)
   ──────────────────────────────────────────── */

function AmbientParticles() {
  const count = 180;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, () => {
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
      }),
    []
  );

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
      dummy.scale.setScalar(
        p.scale + Math.sin(time * 1.5 + p.phase) * 0.005
      );
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
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
   Connection lines (faint guides)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.input, POS.qkv, POS.dot, POS.softmax, POS.weighted, POS.output];
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

/* ────────────────────────────────────────────
   Input tokens — 4 orbs that split into Q/K/V
   ──────────────────────────────────────────── */

function InputToken({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const delay = index * 0.12;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const inP = phaseT(t, PHASE.INPUT);
    const qkvP = phaseT(t, PHASE.QKV);

    if (inP <= 0 || qkvP > 0.3) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    if (qkvP > 0) {
      // Fade out as QKV takes over
      const fade = 1 - easeOut(qkvP / 0.3);
      meshRef.current.scale.setScalar(0.3 * fade);
      meshRef.current.position.set(
        POS.input[0] + (index - 1.5) * 1.2,
        POS.input[1] + Math.sin(time * 0.5 + index) * 0.1,
        0
      );
    } else {
      const ip = easeOut(clamp01((inP - delay) / (1 - delay * TOKEN_COUNT)));
      meshRef.current.position.set(
        POS.input[0] + (index - 1.5) * 1.2,
        POS.input[1] + (1 - ip) * 3,
        0
      );
      meshRef.current.scale.setScalar(ip * 0.3);
    }
    meshRef.current.rotation.y = time * 0.3;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color={COLOR.input}
        emissive={COLOR.input}
        emissiveIntensity={0.5}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ────────────────────────────────────────────
   QKV Orb — each input splits into Q, K, V
   ──────────────────────────────────────────── */

function QKVOrb({
  tokenIndex,
  type,
  elapsedRef,
}: {
  tokenIndex: number;
  type: "q" | "k" | "v";
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const delay = tokenIndex * 0.08;

  const colorMap = { q: COLOR.query, k: COLOR.key, v: COLOR.value };
  const yTarget = { q: 2.2, k: 0, v: -2.2 };
  const col = colorMap[type];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const qkvP = phaseT(t, PHASE.QKV);
    const dotP = phaseT(t, PHASE.DOT);
    const softP = phaseT(t, PHASE.SOFTMAX);
    const weightP = phaseT(t, PHASE.WEIGHTED);
    const outP = phaseT(t, PHASE.OUTPUT);

    if (qkvP <= 0) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    let x: number, y: number, z: number;
    let scaleVal = 0.22;

    if (qkvP > 0 && dotP <= 0) {
      // Split from input position to Q/K/V arrangement
      const ip = easeInOut(clamp01((qkvP - delay) / 0.6));
      const fromX = POS.input[0] + (tokenIndex - 1.5) * 1.2;
      const toX = POS.qkv[0] + (tokenIndex - 1.5) * 1.0;
      x = lerp(fromX, toX, ip);
      y = lerp(POS.input[1], yTarget[type], ip);
      z = 0;
      scaleVal = lerp(0.1, 0.22, ip);
    } else if (dotP > 0 && softP <= 0) {
      // During dot product: Q and K move toward each other, V stays
      if (type === "v") {
        // V stays at QKV position, drifts slightly right
        const drift = easeInOut(dotP) * 2;
        x = POS.qkv[0] + (tokenIndex - 1.5) * 1.0 + drift;
        y = yTarget[type];
        z = 0;
      } else {
        // Q and K fly toward dot product zone
        const ip = easeInOut(clamp01((dotP - delay * 0.5) / 0.5));
        const fromX = POS.qkv[0] + (tokenIndex - 1.5) * 1.0;
        const toX = POS.dot[0] + (tokenIndex - 1.5) * 0.8;
        const toY = type === "q" ? 1.5 : -1.5;
        x = lerp(fromX, toX, ip);
        y = lerp(yTarget[type], toY, ip);
        z = 0;
      }
    } else if (softP > 0 && weightP <= 0) {
      if (type === "v") {
        // V orbs drift to weighted-sum area
        const ip = easeInOut(clamp01(softP / 0.6));
        x = lerp(
          POS.qkv[0] + (tokenIndex - 1.5) * 1.0 + 2,
          POS.weighted[0] + (tokenIndex - 1.5) * 0.8,
          ip
        );
        y = lerp(yTarget[type], POS.weighted[1] + (tokenIndex - 1.5) * 0.7, ip);
        z = 0;
        // Scale by attention weight (self-attention diagonal is largest)
        scaleVal = lerp(0.22, 0.12 + SOFTMAX[tokenIndex][tokenIndex] * 0.35, ip);
      } else if (type === "q") {
        // Q fades out during softmax
        x = POS.dot[0] + (tokenIndex - 1.5) * 0.8;
        y = 1.5;
        z = 0;
        scaleVal = 0.22 * (1 - easeOut(clamp01(softP / 0.4)));
        if (scaleVal < 0.01) { meshRef.current.visible = false; return; }
      } else {
        // K fades out during softmax
        x = POS.dot[0] + (tokenIndex - 1.5) * 0.8;
        y = -1.5;
        z = 0;
        scaleVal = 0.22 * (1 - easeOut(clamp01(softP / 0.4)));
        if (scaleVal < 0.01) { meshRef.current.visible = false; return; }
      }
    } else if (weightP > 0 && outP <= 0) {
      if (type === "v") {
        // V orbs converge to weighted sum
        const ip = easeInOut(clamp01(weightP / 0.7));
        x = lerp(
          POS.weighted[0] + (tokenIndex - 1.5) * 0.8,
          POS.weighted[0],
          ip
        );
        y = lerp(
          POS.weighted[1] + (tokenIndex - 1.5) * 0.7,
          POS.weighted[1],
          ip
        );
        z = 0;
        scaleVal = lerp(
          0.12 + SOFTMAX[tokenIndex][tokenIndex] * 0.35,
          0.15,
          ip
        );
        if (ip > 0.8) {
          scaleVal *= 1 - (ip - 0.8) / 0.2;
        }
      } else {
        meshRef.current.visible = false;
        return;
      }
    } else if (outP > 0) {
      meshRef.current.visible = false;
      return;
    } else {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.position.set(x, y, z);
    meshRef.current.scale.setScalar(scaleVal);
    meshRef.current.rotation.y = time * 0.5 + tokenIndex;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshStandardMaterial
        color={col}
        emissive={col}
        emissiveIntensity={1.2}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/* ────────────────────────────────────────────
   Dot Product beams — Q-K connections with score intensities
   ──────────────────────────────────────────── */

function DotProductBeams({ elapsedRef }: { elapsedRef: ElRef }) {
  // 16 lines: each Q token to each K token
  const lines = useMemo(() => {
    const arr: THREE.Line[] = [];
    for (let qi = 0; qi < TOKEN_COUNT; qi++) {
      for (let ki = 0; ki < TOKEN_COUNT; ki++) {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
          color: COLOR.softmax,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        arr.push(new THREE.Line(geom, mat));
      }
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const dotP = phaseT(t, PHASE.DOT);

    let idx = 0;
    for (let qi = 0; qi < TOKEN_COUNT; qi++) {
      for (let ki = 0; ki < TOKEN_COUNT; ki++) {
        const line = lines[idx++];
        if (!line) continue;

        if (dotP <= 0.1 || dotP >= 0.95) {
          (line.material as THREE.LineBasicMaterial).opacity = 0;
          continue;
        }

        const posArr = (line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;

        // Q position (top row)
        posArr[0] = POS.dot[0] + (qi - 1.5) * 0.8;
        posArr[1] = 1.5;
        posArr[2] = 0;
        // K position (bottom row)
        posArr[3] = POS.dot[0] + (ki - 1.5) * 0.8;
        posArr[4] = -1.5;
        posArr[5] = 0;
        line.geometry.attributes.position.needsUpdate = true;

        const score = SCORES[qi][ki];
        const wave = Math.sin(time * 2 + qi + ki * 0.5) * 0.2 + 0.8;
        const fadeIn = easeOut(clamp01((dotP - 0.1 - qi * 0.05) / 0.3));
        const fadeOut = 1 - easeOut(clamp01((dotP - 0.8) / 0.15));

        (line.material as THREE.LineBasicMaterial).opacity =
          score * wave * fadeIn * fadeOut * 0.8;
      }
    }
  });

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Softmax bars — probability visualization
   ──────────────────────────────────────────── */

function SoftmaxBars({ elapsedRef }: { elapsedRef: ElRef }) {
  const count = TOKEN_COUNT * TOKEN_COUNT; // 16 bars
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const softP = phaseT(t, PHASE.SOFTMAX);

    let idx = 0;
    for (let qi = 0; qi < TOKEN_COUNT; qi++) {
      for (let ki = 0; ki < TOKEN_COUNT; ki++) {
        if (softP <= 0.05 || softP >= 0.95) {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
        } else {
          const weight = SOFTMAX[qi][ki];
          const fadeIn = easeOut(clamp01((softP - qi * 0.05) / 0.4));
          const fadeOut = 1 - easeOut(clamp01((softP - 0.85) / 0.15));
          const barH = weight * 2.5 * fadeIn * fadeOut;

          dummy.position.set(
            POS.softmax[0] + (qi - 1.5) * 1.2,
            POS.softmax[1] - 1.5 + barH / 2 + (ki - 1.5) * 0.25,
            (ki - 1.5) * 0.6
          );
          dummy.scale.set(0.15, Math.max(barH, 0.01), 0.15);

          // Gentle wobble
          dummy.rotation.set(
            Math.sin(time + qi + ki) * 0.05,
            0,
            Math.sin(time * 0.7 + ki) * 0.03
          );
        }
        dummy.updateMatrix();
        ref.current.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.softmax}
        emissive={COLOR.softmax}
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.75}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Output orbs — final combined result
   ──────────────────────────────────────────── */

function OutputOrbs({ elapsedRef }: { elapsedRef: ElRef }) {
  const count = TOKEN_COUNT;
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const outP = phaseT(t, PHASE.OUTPUT);
    const weightP = phaseT(t, PHASE.WEIGHTED);

    for (let i = 0; i < count; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;

      if (outP <= 0 && weightP < 0.6) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;

      if (outP > 0) {
        // Final output arrangement
        const ip = easeOut(clamp01((outP - i * 0.08) / 0.6));
        mesh.position.set(
          lerp(POS.weighted[0], POS.output[0] + (i - 1.5) * 1.0, ip),
          lerp(POS.weighted[1], POS.output[1], ip) + Math.sin(ip * Math.PI) * 1.2,
          0
        );
        mesh.scale.setScalar(lerp(0.2, 0.35, ip));
      } else {
        // Forming at weighted sum position
        const ip = easeOut(clamp01((weightP - 0.6) / 0.4));
        mesh.position.set(
          POS.weighted[0] + (i - 1.5) * ip * 0.3,
          POS.weighted[1] + (i - 1.5) * ip * 0.3,
          0
        );
        mesh.scale.setScalar(ip * 0.2);
      }

      mesh.rotation.y = time * 0.4 + i;
    }
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color={COLOR.output}
            emissive={COLOR.output}
            emissiveIntensity={1.5}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </>
  );
}

/* ────────────────────────────────────────────
   Dot product sparks
   ──────────────────────────────────────────── */

function DotSparks({ elapsedRef }: { elapsedRef: ElRef }) {
  const count = 16;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (i % 4 - 1.5) * 0.8,
        speed: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const dotP = phaseT(t, PHASE.DOT);

    for (let i = 0; i < count; i++) {
      if (dotP <= 0.2 || dotP >= 0.9) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
      } else {
        const d = data[i];
        const fade = Math.sin((dotP - 0.2) / 0.7 * Math.PI);
        dummy.position.set(
          POS.dot[0] + d.x,
          Math.sin(time * d.speed + d.phase) * 0.8,
          Math.cos(time * d.speed * 0.6 + d.phase) * 0.4
        );
        dummy.scale.setScalar(0.03 + fade * 0.05);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={COLOR.softmax}
        emissive={COLOR.softmax}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Stage labels
   ──────────────────────────────────────────── */

function StageLabels({ elapsedRef }: { elapsedRef: ElRef }) {
  const inRef = useRef<THREE.Group>(null);
  const qkvRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Group>(null);
  const softRef = useRef<THREE.Group>(null);
  const wRef = useRef<THREE.Group>(null);
  const outRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = elapsedRef.current;
    if (inRef.current) inRef.current.visible = phaseT(t, PHASE.INPUT) > 0.1;
    if (qkvRef.current) qkvRef.current.visible = phaseT(t, PHASE.QKV) > 0.1;
    if (dotRef.current) dotRef.current.visible = phaseT(t, PHASE.DOT) > 0.1;
    if (softRef.current) softRef.current.visible = phaseT(t, PHASE.SOFTMAX) > 0.1;
    if (wRef.current) wRef.current.visible = phaseT(t, PHASE.WEIGHTED) > 0.1;
    if (outRef.current) outRef.current.visible = phaseT(t, PHASE.OUTPUT) > 0.1;
  });

  return (
    <>
      <group ref={inRef} visible={false}>
        <Text
          position={[POS.input[0], POS.input[1] - 2, 0]}
          fontSize={0.26}
          color={COLOR.input}
          anchorX="center"
          anchorY="middle"
        >
          Input
        </Text>
      </group>
      <group ref={qkvRef} visible={false}>
        <Text
          position={[POS.qkv[0], 3.4, 0]}
          fontSize={0.22}
          color={COLOR.query}
          anchorX="center"
          anchorY="middle"
        >
          Q (Query)
        </Text>
        <Text
          position={[POS.qkv[0], 1, 0]}
          fontSize={0.22}
          color={COLOR.key}
          anchorX="center"
          anchorY="middle"
        >
          K (Key)
        </Text>
        <Text
          position={[POS.qkv[0], -1.2, 0]}
          fontSize={0.22}
          color={COLOR.value}
          anchorX="center"
          anchorY="middle"
        >
          V (Value)
        </Text>
      </group>
      <group ref={dotRef} visible={false}>
        <Text
          position={[POS.dot[0], -2.5, 0]}
          fontSize={0.26}
          color={COLOR.softmax}
          anchorX="center"
          anchorY="middle"
        >
          Q . K
        </Text>
      </group>
      <group ref={softRef} visible={false}>
        <Text
          position={[POS.softmax[0], -2.5, 0]}
          fontSize={0.26}
          color={COLOR.softmax}
          anchorX="center"
          anchorY="middle"
        >
          Softmax
        </Text>
      </group>
      <group ref={wRef} visible={false}>
        <Text
          position={[POS.weighted[0], -2, 0]}
          fontSize={0.26}
          color={COLOR.value}
          anchorX="center"
          anchorY="middle"
        >
          Weighted Sum
        </Text>
      </group>
      <group ref={outRef} visible={false}>
        <Text
          position={[POS.output[0], -1.6, 0]}
          fontSize={0.26}
          color={COLOR.output}
          anchorX="center"
          anchorY="middle"
        >
          Output
        </Text>
      </group>
    </>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function AttentionScene({
  playing,
  onStepChange,
  onComplete,
}: SceneProps) {
  const elapsedRef = useRef(0);
  const prevPlayingRef = useRef(false);
  const lastStepRef = useRef(-1);

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
    if (t >= PHASE.INPUT[0]) step = 0;
    if (t >= PHASE.QKV[0]) step = 1;
    if (t >= PHASE.DOT[0]) step = 2;
    if (t >= PHASE.SOFTMAX[0]) step = 3;
    if (t >= PHASE.WEIGHTED[0]) step = 4;
    if (t >= PHASE.OUTPUT[0]) step = 5;

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

      {/* Stage labels */}
      <StageLabels elapsedRef={elapsedRef} />

      {/* Input tokens */}
      {Array.from({ length: TOKEN_COUNT }, (_, i) => (
        <InputToken key={i} index={i} elapsedRef={elapsedRef} />
      ))}

      {/* QKV orbs — 4 tokens x 3 types = 12 orbs */}
      {Array.from({ length: TOKEN_COUNT }, (_, i) => (
        <group key={`qkv-${i}`}>
          <QKVOrb tokenIndex={i} type="q" elapsedRef={elapsedRef} />
          <QKVOrb tokenIndex={i} type="k" elapsedRef={elapsedRef} />
          <QKVOrb tokenIndex={i} type="v" elapsedRef={elapsedRef} />
        </group>
      ))}

      {/* Dot product beams and sparks */}
      <DotProductBeams elapsedRef={elapsedRef} />
      <DotSparks elapsedRef={elapsedRef} />

      {/* Softmax bars */}
      <SoftmaxBars elapsedRef={elapsedRef} />

      {/* Output orbs */}
      <OutputOrbs elapsedRef={elapsedRef} />
    </>
  );
}
