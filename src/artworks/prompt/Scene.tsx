"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  type V3,
  type ElRef,
  type SceneProps,
  lerp,
  easeInOut,
  easeOut,
  clamp01,
  phaseT,
} from "../shared/sceneUtils";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";

/* ────────────────────────────────────────────
   Ambient floating particles
   ──────────────────────────────────────────── */

function AmbientParticles() {
  const count = 140;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 16 - 6,
        speed: 0.04 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2,
        scale: 0.012 + Math.random() * 0.02,
      })),
    [],
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
        p.x + Math.sin(time * p.speed + p.phase) * 0.5,
        p.y + Math.sin(time * p.speed * 0.7 + p.phase + 1) * 0.3,
        p.z,
      );
      dummy.scale.setScalar(p.scale);
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
   Connection lines (faint guides)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.query, POS.system, POS.context, POS.fewshot, POS.llm, POS.output];
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
   Raw Query — simple text cube
   ──────────────────────────────────────────── */

function RawQuery({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.RAW);
    const time = clock.elapsedTime;

    if (meshRef.current) {
      const scale = p < 0.3 ? easeOut(p / 0.3) : 1;
      meshRef.current.scale.setScalar(scale * 0.6);
      meshRef.current.rotation.y = time * 0.3;
      meshRef.current.visible = p > 0;
    }
    if (glowRef.current) {
      glowRef.current.visible = p > 0;
      glowRef.current.scale.setScalar(
        (p < 0.3 ? easeOut(p / 0.3) : 1) * 0.9 + Math.sin(time * 3) * 0.05,
      );
      glowRef.current.rotation.y = -time * 0.15;
    }
    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 1.5 + Math.sin(time * 4) * 0.3 : 0;
    }
  });

  return (
    <group position={POS.query}>
      <pointLight ref={lightRef} color={COLOR.query} intensity={0} distance={5} />
      <mesh ref={meshRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.query}
          emissive={COLOR.query}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.query}
          emissive={COLOR.query}
          emissiveIntensity={0.3}
          transparent
          opacity={0.15}
          wireframe
        />
      </mesh>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.26}
        color={COLOR.query}
        anchorX="center"
        anchorY="middle"
      >
        Raw Query
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   System Prompt — frame that wraps the query
   A wireframe box "template" that scales up
   ──────────────────────────────────────────── */

function SystemPrompt({ elapsedRef }: { elapsedRef: ElRef }) {
  const frameRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const edgesObj = useMemo(() => {
    const geo = new THREE.BoxGeometry(2.2, 1.6, 1.6);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({
      color: COLOR.system,
      transparent: true,
      opacity: 0.9,
    });
    return new THREE.LineSegments(edges, mat);
  }, []);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.SYSTEM);
    const time = clock.elapsedTime;

    if (frameRef.current) {
      const scale = p < 0.4 ? easeOut(p / 0.4) : 1;
      frameRef.current.scale.setScalar(scale);
      frameRef.current.visible = p > 0;
      frameRef.current.rotation.y = time * 0.15;
    }
    if (edgesRef.current) {
      const scale = p < 0.4 ? easeOut(p / 0.4) : 1;
      edgesRef.current.scale.setScalar(scale);
      edgesRef.current.visible = p > 0;
      edgesRef.current.rotation.y = time * 0.15;
    }
    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 * Math.min(p * 3, 1) : 0;
    }
  });

  return (
    <group position={POS.system}>
      <pointLight ref={lightRef} color={COLOR.system} intensity={0} distance={6} />
      <mesh ref={frameRef} visible={false}>
        <boxGeometry args={[2.2, 1.6, 1.6]} />
        <meshStandardMaterial
          color={COLOR.system}
          emissive={COLOR.system}
          emissiveIntensity={0.2}
          transparent
          opacity={0.08}
        />
      </mesh>
      <primitive object={edgesObj} ref={edgesRef} visible={false} />
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.24}
        color={COLOR.system}
        anchorX="center"
        anchorY="middle"
      >
        System Prompt
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Context Injection — blocks attaching from sides
   ──────────────────────────────────────────── */

const CONTEXT_BLOCKS = [
  { offset: [0, 1.2, 0] as V3, delay: 0 },
  { offset: [0, -1.2, 0] as V3, delay: 0.15 },
  { offset: [1.2, 0, 0] as V3, delay: 0.3 },
  { offset: [-1.2, 0, 0] as V3, delay: 0.45 },
  { offset: [0, 0, 1.2] as V3, delay: 0.1 },
  { offset: [0, 0, -1.2] as V3, delay: 0.25 },
];

