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
   Chain Link — a torus connecting two bubbles
   ──────────────────────────────────────────── */

function ChainLink({
  from,
  to,
  color,
  appearPhase,
  elapsedRef,
}: {
  from: V3;
  to: V3;
  color: string;
  appearPhase: readonly [number, number];
  elapsedRef: ElRef;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const p = phaseT(elapsedRef.current, appearPhase);
    const time = clock.elapsedTime;

    if (p <= 0) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    const ep = easeOut(clamp01(p / 0.5));

    // Position midway between from and to
    const mx = (from[0] + to[0]) / 2;
    const my = (from[1] + to[1]) / 2;
    const mz = (from[2] + to[2]) / 2;
    groupRef.current.position.set(mx, my, mz);

    // Rotate to face from→to direction
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    groupRef.current.lookAt(
      mx + dx,
      my + dy,
      mz + dz,
    );
    groupRef.current.rotateY(Math.PI / 2);

    groupRef.current.scale.setScalar(ep * 0.5);
    groupRef.current.rotation.x += Math.sin(time * 2) * 0.1;
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Two interlocking torus links */}
      <mesh>
        <torusGeometry args={[0.5, 0.08, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, Math.PI / 4]}>
        <torusGeometry args={[0.5, 0.08, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────
   Question orb — pulsing question mark
   ──────────────────────────────────────────── */

function QuestionOrb({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.QUESTION);
    const time = clock.elapsedTime;

    if (orbRef.current) {
      if (p <= 0) {
        orbRef.current.visible = false;
      } else {
        orbRef.current.visible = true;
        const scale = p < 0.3 ? easeOut(p / 0.3) : 1;
        orbRef.current.scale.setScalar(
          scale * 0.7 + Math.sin(time * 3) * 0.05,
        );
      }
    }
    if (glowRef.current) {
      glowRef.current.visible = p > 0;
      if (p > 0) {
        const pulse = 1 + Math.sin(time * 4) * 0.15;
        glowRef.current.scale.setScalar(1.2 * pulse);
      }
    }
    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + Math.sin(time * 3) * 0.5 : 0;
    }
  });

  return (
    <group position={POS.question}>
      <pointLight
        ref={lightRef}
        color={COLOR.question}
        intensity={0}
        distance={6}
      />
      <mesh ref={orbRef} visible={false}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.question}
          emissive={COLOR.question}
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshStandardMaterial
          color={COLOR.question}
          emissive={COLOR.question}
          emissiveIntensity={0.3}
          transparent
          opacity={0.12}
          wireframe
        />
      </mesh>
      <Text
        position={[0, 0, 0.9]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="black"
      >
        ?
      </Text>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.26}
        color={COLOR.question}
        anchorX="center"
        anchorY="middle"
      >
        Question
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Thought Bubble — a rounded sphere with internal motion
   ──────────────────────────────────────────── */

interface ThoughtBubbleProps {
  position: V3;
  color: string;
  label: string;
  phase: readonly [number, number];
  elapsedRef: ElRef;
  /** Symbol shown inside the bubble */
  icon?: string;
}

function ThoughtBubble({
  position,
  color,
  label,
  phase,
  elapsedRef,
  icon,
}: ThoughtBubbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, phase);
    const time = clock.elapsedTime;

    if (groupRef.current) {
      if (p <= 0) {
        groupRef.current.visible = false;
        if (lightRef.current) lightRef.current.intensity = 0;
        return;
      }

      groupRef.current.visible = true;
      const scale = p < 0.3 ? easeOut(p / 0.3) : 1;
      groupRef.current.scale.setScalar(scale);
      // Gentle bobbing
      groupRef.current.position.set(
        position[0],
        position[1] + Math.sin(time * 1.5 + position[0]) * 0.15,
        position[2],
      );
    }

    if (innerRef.current) {
      innerRef.current.rotation.y = time * 0.4;
      innerRef.current.rotation.x = Math.sin(time * 0.6) * 0.2;
      // Pulse when active
      const pulse = p > 0.3 ? 1 + Math.sin(time * 5) * 0.1 : 1;
      innerRef.current.scale.setScalar(0.4 * pulse);
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 1.5 + p * 2 : 0;
    }
  });

  return (
    <group ref={groupRef} visible={false} position={position}>
      <pointLight ref={lightRef} color={color} intensity={0} distance={5} />
      {/* Outer bubble */}
      <mesh>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.2}
        />
      </mesh>
      {/* Inner wireframe structure */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          wireframe
          toneMapped={false}
        />
      </mesh>
      {/* Icon text */}
      {icon && (
        <Text
          position={[0, 0, 0.9]}
          fontSize={0.35}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          {icon}
        </Text>
      )}
      {/* Label */}
      <Text
        position={[0, -1.3, 0]}
        fontSize={0.2}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Decompose sub-parts — small orbiting dots
   ──────────────────────────────────────────── */

function DecomposeParticles({ elapsedRef }: { elapsedRef: ElRef }) {
  const COUNT = 8;
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.DECOMPOSE);
    const time = clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.visible = p > 0.2;
    }

    for (let i = 0; i < COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (p <= 0.2) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const ip = easeOut(clamp01((p - 0.2 - i * 0.05) / 0.5));
      const angle = (i / COUNT) * Math.PI * 2 + time * 0.8;
      const r = 0.6 + ip * 0.5;
      mesh.position.set(
        Math.cos(angle) * r,
        Math.sin(angle * 0.7) * 0.3,
        Math.sin(angle) * r,
      );
      mesh.scale.setScalar(0.08 * ip);
    }
  });

  return (
    <group ref={groupRef} position={POS.step2} visible={false}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={COLOR.step2}
            emissive={COLOR.step2}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Reasoning arrows — lines connecting step3's sub-parts
   ──────────────────────────────────────────── */

function ReasoningArrows({ elapsedRef }: { elapsedRef: ElRef }) {
  const COUNT = 6;
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.REASON);
    const time = clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.visible = p > 0.15;
    }

    for (let i = 0; i < COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (p <= 0.15) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const ip = easeOut(clamp01((p - 0.15 - i * 0.06) / 0.5));
      const angle = (i / COUNT) * Math.PI * 2 + time * 0.4;
      const r = 0.3;
      mesh.position.set(
        Math.cos(angle) * r,
        Math.sin(angle) * r * 0.5,
        0,
      );
      mesh.scale.set(0.5 * ip, 0.04, 0.04);
      mesh.rotation.z = angle;
    }
  });

  return (
    <group ref={groupRef} position={POS.step3} visible={false}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.step3}
            emissive={COLOR.step3}
            emissiveIntensity={1.2}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Verification checkmark — appears during verify phase
   ──────────────────────────────────────────── */

