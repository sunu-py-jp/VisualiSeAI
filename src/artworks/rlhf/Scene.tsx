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
  TrailRing,
} from "../shared/sceneUtils";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";

/* ────────────────────────────────────────────
   Ambient floating particles (background)
   ──────────────────────────────────────────── */

function AmbientParticles() {
  const count = 160;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 24,
        z: (Math.random() - 0.5) * 18 - 6,
        speed: 0.04 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
        scale: 0.015 + Math.random() * 0.025,
      })),
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
        p.y + Math.sin(time * p.speed * 0.7 + p.phase + 1) * 0.4,
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
   Connection lines (faint guides between stages)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.llm, POS.outputA, POS.human, POS.reward, POS.ppo];
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
   LLM Sphere — main model being aligned
   ──────────────────────────────────────────── */

function LLMSphere({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const genP = phaseT(t, PHASE.GENERATE);
    const updateP = phaseT(t, PHASE.UPDATE);

    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.25;
      // Model grows slightly during update phase
      const baseScale = 1.0 + updateP * 0.25;
      meshRef.current.scale.setScalar(baseScale + Math.sin(time * 2) * 0.03);
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = -time * 0.35;
      wireRef.current.rotation.z = time * 0.2;
    }
    if (lightRef.current) {
      const activity = Math.max(genP, updateP);
      lightRef.current.intensity = 0.5 + activity * 4;
    }
  });

  return (
    <group position={POS.llm}>
      <pointLight
        ref={lightRef}
        color={COLOR.llm}
        intensity={0.5}
        distance={8}
      />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.1, 3]} />
        <meshStandardMaterial
          color={COLOR.llm}
          emissive={COLOR.llm}
          emissiveIntensity={0.3}
          transparent
          opacity={0.7}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshStandardMaterial
          color={COLOR.llm}
          emissive={COLOR.llm}
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.3}
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
   Two Output Orbs — LLM generates two responses
   ──────────────────────────────────────────── */