function ContextBlock({
  offset,
  delay,
  elapsedRef,
}: {
  offset: V3;
  delay: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.CONTEXT);
    const ip = clamp01((p - delay) / (1 - delay * 1.5));

    if (ip <= 0) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ep = easeOut(ip);
    // fly in from far out along the offset direction
    const dist = 4 * (1 - ep);
    meshRef.current.position.set(
      offset[0] * (1 + dist),
      offset[1] * (1 + dist),
      offset[2] * (1 + dist),
    );
    meshRef.current.scale.setScalar(0.3 * ep);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 0.6, 0.6]} />
      <meshStandardMaterial
        color={COLOR.context}
        emissive={COLOR.context}
        emissiveIntensity={1}
        toneMapped={false}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function ContextInjection({ elapsedRef }: { elapsedRef: ElRef }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.CONTEXT);
    lightRef.current.intensity = p > 0 ? 2 * Math.sin(p * Math.PI) : 0;
  });

  return (
    <group position={POS.context}>
      <pointLight ref={lightRef} color={COLOR.context} intensity={0} distance={6} />
      {CONTEXT_BLOCKS.map((b, i) => (
        <ContextBlock key={i} offset={b.offset} delay={b.delay} elapsedRef={elapsedRef} />
      ))}
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.24}
        color={COLOR.context}
        anchorX="center"
        anchorY="middle"
      >
        Context
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Few-shot Examples — paired input/output blocks
   ──────────────────────────────────────────── */

const EXAMPLE_PAIRS = [
  { inPos: [-0.7, 0.9, 0] as V3, outPos: [0.7, 0.9, 0] as V3, delay: 0 },
  { inPos: [-0.7, 0, 0] as V3, outPos: [0.7, 0, 0] as V3, delay: 0.2 },
  { inPos: [-0.7, -0.9, 0] as V3, outPos: [0.7, -0.9, 0] as V3, delay: 0.4 },
];

function ExamplePair({
  inPos,
  outPos,
  delay,
  elapsedRef,
}: {
  inPos: V3;
  outPos: V3;
  delay: number;
  elapsedRef: ElRef;
}) {
  const inRef = useRef<THREE.Mesh>(null);
  const outRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const p = phaseT(elapsedRef.current, PHASE.FEWSHOT);
    const ip = clamp01((p - delay) / (1 - delay * 1.5));

    if (ip <= 0) {
      if (inRef.current) inRef.current.visible = false;
      if (outRef.current) outRef.current.visible = false;
      if (arrowRef.current) arrowRef.current.visible = false;
      return;
    }

    const ep = easeOut(ip);

    if (inRef.current) {
      inRef.current.visible = true;
      inRef.current.position.set(inPos[0] - 2 * (1 - ep), inPos[1], inPos[2]);
      inRef.current.scale.setScalar(0.3 * ep);
    }
    if (outRef.current) {
      outRef.current.visible = true;
      outRef.current.position.set(outPos[0] + 2 * (1 - ep), outPos[1], outPos[2]);
      outRef.current.scale.setScalar(0.3 * ep);
    }
    if (arrowRef.current) {
      arrowRef.current.visible = ip > 0.4;
      arrowRef.current.position.set(0, inPos[1], 0);
      arrowRef.current.scale.set(0.4 * Math.min(1, (ip - 0.4) / 0.4), 0.1, 0.1);
    }
  });

  return (
    <>
      <mesh ref={inRef} visible={false}>
        <boxGeometry args={[1, 0.5, 0.5]} />
        <meshStandardMaterial
          color={COLOR.fewshot}
          emissive={COLOR.fewshot}
          emissiveIntensity={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={outRef} visible={false}>
        <boxGeometry args={[1, 0.5, 0.5]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={arrowRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.4}
          transparent
          opacity={0.5}
        />
      </mesh>
    </>
  );
}

function FewShotExamples({ elapsedRef }: { elapsedRef: ElRef }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.FEWSHOT);
    lightRef.current.intensity = p > 0 ? 2 * Math.sin(p * Math.PI) : 0;
  });

  return (
    <group position={POS.fewshot}>
      <pointLight ref={lightRef} color={COLOR.fewshot} intensity={0} distance={6} />
      {EXAMPLE_PAIRS.map((pair, i) => (
        <ExamplePair
          key={i}
          inPos={pair.inPos}
          outPos={pair.outPos}
          delay={pair.delay}
          elapsedRef={elapsedRef}
        />
      ))}
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.22}
        color={COLOR.fewshot}
        anchorX="center"
        anchorY="middle"
      >
        Few-shot
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   LLM Processing — pulsing sphere
   ──────────────────────────────────────────── */

