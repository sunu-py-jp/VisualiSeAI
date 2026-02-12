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
   Connection lines
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.teacher, POS.soft, POS.student, POS.compact];
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
   Teacher Model — large, glowing sphere
   ──────────────────────────────────────────── */

function TeacherModel({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const teacherP = phaseT(t, PHASE.TEACHER);
    const softP = phaseT(t, PHASE.SOFT);

    if (meshRef.current) {
      const appear = easeOut(clamp01(teacherP / 0.4));
      // Teacher is BIG - radius ~1.8
      meshRef.current.scale.setScalar(appear * 1.8 + Math.sin(time * 1.5) * 0.05);
      meshRef.current.rotation.y = time * 0.15;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = -time * 0.25;
      wireRef.current.rotation.x = time * 0.15;
      const appear = easeOut(clamp01(teacherP / 0.4));
      wireRef.current.scale.setScalar(appear * 1.8);
    }
    if (lightRef.current) {
      const activity = Math.max(teacherP, softP * 0.6);
      lightRef.current.intensity = 0.5 + activity * 5;
    }
  });

  return (
    <group position={POS.teacher}>
      <pointLight
        ref={lightRef}
        color={COLOR.teacher}
        intensity={0.5}
        distance={10}
      />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial
          color={COLOR.teacher}
          emissive={COLOR.teacher}
          emissiveIntensity={0.4}
          transparent
          opacity={0.7}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.15, 2]} />
        <meshStandardMaterial
          color={COLOR.teacher}
          emissive={COLOR.teacher}
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>
      <Text
        position={[0, -2.8, 0]}
        fontSize={0.3}
        color={COLOR.teacher}
        anchorX="center"
        anchorY="middle"
      >
        Teacher
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Soft Label Rings — probability distributions
   from teacher (wavy concentric rings)
   ──────────────────────────────────────────── */

const RING_COUNT = 5;

function SoftLabelRing({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const softP = phaseT(elapsedRef.current, PHASE.SOFT);
    const time = clock.elapsedTime;
    const delay = index * 0.12;

    if (softP <= delay) {
      ringRef.current.visible = false;
      return;
    }

    ringRef.current.visible = true;
    const localP = easeOut(clamp01((softP - delay) / (1 - delay)));

    // Rings emerge from teacher and spread outward toward student
    const x = lerp(POS.teacher[0], POS.soft[0], localP);
    const radius = 0.3 + index * 0.25 + localP * 0.5;

    ringRef.current.position.set(x, POS.soft[1], POS.soft[2]);
    ringRef.current.scale.setScalar(radius);
    ringRef.current.rotation.x = Math.sin(time * 2 + index) * 0.4;
    ringRef.current.rotation.y = time * (0.3 + index * 0.1);
    ringRef.current.rotation.z = Math.cos(time * 1.5 + index * 0.7) * 0.3;
  });

  return (
    <mesh ref={ringRef} visible={false}>
      <torusGeometry args={[1, 0.06, 8, 32]} />
      <meshStandardMaterial
        color={COLOR.soft}
        emissive={COLOR.soft}
        emissiveIntensity={1.5}
        transparent
        opacity={0.6}
        toneMapped={false}
      />
    </mesh>
  );
}

function SoftLabels({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const softP = phaseT(elapsedRef.current, PHASE.SOFT);
    labelRef.current.visible = softP > 0.3 && softP < 0.95;
  });

  return (
    <group>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <SoftLabelRing key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false}>
        <Text
          position={[POS.soft[0], POS.soft[1] + 2.2, POS.soft[2]]}
          fontSize={0.26}
          color={COLOR.soft}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Soft Labels
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Student Model — tiny sphere that grows
   ──────────────────────────────────────────── */

function StudentModel({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const studentP = phaseT(t, PHASE.STUDENT);
    const trainP = phaseT(t, PHASE.TRAIN);
    const compactP = phaseT(t, PHASE.COMPACT);

    if (meshRef.current) {
      const appear = easeOut(clamp01(studentP / 0.4));
      // Student starts TINY (0.4) — SIZE CONTRAST is key
      let baseScale = appear * 0.4;
      // During training, pulses
      if (trainP > 0) {
        baseScale += Math.sin(time * 6) * 0.05 * trainP;
      }
      // During compact phase, glows brighter but stays small
      if (compactP > 0) {
        baseScale += compactP * 0.15;
      }
      meshRef.current.scale.setScalar(baseScale);
      meshRef.current.rotation.y = time * 0.4;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = -time * 0.6;
      const appear = easeOut(clamp01(studentP / 0.4));
      wireRef.current.scale.setScalar(appear * 0.4);
      if (compactP > 0) {
        wireRef.current.scale.setScalar(appear * 0.4 + compactP * 0.15);
      }
    }
    if (lightRef.current) {
      let intensity = studentP > 0 ? 0.5 : 0;
      // Glows dramatically during compact phase
      if (compactP > 0) {
        intensity += compactP * 8;
      } else if (trainP > 0) {
        intensity += trainP * 2;
      }
      lightRef.current.intensity = intensity;
    }
  });

  return (
    <group position={POS.student}>
      <pointLight
        ref={lightRef}
        color={COLOR.student}
        intensity={0}
        distance={8}
      />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 3]} />
        <meshStandardMaterial
          color={COLOR.student}
          emissive={COLOR.student}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.2, 2]} />
        <meshStandardMaterial
          color={COLOR.student}
          emissive={COLOR.student}
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.26}
        color={COLOR.student}
        anchorX="center"
        anchorY="middle"
      >
        Student
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Knowledge Transfer — dramatic particle stream
   from teacher to student
   ──────────────────────────────────────────── */