function OutputOrbs({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbARef = useRef<THREE.Mesh>(null);
  const orbBRef = useRef<THREE.Mesh>(null);
  const lightARef = useRef<THREE.PointLight>(null);
  const lightBRef = useRef<THREE.PointLight>(null);
  const labelARef = useRef<THREE.Group>(null);
  const labelBRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const genP = phaseT(t, PHASE.GENERATE);
    const compP = phaseT(t, PHASE.COMPARE);

    // During GENERATE: orbs fly out from LLM to positions
    const appear = easeOut(clamp01(genP / 0.7));
    // During COMPARE: selected orb brightens, other dims
    const selectP = easeInOut(clamp01((compP - 0.3) / 0.5));

    // Orb A (chosen one)
    if (orbARef.current) {
      if (genP > 0.1) {
        orbARef.current.visible = true;
        const px = lerp(POS.llm[0], POS.outputA[0], appear);
        const py =
          lerp(POS.llm[1], POS.outputA[1], appear) +
          Math.sin(appear * Math.PI) * 1.5;
        orbARef.current.position.set(px, py, 0);
        const s = 0.35 * appear + Math.sin(time * 3) * 0.02;
        orbARef.current.scale.setScalar(s);
      } else {
        orbARef.current.visible = false;
      }
    }

    // Orb B (rejected one)
    if (orbBRef.current) {
      if (genP > 0.2) {
        orbBRef.current.visible = true;
        const delayedAppear = easeOut(clamp01((genP - 0.15) / 0.7));
        const px = lerp(POS.llm[0], POS.outputB[0], delayedAppear);
        const py =
          lerp(POS.llm[1], POS.outputB[1], delayedAppear) -
          Math.sin(delayedAppear * Math.PI) * 1.5;
        orbBRef.current.position.set(px, py, 0);
        // Dims during selection
        const dimScale = compP > 0.3 ? 0.35 * (1 - selectP * 0.5) : 0.35;
        orbBRef.current.scale.setScalar(
          dimScale * delayedAppear + Math.sin(time * 2.5) * 0.02
        );
      } else {
        orbBRef.current.visible = false;
      }
    }

    // Lights
    if (lightARef.current) {
      lightARef.current.intensity =
        genP > 0.1 ? 1.5 + selectP * 3 : 0;
      if (orbARef.current?.visible) {
        lightARef.current.position.copy(orbARef.current.position);
      }
    }
    if (lightBRef.current) {
      lightBRef.current.intensity =
        genP > 0.2 ? 1.5 * (1 - selectP * 0.8) : 0;
      if (orbBRef.current?.visible) {
        lightBRef.current.position.copy(orbBRef.current.position);
      }
    }

    // Labels
    if (labelARef.current) {
      labelARef.current.visible = genP > 0.5 && compP < 0.9;
      if (orbARef.current?.visible) {
        labelARef.current.position.set(
          orbARef.current.position.x,
          orbARef.current.position.y + 0.7,
          0
        );
      }
    }
    if (labelBRef.current) {
      labelBRef.current.visible = genP > 0.5 && compP < 0.9;
      if (orbBRef.current?.visible) {
        labelBRef.current.position.set(
          orbBRef.current.position.x,
          orbBRef.current.position.y - 0.7,
          0
        );
      }
    }
  });

  return (
    <>
      {/* Output A - selected */}
      <mesh ref={orbARef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.outputA}
          emissive={COLOR.outputA}
          emissiveIntensity={1.2}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightARef}
        color={COLOR.outputA}
        intensity={0}
        distance={5}
      />
      <group ref={labelARef} visible={false}>
        <Text
          fontSize={0.24}
          color={COLOR.outputA}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Response A
        </Text>
      </group>

      {/* Output B - rejected */}
      <mesh ref={orbBRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.outputB}
          emissive={COLOR.outputB}
          emissiveIntensity={0.8}
          transparent
          opacity={0.75}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightBRef}
        color={COLOR.outputB}
        intensity={0}
        distance={5}
      />
      <group ref={labelBRef} visible={false}>
        <Text
          fontSize={0.24}
          color={COLOR.outputB}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Response B
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Human Selector — icon that picks preferred response
   ──────────────────────────────────────────── */