function LLMProcessing({ elapsedRef }: { elapsedRef: ElRef }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.LLM);
    const time = clock.elapsedTime;

    if (outerRef.current) {
      outerRef.current.rotation.y = time * (0.2 + p * 0.8);
      outerRef.current.rotation.x = Math.sin(time * 0.3) * 0.15;
      outerRef.current.scale.setScalar(1 + p * 0.25);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.5;
      innerRef.current.rotation.z = time * 0.35;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.3 + p * 5;
    }
  });

  return (
    <group position={POS.llm}>
      <pointLight ref={lightRef} color={COLOR.llm} intensity={0.3} distance={8} />
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1, 3]} />
        <meshStandardMaterial
          color={COLOR.llm}
          emissive={COLOR.llm}
          emissiveIntensity={0.4}
          transparent
          opacity={0.6}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={COLOR.llm}
          emissive={COLOR.llm}
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.28}
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
   Assembly flight — pieces fly toward LLM
   Small orbs fly from each stage to the LLM
   ──────────────────────────────────────────── */

const ASSEMBLY_PARTS = [
  { from: POS.query, color: COLOR.query, startPhase: PHASE.SYSTEM },
  { from: POS.system, color: COLOR.system, startPhase: PHASE.CONTEXT },
  { from: POS.context, color: COLOR.context, startPhase: PHASE.FEWSHOT },
  { from: POS.fewshot, color: COLOR.fewshot, startPhase: PHASE.LLM },
];

function AssemblyOrb({
  from,
  color,
  startPhase,
  elapsedRef,
}: {
  from: V3;
  color: string;
  startPhase: readonly [number, number];
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, startPhase);

    if (p <= 0 || p >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ep = easeInOut(p);
    meshRef.current.position.set(
      lerp(from[0], POS.llm[0], ep),
      lerp(from[1], POS.llm[1], ep) + Math.sin(ep * Math.PI) * 1.5,
      Math.sin(ep * Math.PI * 2) * 0.4,
    );
    meshRef.current.scale.setScalar(0.15 + Math.sin(p * Math.PI) * 0.08);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function AssemblyFlight({ elapsedRef }: { elapsedRef: ElRef }) {
  return (
    <group>
      {ASSEMBLY_PARTS.map((part, i) => (
        <AssemblyOrb
          key={i}
          from={part.from}
          color={part.color}
          startPhase={part.startPhase}
          elapsedRef={elapsedRef}
        />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Enhanced Output — glowing orb emerges
   ──────────────────────────────────────────── */

function EnhancedOutput({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.OUTPUT);
    const time = clock.elapsedTime;

    if (orbRef.current) {
      if (p <= 0) {
        orbRef.current.visible = false;
      } else {
        orbRef.current.visible = true;
        const scale = p < 0.3 ? easeOut(p / 0.3) : 1;
        // Emerge from LLM and fly to output position
        const moveP = easeInOut(clamp01(p / 0.6));
        orbRef.current.position.set(
          lerp(POS.llm[0], POS.output[0], moveP),
          lerp(POS.llm[1], POS.output[1], moveP) + Math.sin(moveP * Math.PI) * 2,
          Math.sin(moveP * Math.PI) * 1.5,
        );
        orbRef.current.scale.setScalar(scale * 0.55 + Math.sin(time * 5) * 0.03);
      }
    }
    if (ringRef.current) {
      ringRef.current.visible = p > 0.4;
      if (p > 0.4) {
        const rp = easeOut((p - 0.4) / 0.6);
        ringRef.current.position.copy(orbRef.current!.position);
        ringRef.current.scale.setScalar(rp * 1.2);
        ringRef.current.rotation.x = time * 0.5;
        ringRef.current.rotation.y = time * 0.3;
      }
    }
    if (lightRef.current) {
      if (p > 0) {
        lightRef.current.position.copy(orbRef.current!.position);
        lightRef.current.intensity = 2 + p * 6;
      } else {
        lightRef.current.intensity = 0;
      }
    }
  });

  return (
    <>
      <pointLight ref={lightRef} color={COLOR.output} intensity={0} distance={10} />
      <mesh ref={orbRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[0.8, 0.05, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[POS.output[0], POS.output[1] - 1.5, 0]}
        fontSize={0.24}
        color={COLOR.output}
        anchorX="center"
        anchorY="middle"
      >
        Enhanced Output
      </Text>
    </>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function PromptScene({
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
    if (t >= PHASE.RAW[0]) step = 0;
    if (t >= PHASE.SYSTEM[0]) step = 1;
    if (t >= PHASE.CONTEXT[0]) step = 2;
    if (t >= PHASE.FEWSHOT[0]) step = 3;
    if (t >= PHASE.LLM[0]) step = 4;
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

      {/* Stage elements */}
      <RawQuery elapsedRef={elapsedRef} />
      <SystemPrompt elapsedRef={elapsedRef} />
      <ContextInjection elapsedRef={elapsedRef} />
      <FewShotExamples elapsedRef={elapsedRef} />
      <LLMProcessing elapsedRef={elapsedRef} />

      {/* Animated flow */}
      <AssemblyFlight elapsedRef={elapsedRef} />
      <EnhancedOutput elapsedRef={elapsedRef} />
    </>
  );
}
