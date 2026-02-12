"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  type SceneProps,
  type ElRef,
  lerp,
  easeInOut,
  easeOut,
  clamp01,
  phaseT,
} from "../shared/sceneUtils";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";

/* ────────────────────────────────────────────
   Ambient floating particles (background)
   ──────────────────────────────────────────── */

function AmbientParticles() {
  const count = 140;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 44,
        y: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 16 - 5,
        speed: 0.04 + Math.random() * 0.1,
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
        p.x + Math.sin(time * p.speed + p.phase) * 0.5,
        p.y + Math.sin(time * p.speed * 0.7 + p.phase + 1) * 0.3,
        p.z
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
   Pre-trained Model — large sphere at center
   ──────────────────────────────────────────── */

function PretrainedModel({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const wireMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const colorPre = useMemo(() => new THREE.Color(COLOR.pretrained), []);
  const colorAdapted = useMemo(() => new THREE.Color(COLOR.adapted), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    // Appear phase
    const preP = phaseT(t, PHASE.PRETRAINED);
    const appear = easeOut(clamp01(preP / 0.5));
    meshRef.current.scale.setScalar(1.4 * appear);
    if (wireRef.current) wireRef.current.scale.setScalar(1.5 * appear);

    // Rotation
    meshRef.current.rotation.y = time * 0.15;
    if (wireRef.current) wireRef.current.rotation.y = -time * 0.1;

    // Gradient update: color shift blue -> orange
    const gradP = phaseT(t, PHASE.GRADIENT);
    const adaptP = phaseT(t, PHASE.ADAPTED);
    const colorMix = easeInOut(clamp01(gradP + adaptP * 0.5));

    tempColor.copy(colorPre).lerp(colorAdapted, colorMix);
    if (matRef.current) {
      matRef.current.color.copy(tempColor);
      matRef.current.emissive.copy(tempColor);
      matRef.current.emissiveIntensity = 0.2 + gradP * 0.8;
    }
    if (wireMatRef.current) {
      wireMatRef.current.color.copy(tempColor);
      wireMatRef.current.emissive.copy(tempColor);
    }

    // Distortion during training
    const trainP = phaseT(t, PHASE.TRAINING);
    if (trainP > 0 && trainP < 1) {
      const wobble = Math.sin(time * 6) * 0.08 * trainP;
      meshRef.current.scale.setScalar(1.4 * appear + wobble);
    }

    // Light glow
    if (lightRef.current) {
      lightRef.current.intensity = 0.5 + gradP * 4 + adaptP * 2;
      lightRef.current.color.copy(tempColor);
    }
  });

  return (
    <group position={POS.model}>
      <pointLight
        ref={lightRef}
        color={COLOR.pretrained}
        intensity={0.5}
        distance={10}
      />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial
          ref={matRef}
          color={COLOR.pretrained}
          emissive={COLOR.pretrained}
          emissiveIntensity={0.2}
          transparent
          opacity={0.75}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          ref={wireMatRef}
          color={COLOR.pretrained}
          emissive={COLOR.pretrained}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>
      <Text
        position={[0, -2.2, 0]}
        fontSize={0.28}
        color={COLOR.pretrained}
        anchorX="center"
        anchorY="middle"
      >
        Pre-trained Model
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Task Data — small colored data points from left
   ──────────────────────────────────────────── */

const DATA_COUNT = 20;

const DATA_PARTICLES = Array.from({ length: DATA_COUNT }, (_, i) => ({
  offset: [
    (Math.random() - 0.5) * 1.5,
    (Math.random() - 0.5) * 2.5,
    (Math.random() - 0.5) * 1.0,
  ] as [number, number, number],
  delay: i * 0.04,
  orbitPhase: (i / DATA_COUNT) * Math.PI * 2,
  orbitRadius: 2.2 + Math.random() * 0.8,
  orbitSpeed: 0.8 + Math.random() * 0.4,
  orbitTilt: (Math.random() - 0.5) * 0.6,
}));

function DataParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pt = DATA_PARTICLES[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    // Phase 1: Data appears and approaches from left
    const dataP = phaseT(t, PHASE.TASKDATA);
    // Phase 2: Training loop — orbits the model
    const trainP = phaseT(t, PHASE.TRAINING);
    // Phase 3: Gradient — gets absorbed
    const gradP = phaseT(t, PHASE.GRADIENT);

    if (dataP <= 0 || gradP >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    if (dataP < 1 && trainP <= 0) {
      // Flying in from left
      const ip = easeOut(clamp01((dataP - pt.delay) / (1 - pt.delay)));
      meshRef.current.position.set(
        lerp(POS.dataStart[0] + pt.offset[0], POS.model[0] + pt.offset[0] * 0.5 - 2, ip),
        lerp(POS.dataStart[1] + pt.offset[1], pt.offset[1] * 0.5, ip) +
          Math.sin(ip * Math.PI) * 1.5,
        pt.offset[2] * ip
      );
      meshRef.current.scale.setScalar(0.1 + ip * 0.05);
    } else if (trainP > 0 && trainP < 1) {
      // Orbiting the model in training loop
      const angle = pt.orbitPhase + time * pt.orbitSpeed;
      const r = pt.orbitRadius * (1 - trainP * 0.3);
      meshRef.current.position.set(
        POS.model[0] + Math.cos(angle) * r,
        POS.model[1] + Math.sin(angle) * r * pt.orbitTilt + Math.sin(angle * 2) * 0.3,
        Math.sin(angle) * r * 0.5
      );
      meshRef.current.scale.setScalar(0.12 + Math.sin(time * 4 + index) * 0.02);
    } else if (gradP > 0) {
      // Getting absorbed into model
      const absorbP = easeInOut(gradP);
      const angle = pt.orbitPhase + time * pt.orbitSpeed * 0.3;
      const r = pt.orbitRadius * 0.7 * (1 - absorbP);
      meshRef.current.position.set(
        POS.model[0] + Math.cos(angle) * r,
        POS.model[1] + Math.sin(angle) * r * pt.orbitTilt,
        Math.sin(angle) * r * 0.3
      );
      meshRef.current.scale.setScalar(0.12 * (1 - absorbP));
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={COLOR.data}
        emissive={COLOR.data}
        emissiveIntensity={1.5}
        toneMapped={false}
      />
    </mesh>
  );
}

function TaskDataSwarm({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const dataP = phaseT(elapsedRef.current, PHASE.TASKDATA);
    const trainP = phaseT(elapsedRef.current, PHASE.TRAINING);
    labelRef.current.visible = dataP > 0.2 && trainP < 0.8;
  });

  return (
    <group>
      {DATA_PARTICLES.map((_, i) => (
        <DataParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[-6, 3, 0]}>
        <Text
          fontSize={0.3}
          color={COLOR.data}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Task Data
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Gradient Waves — pulses through the model
   ──────────────────────────────────────────── */

const WAVE_COUNT = 12;

function GradientWave({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const gradP = phaseT(elapsedRef.current, PHASE.GRADIENT);

    if (gradP <= 0 || gradP >= 1) {
      ringRef.current.visible = false;
      return;
    }

    const delay = index * 0.07;
    const waveP = clamp01((gradP - delay) / (0.6));
    if (waveP <= 0 || waveP >= 1) {
      ringRef.current.visible = false;
      return;
    }

    ringRef.current.visible = true;
    const expand = easeOut(waveP);
    const radius = expand * 2.5;
    ringRef.current.scale.set(radius, radius, radius);
    ringRef.current.rotation.x = Math.PI / 2;
    ringRef.current.rotation.z = clock.elapsedTime * 0.5 + index;
    ringRef.current.position.set(
      POS.model[0],
      POS.model[1] + (index - WAVE_COUNT / 2) * 0.15,
      0
    );

    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.6 * (1 - waveP);
  });

  return (
    <mesh ref={ringRef} visible={false}>
      <torusGeometry args={[1, 0.03, 8, 32]} />
      <meshStandardMaterial
        color={COLOR.gradient}
        emissive={COLOR.gradient}
        emissiveIntensity={2}
        transparent
        opacity={0.6}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function GradientWaves({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const gradP = phaseT(elapsedRef.current, PHASE.GRADIENT);
    labelRef.current.visible = gradP > 0.1 && gradP < 0.9;
  });

  return (
    <group>
      {Array.from({ length: WAVE_COUNT }, (_, i) => (
        <GradientWave key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[0, 3, 0]}>
        <Text
          fontSize={0.3}
          color={COLOR.gradient}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Gradient Update
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Training Loop Ring — visible orbit path
   ──────────────────────────────────────────── */

function TrainingLoopRing({ elapsedRef }: { elapsedRef: ElRef }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const trainP = phaseT(elapsedRef.current, PHASE.TRAINING);

    if (trainP <= 0 || trainP >= 1) {
      ringRef.current.visible = false;
      if (labelRef.current) labelRef.current.visible = false;
      return;
    }

    ringRef.current.visible = true;
    if (labelRef.current) labelRef.current.visible = trainP > 0.1 && trainP < 0.9;

    const appear = easeOut(clamp01(trainP / 0.2));
    const fade = 1 - easeInOut(clamp01((trainP - 0.8) / 0.2));
    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.2 * appear * fade;

    ringRef.current.rotation.x = Math.PI / 2 + Math.sin(clock.elapsedTime * 0.3) * 0.15;
    ringRef.current.rotation.z = clock.elapsedTime * 0.08;
  });

  return (
    <group position={POS.model}>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[2.5, 0.02, 8, 64]} />
        <meshStandardMaterial
          color={COLOR.data}
          emissive={COLOR.data}
          emissiveIntensity={1}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
      <group ref={labelRef} visible={false} position={[3.2, 2, 0]}>
        <Text
          fontSize={0.26}
          color={COLOR.data}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Training Loop
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Task Output — flies out to the right
   ──────────────────────────────────────────── */

function TaskOutput({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const TRAIL = 20;

  useFrame(({ clock }) => {
    const outP = phaseT(elapsedRef.current, PHASE.OUTPUT);

    if (outP <= 0 || outP >= 1) {
      if (orbRef.current) orbRef.current.visible = false;
      if (lightRef.current) lightRef.current.intensity = 0;
      if (labelRef.current) labelRef.current.visible = false;
      if (trailRef.current) {
        for (let i = 0; i < TRAIL; i++) {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          trailRef.current.setMatrixAt(i, dummy.matrix);
        }
        trailRef.current.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    const e = easeInOut(outP);
    const x = lerp(POS.model[0], POS.outputEnd[0], e);
    const y = Math.sin(e * Math.PI) * 3;
    const z = Math.sin(e * Math.PI * 2) * 1;

    if (orbRef.current) {
      orbRef.current.visible = true;
      orbRef.current.position.set(x, y, z);
      orbRef.current.scale.setScalar(0.35 + Math.sin(clock.elapsedTime * 8) * 0.04);
    }
    if (lightRef.current) {
      lightRef.current.position.set(x, y, z);
      lightRef.current.intensity = 4;
    }
    if (labelRef.current) {
      labelRef.current.position.set(x, y + 0.8, z);
      labelRef.current.visible = outP < 0.85;
    }

    // Trail
    if (trailRef.current) {
      for (let i = 0; i < TRAIL; i++) {
        const tp = clamp01(outP - i * 0.02);
        if (tp > 0) {
          const te = easeInOut(tp);
          const tx = lerp(POS.model[0], POS.outputEnd[0], te);
          const ty = Math.sin(te * Math.PI) * 3;
          const tz = Math.sin(te * Math.PI * 2) * 1;
          dummy.position.set(tx, ty, tz);
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
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.output}
        intensity={0}
        distance={8}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={1}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.32}
          color={COLOR.output}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Task Output
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Connection line (faint guide)
   ──────────────────────────────────────────── */

function ConnectionLine() {
  const lineObj = useMemo(() => {
    const pts = [
      new THREE.Vector3(...POS.dataStart),
      new THREE.Vector3(...POS.model),
      new THREE.Vector3(...POS.outputEnd),
    ];
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

export default function FinetuneScene({
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
    if (t >= PHASE.PRETRAINED[0]) step = 0;
    if (t >= PHASE.TASKDATA[0]) step = 1;
    if (t >= PHASE.TRAINING[0]) step = 2;
    if (t >= PHASE.GRADIENT[0]) step = 3;
    if (t >= PHASE.ADAPTED[0]) step = 4;
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
      <ConnectionLine />

      {/* Stage elements */}
      <PretrainedModel elapsedRef={elapsedRef} />
      <TrainingLoopRing elapsedRef={elapsedRef} />

      {/* Animated flow */}
      <TaskDataSwarm elapsedRef={elapsedRef} />
      <GradientWaves elapsedRef={elapsedRef} />
      <TaskOutput elapsedRef={elapsedRef} />
    </>
  );
}