const TRANSFER_COUNT = 24;

function TransferParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const delay = index * 0.035;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const transferP = phaseT(elapsedRef.current, PHASE.TRANSFER);
    const time = clock.elapsedTime;

    if (transferP <= delay || transferP >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeInOut(clamp01((transferP - delay) / (1 - delay * 1.2)));

    // Flow from teacher to student with arc
    const x = lerp(POS.teacher[0], POS.student[0], ip);
    const y =
      lerp(POS.teacher[1], POS.student[1], ip) +
      Math.sin(ip * Math.PI) * (2 + index * 0.08);
    const z =
      Math.sin(ip * Math.PI * 3 + index * 0.6) * 1.2 +
      Math.cos(time * 3 + index) * 0.1;

    meshRef.current.position.set(x, y, z);
    const s = 0.1 + Math.sin(ip * Math.PI) * 0.06;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={COLOR.transfer}
        emissive={COLOR.transfer}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

function KnowledgeTransfer({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const transferP = phaseT(elapsedRef.current, PHASE.TRANSFER);
    labelRef.current.visible = transferP > 0.1 && transferP < 0.9;
  });

  return (
    <group>
      {Array.from({ length: TRANSFER_COUNT }, (_, i) => (
        <TransferParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false}>
        <Text
          position={[
            (POS.teacher[0] + POS.student[0]) / 2,
            3.5,
            0,
          ]}
          fontSize={0.28}
          color={COLOR.transfer}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Knowledge Transfer
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Training Pulses — energy rings around student
   ──────────────────────────────────────────── */

function TrainingPulses({ elapsedRef }: { elapsedRef: ElRef }) {
  const PULSE_COUNT = 3;
  const pulsesRef = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const trainP = phaseT(elapsedRef.current, PHASE.TRAIN);
    const time = clock.elapsedTime;

    for (let i = 0; i < PULSE_COUNT; i++) {
      const pulse = pulsesRef.current[i];
      if (!pulse) continue;

      if (trainP <= 0) {
        pulse.visible = false;
        continue;
      }

      pulse.visible = true;
      // Expanding and fading pulse rings
      const cycleT = ((time * 1.5 + i * 0.33) % 1);
      const radius = 0.5 + cycleT * 2.0;
      pulse.scale.setScalar(radius);
      pulse.position.set(POS.student[0], POS.student[1], POS.student[2]);
      pulse.rotation.x = Math.PI / 2;
      pulse.rotation.z = time * 0.2 + i * Math.PI / 3;

      const mat = pulse.material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - cycleT) * 0.5 * trainP;
    }
  });

  return (
    <group>
      {Array.from({ length: PULSE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            pulsesRef.current[i] = el;
          }}
          visible={false}
        >
          <torusGeometry args={[1, 0.04, 8, 32]} />
          <meshStandardMaterial
            color={COLOR.train}
            emissive={COLOR.train}
            emissiveIntensity={2}
            transparent
            opacity={0.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Compact Output — student becomes efficient
   ──────────────────────────────────────────── */

function CompactOutput({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const TRAIL = 20;
  const trail = useRef(new TrailRing(TRAIL));

  useFrame(({ clock }) => {
    const compactP = phaseT(elapsedRef.current, PHASE.COMPACT);
    if (elapsedRef.current < 0.1) trail.current.reset();

    if (orbRef.current) {
      if (compactP > 0.2) {
        orbRef.current.visible = true;
        const e = easeInOut(clamp01((compactP - 0.2) / 0.8));
        const x = lerp(POS.student[0], POS.compact[0], e);
        const y = Math.sin(e * Math.PI) * 2;
        const z = Math.sin(e * Math.PI) * 1.2;
        orbRef.current.position.set(x, y, z);
        orbRef.current.scale.setScalar(
          0.35 + Math.sin(clock.elapsedTime * 8) * 0.04
        );
        trail.current.push(x, y, z);
      } else {
        orbRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = compactP > 0.2 ? 3 + compactP * 5 : 0;
      if (orbRef.current?.visible) {
        lightRef.current.position.copy(orbRef.current.position);
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && compactP > 0.2) {
          const p = ring.get(i);
          dummy.position.set(p[0], p[1], p[2]);
          dummy.scale.setScalar(((TRAIL - i) / TRAIL) * 0.14);
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
          color={COLOR.compact}
          emissive={COLOR.compact}
          emissiveIntensity={2.5}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.compact}
        intensity={0}
        distance={8}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.compact}
          emissive={COLOR.compact}
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
    if (t >= PHASE.TEACHER[0]) step = 0;
    if (t >= PHASE.SOFT[0]) step = 1;
    if (t >= PHASE.STUDENT[0]) step = 2;
    if (t >= PHASE.TRANSFER[0]) step = 3;
    if (t >= PHASE.TRAIN[0]) step = 4;
    if (t >= PHASE.COMPACT[0]) step = 5;

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
      <TeacherModel elapsedRef={elapsedRef} />
      <SoftLabels elapsedRef={elapsedRef} />
      <StudentModel elapsedRef={elapsedRef} />
      <KnowledgeTransfer elapsedRef={elapsedRef} />
      <TrainingPulses elapsedRef={elapsedRef} />
      <CompactOutput elapsedRef={elapsedRef} />
    </>
  );
}