function HumanSelector({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const selectBeamRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const compP = phaseT(t, PHASE.COMPARE);

    if (groupRef.current) {
      const appear = easeOut(clamp01(compP / 0.3));
      groupRef.current.visible = compP > 0;
      groupRef.current.scale.setScalar(appear);
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = time * 0.5;
      ringRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
    }

    // Selection beam pointing to chosen response A
    if (selectBeamRef.current) {
      const selectP = easeInOut(clamp01((compP - 0.3) / 0.4));
      selectBeamRef.current.visible = compP > 0.3;
      selectBeamRef.current.scale.set(1, selectP * 2.5, 1);
      selectBeamRef.current.position.set(
        (POS.outputA[0] - POS.human[0]) * 0.5,
        (POS.outputA[1] - POS.human[1]) * 0.5 * selectP,
        0
      );
    }
  });

  return (
    <group ref={groupRef} position={POS.human} visible={false}>
      <pointLight color={COLOR.human} intensity={1.5} distance={5} />
      {/* Human icon — sphere head + body cone */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial
          color={COLOR.human}
          emissive={COLOR.human}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <coneGeometry args={[0.4, 0.8, 8]} />
        <meshStandardMaterial
          color={COLOR.human}
          emissive={COLOR.human}
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </mesh>
      {/* Rotating ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.9, 0.05, 8, 24]} />
        <meshStandardMaterial
          color={COLOR.human}
          emissive={COLOR.human}
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* Selection beam to preferred response */}
      <mesh ref={selectBeamRef} visible={false} rotation={[0, 0, Math.atan2(POS.outputA[1] - POS.human[1], POS.outputA[0] - POS.human[0])]}>
        <planeGeometry args={[0.06, 1]} />
        <meshStandardMaterial
          color={COLOR.selected}
          emissive={COLOR.selected}
          emissiveIntensity={2}
          transparent
          opacity={0.7}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Text
        position={[0, -1.4, 0]}
        fontSize={0.26}
        color={COLOR.human}
        anchorX="center"
        anchorY="middle"
      >
        Human
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Reward Signal — golden particles from human to reward model
   ──────────────────────────────────────────── */

const REWARD_PARTICLE_COUNT = 20;

function RewardParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const delay = index * 0.04;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const rewardP = phaseT(elapsedRef.current, PHASE.REWARD);

    if (rewardP <= delay || rewardP >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeInOut(clamp01((rewardP - delay) / (1 - delay * 1.5)));

    const x = lerp(POS.human[0], POS.reward[0], ip);
    const y =
      lerp(POS.human[1], POS.reward[1], ip) +
      Math.sin(ip * Math.PI) * (1.2 + index * 0.08) +
      Math.sin(clock.elapsedTime * 4 + index) * 0.15;
    const z = Math.sin(ip * Math.PI * 2 + index * 0.5) * 0.8;

    meshRef.current.position.set(x, y, z);
    meshRef.current.scale.setScalar(0.08 + Math.sin(ip * Math.PI) * 0.04);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={COLOR.reward}
        emissive={COLOR.reward}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

function RewardStream({ elapsedRef }: { elapsedRef: ElRef }) {
  return (
    <group>
      {Array.from({ length: REWARD_PARTICLE_COUNT }, (_, i) => (
        <RewardParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Reward Model — box that processes preferences
   ──────────────────────────────────────────── */

function RewardModel({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const rewardP = phaseT(t, PHASE.REWARD);

    if (meshRef.current) {
      const appear = easeOut(clamp01(rewardP / 0.3));
      meshRef.current.scale.setScalar(appear * 0.8);
      meshRef.current.rotation.y = time * 0.3;
      meshRef.current.rotation.x = Math.sin(time * 0.4) * 0.1;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = -time * 0.5;
    }
    if (lightRef.current) {
      lightRef.current.intensity = rewardP > 0 ? 1 + rewardP * 3 : 0;
    }
  });

  return (
    <group position={POS.reward}>
      <pointLight
        ref={lightRef}
        color={COLOR.reward}
        intensity={0}
        distance={6}
      />
      <mesh ref={meshRef}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial
          color={COLOR.reward}
          emissive={COLOR.reward}
          emissiveIntensity={0.4}
          transparent
          opacity={0.7}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <mesh ref={wireRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={COLOR.reward}
          emissive={COLOR.reward}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.24}
        color={COLOR.reward}
        anchorX="center"
        anchorY="middle"
      >
        Reward Model
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   PPO Training Loop — ring pulses around LLM
   ──────────────────────────────────────────── */

function PPOLoop({ elapsedRef }: { elapsedRef: ElRef }) {
  const RING_COUNT = 3;
  const ringsRef = useRef<(THREE.Mesh | null)[]>([]);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const TRAIL_COUNT = 25;
  const trail = useRef(new TrailRing(TRAIL_COUNT));

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const ppoP = phaseT(t, PHASE.PPO);
    if (t < 0.1) trail.current.reset();

    // PPO rings pulse around LLM
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = ringsRef.current[i];
      if (!ring) continue;
      const appear = easeOut(clamp01((ppoP - i * 0.1) / 0.3));
      ring.visible = ppoP > i * 0.1;
      const baseRadius = 1.8 + i * 0.5;
      ring.scale.setScalar(appear * baseRadius);
      ring.rotation.x = time * (0.5 + i * 0.2) + (i * Math.PI) / 3;
      ring.rotation.y = time * 0.3 * (i % 2 === 0 ? 1 : -1);
      ring.position.set(POS.llm[0], POS.llm[1], POS.llm[2]);
    }

    // Feedback trail from reward model back to LLM
    if (ppoP > 0.2 && ppoP < 0.95) {
      const loopT = ((time * 0.8) % 1);
      const feedbackX = lerp(POS.reward[0], POS.llm[0], loopT);
      const feedbackY = Math.sin(loopT * Math.PI) * 3;
      const feedbackZ = Math.cos(loopT * Math.PI * 2) * 1.5;
      trail.current.push(feedbackX, feedbackY, feedbackZ);
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL_COUNT; i++) {
        if (i < ring.length && ppoP > 0.2) {
          const p = ring.get(i);
          dummy.position.set(p[0], p[1], p[2]);
          dummy.scale.setScalar(((TRAIL_COUNT - i) / TRAIL_COUNT) * 0.12);
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
    <group>
      {/* PPO orbit rings */}
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringsRef.current[i] = el;
          }}
          visible={false}
        >
          <torusGeometry args={[1, 0.03, 8, 32]} />
          <meshStandardMaterial
            color={COLOR.ppo}
            emissive={COLOR.ppo}
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Feedback trail */}
      <instancedMesh
        ref={trailRef}
        args={[undefined, undefined, TRAIL_COUNT]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.ppo}
          emissive={COLOR.ppo}
          emissiveIntensity={1.2}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </instancedMesh>
      <Text
        position={[POS.ppo[0], POS.ppo[1] - 1.8, POS.ppo[2]]}
        fontSize={0.26}
        color={COLOR.ppo}
        anchorX="center"
        anchorY="middle"
      >
        PPO Training
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Aligned Output — green orb emerges from improved LLM
   ──────────────────────────────────────────── */

function AlignedOutput({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const TRAIL = 20;
  const trail = useRef(new TrailRing(TRAIL));

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const outP = phaseT(t, PHASE.OUTPUT);
    if (t < 0.1) trail.current.reset();

    const targetX = POS.llm[0] + 6;
    const targetY = 0;

    if (orbRef.current) {
      if (outP > 0) {
        orbRef.current.visible = true;
        const e = easeInOut(outP);
        const x = lerp(POS.llm[0], targetX, e);
        const y = Math.sin(e * Math.PI) * 2.5;
        orbRef.current.position.set(x, y, Math.sin(e * Math.PI) * 1.5);
        orbRef.current.scale.setScalar(
          0.4 + Math.sin(clock.elapsedTime * 8) * 0.04
        );
        trail.current.push(x, y, Math.sin(e * Math.PI) * 1.5);
      } else {
        orbRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = outP > 0 ? 3 + outP * 4 : 0;
      if (orbRef.current?.visible) {
        lightRef.current.position.copy(orbRef.current.position);
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && outP > 0) {
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
          color={COLOR.aligned}
          emissive={COLOR.aligned}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.aligned}
        intensity={0}
        distance={8}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.aligned}
          emissive={COLOR.aligned}
          emissiveIntensity={1}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function Scene({
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
    if (t >= PHASE.GENERATE[0]) step = 0;
    if (t >= PHASE.COMPARE[0]) step = 1;
    if (t >= PHASE.REWARD[0]) step = 2;
    if (t >= PHASE.PPO[0]) step = 3;
    if (t >= PHASE.UPDATE[0]) step = 4;
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
      <LLMSphere elapsedRef={elapsedRef} />
      <OutputOrbs elapsedRef={elapsedRef} />
      <HumanSelector elapsedRef={elapsedRef} />
      <RewardModel elapsedRef={elapsedRef} />
      <RewardStream elapsedRef={elapsedRef} />
      <PPOLoop elapsedRef={elapsedRef} />
      <AlignedOutput elapsedRef={elapsedRef} />
    </>
  );
}
