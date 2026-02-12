"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  type SceneProps,
  type V3,
  type ElRef,
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
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={COLOR.bg} transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Connection lines
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.prompt, POS.spatial, POS.frames, POS.temporal, POS.motion, POS.output];
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
   Text Prompt — floating text
   ──────────────────────────────────────────── */

const PROMPT_WORDS = ["a", "cat", "playing", "piano", "in", "4K"];

function TextPrompt({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.PROMPT);
    const time = clock.elapsedTime;
    groupRef.current.visible = p > 0 && p < 1;
    lightRef.current.intensity = p > 0 && p < 1 ? 2 * Math.sin(p * Math.PI) : 0;

    if (p > 0 && p < 1) {
      const children = groupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const delay = i * 0.12;
        const ip = easeOut(clamp01((p - delay) / (0.7 - delay)));
        children[i].position.set(
          POS.prompt[0] + (i - 2.5) * 0.8,
          POS.prompt[1] + Math.sin(time * 2 + i) * 0.15 + (i % 2 === 0 ? 0.3 : -0.3),
          0
        );
        children[i].scale.setScalar(ip);
      }
    }
  });

  return (
    <>
      <pointLight ref={lightRef} position={POS.prompt} color={COLOR.prompt} intensity={0} distance={6} />
      <group ref={groupRef} visible={false}>
        {PROMPT_WORDS.map((word, i) => (
          <Text
            key={i}
            fontSize={0.3}
            color={COLOR.prompt}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="black"
          >
            {word}
          </Text>
        ))}
      </group>
      <Text position={[POS.prompt[0], POS.prompt[1] - 1.5, 0]} fontSize={0.26} color={COLOR.prompt} anchorX="center" anchorY="middle">
        Text Prompt
      </Text>
    </>
  );
}

/* ────────────────────────────────────────────
   Spatial Encoding — 3D grid of feature points
   ──────────────────────────────────────────── */

const SPATIAL_COUNT = 27; // 3x3x3 grid