function VerifyCheckmark({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.VERIFY);
    const time = clock.elapsedTime;

    if (groupRef.current) {
      if (p < 0.3) {
        groupRef.current.visible = false;
        return;
      }
      groupRef.current.visible = true;
      const sp = easeOut((p - 0.3) / 0.7);
      groupRef.current.scale.setScalar(sp);
      groupRef.current.rotation.y = Math.sin(time * 2) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[POS.step4[0], POS.step4[1] + 1.3, POS.step4[2]]} visible={false}>
      <Text
        fontSize={0.5}
        color={COLOR.step4}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="black"
      >
        OK
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Answer orb — bright final answer
   ──────────────────────────────────────────── */

function AnswerOrb({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, PHASE.ANSWER);
    const time = clock.elapsedTime;

    if (orbRef.current) {
      if (p <= 0) {
        orbRef.current.visible = false;
      } else {
        orbRef.current.visible = true;
        const scale = p < 0.3 ? easeOut(p / 0.3) : 1;
        orbRef.current.scale.setScalar(
          scale * 0.8 + Math.sin(time * 4) * 0.04,
        );
      }
    }
    if (ringRef.current) {
      ringRef.current.visible = p > 0.3;
      if (p > 0.3) {
        const rp = easeOut((p - 0.3) / 0.7);
        ringRef.current.scale.setScalar(rp * 1.3);
        ringRef.current.rotation.x = time * 0.6;
        ringRef.current.rotation.y = time * 0.4;
      }
    }
    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + p * 7 : 0;
    }
  });

  return (
    <group position={POS.answer}>
      <pointLight
        ref={lightRef}
        color={COLOR.answer}
        intensity={0}
        distance={8}
      />
      <mesh ref={orbRef} visible={false}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.answer}
          emissive={COLOR.answer}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[1, 0.06, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.answer}
          emissive={COLOR.answer}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 0, 1]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="black"
      >
        !
      </Text>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.26}
        color={COLOR.answer}
        anchorX="center"
        anchorY="middle"
      >
        Answer
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Full chain line — connecting all elements
   Grows progressively as each step completes
   ──────────────────────────────────────────── */

function FullChainLine({ elapsedRef }: { elapsedRef: ElRef }) {
  const lineRef = useRef<THREE.Line>(null);

  const positions = useMemo(() => {
    const all = [POS.question, POS.step1, POS.step2, POS.step3, POS.step4, POS.answer];
    return all;
  }, []);

  const geometry = useMemo(() => {
    const pts = positions.map((p) => new THREE.Vector3(...p));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [positions]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: COLOR.chain,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    if (!lineRef.current) return;
    const t = elapsedRef.current;
    // Make the line brighter as more steps complete
    const progress = clamp01(t / TOTAL_DURATION);
    (lineRef.current.material as THREE.LineBasicMaterial).opacity =
      0.06 + progress * 0.2;
  });

  const lineObj = useMemo(
    () => new THREE.Line(geometry, material),
    [geometry, material],
  );

  return <primitive object={lineObj} ref={lineRef} />;
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function CotScene({
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
    if (t >= PHASE.QUESTION[0]) step = 0;
    if (t >= PHASE.UNDERSTAND[0]) step = 1;
    if (t >= PHASE.DECOMPOSE[0]) step = 2;
    if (t >= PHASE.REASON[0]) step = 3;
    if (t >= PHASE.VERIFY[0]) step = 4;
    if (t >= PHASE.ANSWER[0]) step = 5;

    if (step !== lastStepRef.current && step < TOTAL_STEPS) {
      lastStepRef.current = step;
      onStepChangeRef.current(step);
    }

    if (t >= TOTAL_DURATION) {
      onCompleteRef.current();
    }
  });

  // Chain link data: from, to, color, appear phase
  const chainLinks = useMemo(
    () => [
      { from: POS.question, to: POS.step1, color: COLOR.chain, phase: PHASE.UNDERSTAND },
      { from: POS.step1, to: POS.step2, color: COLOR.chain, phase: PHASE.DECOMPOSE },
      { from: POS.step2, to: POS.step3, color: COLOR.chain, phase: PHASE.REASON },
      { from: POS.step3, to: POS.step4, color: COLOR.chain, phase: PHASE.VERIFY },
      { from: POS.step4, to: POS.answer, color: COLOR.chain, phase: PHASE.ANSWER },
    ],
    [],
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 5]} intensity={0.35} />
      <directionalLight position={[-8, 4, -3]} intensity={0.15} />

      {/* Background */}
      <AmbientParticles />
      <FullChainLine elapsedRef={elapsedRef} />

      {/* Question */}
      <QuestionOrb elapsedRef={elapsedRef} />

      {/* Thought Bubbles */}
      <ThoughtBubble
        position={POS.step1}
        color={COLOR.step1}
        label="Understand"
        phase={PHASE.UNDERSTAND}
        elapsedRef={elapsedRef}
        icon="1"
      />
      <ThoughtBubble
        position={POS.step2}
        color={COLOR.step2}
        label="Decompose"
        phase={PHASE.DECOMPOSE}
        elapsedRef={elapsedRef}
        icon="2"
      />
      <ThoughtBubble
        position={POS.step3}
        color={COLOR.step3}
        label="Reason"
        phase={PHASE.REASON}
        elapsedRef={elapsedRef}
        icon="3"
      />
      <ThoughtBubble
        position={POS.step4}
        color={COLOR.step4}
        label="Verify"
        phase={PHASE.VERIFY}
        elapsedRef={elapsedRef}
        icon="4"
      />

      {/* Phase-specific details */}
      <DecomposeParticles elapsedRef={elapsedRef} />
      <ReasoningArrows elapsedRef={elapsedRef} />
      <VerifyCheckmark elapsedRef={elapsedRef} />

      {/* Chain links connecting bubbles */}
      {chainLinks.map((link, i) => (
        <ChainLink
          key={i}
          from={link.from}
          to={link.to}
          color={link.color}
          appearPhase={link.phase}
          elapsedRef={elapsedRef}
        />
      ))}

      {/* Answer */}
      <AnswerOrb elapsedRef={elapsedRef} />
    </>
  );
}