function SpatialEncoding({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lightRef = useRef<THREE.PointLight>(null);

  const gridPoints = useMemo(() => {
    const pts: V3[] = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++)
          pts.push([(x - 1) * 0.6, (y - 1) * 0.6, (z - 1) * 0.6]);
    return pts;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = phaseT(elapsedRef.current, PHASE.SPATIAL);
    const time = clock.elapsedTime;

    if (lightRef.current) lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;
    if (wireRef.current) {
      wireRef.current.visible = p > 0.2;
      wireRef.current.rotation.y = time * 0.2;
      wireRef.current.scale.setScalar(easeOut(clamp01((p - 0.2) / 0.5)) * 1.2);
    }

    for (let i = 0; i < SPATIAL_COUNT; i++) {
      const pt = gridPoints[i];
      const delay = i * 0.02;
      const ip = easeOut(clamp01((p - delay) / (0.6 - delay)));
      if (p > 0 && p < 1) {
        dummy.position.set(
          POS.spatial[0] + pt[0] * ip,
          POS.spatial[1] + pt[1] * ip,
          pt[2] * ip
        );
        dummy.scale.setScalar(0.06 * ip);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.spatial} color={COLOR.spatial} intensity={0} distance={6} />
      <mesh ref={wireRef} position={POS.spatial} visible={false}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial
          color={COLOR.spatial}
          emissive={COLOR.spatial}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, SPATIAL_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={COLOR.spatial}
          emissive={COLOR.spatial}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </instancedMesh>
      <Text position={[POS.spatial[0], POS.spatial[1] - 1.5, 0]} fontSize={0.26} color={COLOR.spatial} anchorX="center" anchorY="middle">
        Spatial Encoding
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Frame Generation — frame planes appear in sequence
   ──────────────────────────────────────────── */

const FRAME_COUNT = 6;

function FrameGeneration({ elapsedRef }: { elapsedRef: ElRef }) {
  const framesRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!framesRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.FRAMES);
    const time = clock.elapsedTime;

    lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;

    const children = framesRef.current.children;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const child = children[i];
      if (!child) continue;
      const delay = i * 0.12;
      const ip = easeOut(clamp01((p - delay) / (0.5)));

      if (p > 0 && p < 1) {
        child.visible = ip > 0;
        // Frame planes spread in z depth, slightly offset in x
        child.position.set(
          POS.frames[0] + (i - FRAME_COUNT / 2 + 0.5) * 0.15,
          POS.frames[1],
          (i - FRAME_COUNT / 2 + 0.5) * 0.5
        );
        child.scale.setScalar(ip * 0.8);
        child.rotation.y = Math.sin(time * 0.5 + i * 0.3) * 0.1;
      } else {
        child.visible = false;
      }
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.frames} color={COLOR.frame} intensity={0} distance={8} />
      <group ref={framesRef}>
        {Array.from({ length: FRAME_COUNT }, (_, i) => (
          <mesh key={i} visible={false}>
            <planeGeometry args={[1.2, 0.9]} />
            <meshStandardMaterial
              color={COLOR.frame}
              emissive={COLOR.frame}
              emissiveIntensity={0.4 + (i / FRAME_COUNT) * 0.4}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <Text position={[POS.frames[0], POS.frames[1] - 1.5, 0]} fontSize={0.26} color={COLOR.frame} anchorX="center" anchorY="middle">
        Frame Gen
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Temporal Coherence — lines connecting frame planes
   ──────────────────────────────────────────── */

function TemporalCoherence({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Create line objects for connections
  const lineObjs = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < FRAME_COUNT - 1; i++) {
      const pts = [
        new THREE.Vector3(
          POS.temporal[0] + (i - FRAME_COUNT / 2 + 0.5) * 0.3,
          POS.temporal[1],
          (i - FRAME_COUNT / 2 + 0.5) * 0.5
        ),
        new THREE.Vector3(
          POS.temporal[0] + (i + 1 - FRAME_COUNT / 2 + 0.5) * 0.3,
          POS.temporal[1],
          (i + 1 - FRAME_COUNT / 2 + 0.5) * 0.5
        ),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: COLOR.temporal,
        transparent: true,
        opacity: 0.8,
      });
      lines.push(new THREE.Line(geo, mat));
    }
    return lines;
  }, []);

  // Frame planes at temporal position
  const framesRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !framesRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.TEMPORAL);
    const time = clock.elapsedTime;

    lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;

    // Show frame planes
    const fChildren = framesRef.current.children;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const child = fChildren[i];
      if (!child) continue;
      child.visible = p > 0;
      if (p > 0) {
        child.position.set(
          POS.temporal[0] + (i - FRAME_COUNT / 2 + 0.5) * 0.3,
          POS.temporal[1],
          (i - FRAME_COUNT / 2 + 0.5) * 0.5
        );
        child.scale.setScalar(0.7);
        child.rotation.y = Math.sin(time * 0.3 + i * 0.2) * 0.05;
      }
    }

    // Animate connection lines appearing
    const lChildren = groupRef.current.children;
    for (let i = 0; i < FRAME_COUNT - 1; i++) {
      const line = lChildren[i];
      if (!line) continue;
      const delay = i * 0.15;
      const lp = clamp01((p - delay) / (0.4));
      line.visible = lp > 0 && p < 1;
      if (line.visible) {
        const mat = (line as THREE.Line).material as THREE.LineBasicMaterial;
        mat.opacity = lp * 0.8;

        // Pulse effect
        const pulse = Math.sin(time * 4 + i) * 0.3;
        mat.opacity = clamp01(lp * 0.8 + pulse * lp);
      }
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.temporal} color={COLOR.temporal} intensity={0} distance={8} />
      <group ref={framesRef}>
        {Array.from({ length: FRAME_COUNT }, (_, i) => (
          <mesh key={i} visible={false}>
            <planeGeometry args={[1.0, 0.75]} />
            <meshStandardMaterial
              color={COLOR.frame}
              emissive={COLOR.frame}
              emissiveIntensity={0.3}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
      <group ref={groupRef}>
        {lineObjs.map((line, i) => (
          <primitive key={i} object={line} />
        ))}
      </group>
      <Text position={[POS.temporal[0], POS.temporal[1] - 1.5, 0]} fontSize={0.26} color={COLOR.temporal} anchorX="center" anchorY="middle">
        Temporal Coherence
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Motion Refinement — frames animate/flow
   ──────────────────────────────────────────── */

function MotionRefinement({ elapsedRef }: { elapsedRef: ElRef }) {
  const framesRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!framesRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.MOTION);
    const time = clock.elapsedTime;

    lightRef.current.intensity = p > 0 && p < 1 ? 4 * Math.sin(p * Math.PI) : 0;

    const children = framesRef.current.children;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const child = children[i];
      if (!child) continue;

      if (p > 0 && p < 1) {
        child.visible = true;
        // Frames flow in a wave pattern to suggest motion
        const wave = Math.sin(time * 3 + i * 0.8) * 0.3 * p;
        const flow = easeInOut(p);
        child.position.set(
          POS.motion[0] + (i - FRAME_COUNT / 2 + 0.5) * 0.25,
          POS.motion[1] + wave,
          (i - FRAME_COUNT / 2 + 0.5) * 0.4 * (1 - flow * 0.5)
        );
        child.scale.setScalar(0.7 + flow * 0.15);
        child.rotation.y = wave * 0.3;
        child.rotation.z = Math.sin(time * 2 + i) * 0.05 * flow;
      } else {
        child.visible = false;
      }
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.motion} color={COLOR.motion} intensity={0} distance={8} />
      <group ref={framesRef}>
        {Array.from({ length: FRAME_COUNT }, (_, i) => (
          <mesh key={i} visible={false}>
            <planeGeometry args={[1.0, 0.75]} />
            <meshStandardMaterial
              color={COLOR.motion}
              emissive={COLOR.motion}
              emissiveIntensity={0.5 + (i / FRAME_COUNT) * 0.3}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <Text position={[POS.motion[0], POS.motion[1] - 1.5, 0]} fontSize={0.26} color={COLOR.motion} anchorX="center" anchorY="middle">
        Motion Refinement
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Video Output — filmstrip coming alive
   ──────────────────────────────────────────── */

function VideoOutput({ elapsedRef }: { elapsedRef: ElRef }) {
  const framesRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!framesRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.OUTPUT);
    const time = clock.elapsedTime;

    const appear = easeOut(p);
    lightRef.current.intensity = p > 0 ? appear * 6 : 0;

    const children = framesRef.current.children;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const child = children[i];
      if (!child) continue;

      if (p > 0) {
        child.visible = true;
        // Filmstrip: frames line up horizontally, playing animation
        const activeFrame = Math.floor((time * 4) % FRAME_COUNT);
        const isActive = i === activeFrame;
        child.position.set(
          POS.output[0] + (i - FRAME_COUNT / 2 + 0.5) * 0.28,
          POS.output[1],
          0
        );
        child.scale.setScalar(appear * (isActive ? 0.85 : 0.7));
      } else {
        child.visible = false;
      }
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.output} color={COLOR.output} intensity={0} distance={8} />
      <group ref={framesRef}>
        {Array.from({ length: FRAME_COUNT }, (_, i) => (
          <mesh key={i} visible={false}>
            <planeGeometry args={[1.0, 0.75]} />
            <meshStandardMaterial
              color={COLOR.output}
              emissive={COLOR.output}
              emissiveIntensity={0.6}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <Text position={[POS.output[0], POS.output[1] - 1.5, 0]} fontSize={0.26} color={COLOR.output} anchorX="center" anchorY="middle">
        Video Output
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Transfer orbs between stages
   ──────────────────────────────────────────── */

function TransferOrb({
  elapsedRef,
  phase,
  from,
  to,
  color,
}: {
  elapsedRef: ElRef;
  phase: readonly [number, number];
  from: V3;
  to: V3;
  color: string;
}) {
  const orbRef = useRef<THREE.Mesh>(null);
  const trail = useRef(new TrailRing(15));
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const p = phaseT(elapsedRef.current, phase);
    if (elapsedRef.current < 0.1) trail.current.reset();

    const visible = p > 0.05 && p < 0.35;
    const fp = visible ? easeInOut((p - 0.05) / 0.3) : 0;

    if (orbRef.current) {
      if (visible) {
        const x = lerp(from[0], to[0], fp);
        const y = lerp(from[1], to[1], fp) + Math.sin(fp * Math.PI) * 1.0;
        orbRef.current.position.set(x, y, 0);
        orbRef.current.visible = true;
        orbRef.current.scale.setScalar(0.15);
        trail.current.push(x, y, 0);
      } else {
        orbRef.current.visible = false;
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < 15; i++) {
        if (i < ring.length && visible) {
          const pt = ring.get(i);
          dummy.position.set(pt[0], pt[1], pt[2]);
          dummy.scale.setScalar(((15 - i) / 15) * 0.08);
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
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, 15]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function TextToVideoScene({ playing, onStepChange, onComplete }: SceneProps) {
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
    if (t >= PHASE.PROMPT[0]) step = 0;
    if (t >= PHASE.SPATIAL[0]) step = 1;
    if (t >= PHASE.FRAMES[0]) step = 2;
    if (t >= PHASE.TEMPORAL[0]) step = 3;
    if (t >= PHASE.MOTION[0]) step = 4;
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
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 5]} intensity={0.35} />
      <directionalLight position={[-8, 4, -3]} intensity={0.15} />

      <AmbientParticles />
      <ConnectionLines />

      <TextPrompt elapsedRef={elapsedRef} />
      <SpatialEncoding elapsedRef={elapsedRef} />
      <FrameGeneration elapsedRef={elapsedRef} />
      <TemporalCoherence elapsedRef={elapsedRef} />
      <MotionRefinement elapsedRef={elapsedRef} />
      <VideoOutput elapsedRef={elapsedRef} />

      {/* Transfer orbs */}
      <TransferOrb elapsedRef={elapsedRef} phase={PHASE.SPATIAL} from={POS.prompt} to={POS.spatial} color={COLOR.prompt} />
      <TransferOrb elapsedRef={elapsedRef} phase={PHASE.FRAMES} from={POS.spatial} to={POS.frames} color={COLOR.spatial} />
      <TransferOrb elapsedRef={elapsedRef} phase={PHASE.TEMPORAL} from={POS.frames} to={POS.temporal} color={COLOR.frame} />
      <TransferOrb elapsedRef={elapsedRef} phase={PHASE.MOTION} from={POS.temporal} to={POS.motion} color={COLOR.temporal} />
      <TransferOrb elapsedRef={elapsedRef} phase={PHASE.OUTPUT} from={POS.motion} to={POS.output} color={COLOR.motion} />
    </>
  );
}
