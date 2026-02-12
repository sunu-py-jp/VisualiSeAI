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
    const stages = [POS.prompt, POS.encode, POS.noise, POS.refine, POS.upscale, POS.output];
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
   Text Prompt — floating text fragments
   ──────────────────────────────────────────── */

const PROMPT_WORDS = ["a", "sunset", "over", "mountains", "in", "oil", "painting"];

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
        const child = children[i];
        const delay = i * 0.1;
        const ip = easeOut(clamp01((p - delay) / (0.7 - delay)));
        child.position.set(
          POS.prompt[0] + (i - 3) * 0.7,
          POS.prompt[1] + Math.sin(time * 2 + i) * 0.15 + (i % 2 === 0 ? 0.3 : -0.3),
          0
        );
        const s = ip * 1;
        child.scale.setScalar(s);
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
      <Text
        position={[POS.prompt[0], POS.prompt[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.prompt}
        anchorX="center"
        anchorY="middle"
      >
        Text Prompt
      </Text>
    </>
  );
}

/* ────────────────────────────────────────────
   Encoder — sphere compresses text fragments
   ──────────────────────────────────────────── */

function Encoder({ elapsedRef }: { elapsedRef: ElRef }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!sphereRef.current || !ringRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.ENCODE);
    const time = clock.elapsedTime;

    const activity = p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
    sphereRef.current.scale.setScalar(0.8 + activity * 0.4);
    sphereRef.current.rotation.y = time * 0.5;

    ringRef.current.rotation.x = time * 0.3;
    ringRef.current.rotation.z = time * 0.5;
    ringRef.current.scale.setScalar(1.2 + activity * 0.3);

    lightRef.current.intensity = 0.3 + activity * 4;
  });

  return (
    <group position={POS.encode}>
      <pointLight ref={lightRef} color={COLOR.encode} intensity={0.3} distance={6} />
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.encode}
          emissive={COLOR.encode}
          emissiveIntensity={0.4}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.2, 0.05, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.encode}
          emissive={COLOR.encode}
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </mesh>
      <Text position={[0, -1.5, 0]} fontSize={0.26} color={COLOR.encode} anchorX="center" anchorY="middle">
        Encoding
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Encode flight — orb from prompt to encoder
   ──────────────────────────────────────────── */

function EncodeFlight({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const trail = useRef(new TrailRing(20));
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const p = phaseT(elapsedRef.current, PHASE.ENCODE);
    if (elapsedRef.current < 0.1) trail.current.reset();

    if (orbRef.current) {
      if (p > 0 && p < 0.6) {
        const fp = easeInOut(p / 0.6);
        const x = lerp(POS.prompt[0], POS.encode[0], fp);
        const y = lerp(POS.prompt[1], POS.encode[1], fp) + Math.sin(fp * Math.PI) * 1.5;
        orbRef.current.position.set(x, y, 0);
        orbRef.current.visible = true;
        orbRef.current.scale.setScalar(0.2 * (1 - fp * 0.5));
        trail.current.push(x, y, 0);
      } else {
        orbRef.current.visible = false;
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < 20; i++) {
        if (i < ring.length && p > 0 && p < 0.6) {
          const pt = ring.get(i);
          dummy.position.set(pt[0], pt[1], pt[2]);
          dummy.scale.setScalar(((20 - i) / 20) * 0.1);
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
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={COLOR.prompt}
          emissive={COLOR.prompt}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, 20]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.prompt}
          emissive={COLOR.prompt}
          emissiveIntensity={1}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}

/* ────────────────────────────────────────────
   Noise Field — random particle cloud
   ──────────────────────────────────────────── */

const NOISE_COUNT = 80;

function NoiseField({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(
    () =>
      Array.from({ length: NOISE_COUNT }, () => ({
        x: (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 3,
        z: (Math.random() - 0.5) * 3,
        speed: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = phaseT(elapsedRef.current, PHASE.NOISE);
    const time = clock.elapsedTime;

    for (let i = 0; i < NOISE_COUNT; i++) {
      const pt = particles[i];
      if (p > 0 && p < 1) {
        const appear = easeOut(clamp01(p / 0.3));
        const chaotic = 1 - easeInOut(clamp01((p - 0.5) / 0.5));
        dummy.position.set(
          POS.noise[0] + pt.x * (0.5 + chaotic * 1) + Math.sin(time * pt.speed + pt.phase) * chaotic * 0.5,
          POS.noise[1] + pt.y * (0.5 + chaotic * 1) + Math.cos(time * pt.speed + pt.phase) * chaotic * 0.5,
          pt.z * (0.5 + chaotic * 1)
        );
        dummy.scale.setScalar(0.04 * appear);
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
      <instancedMesh ref={ref} args={[undefined, undefined, NOISE_COUNT]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial
          color={COLOR.noise}
          emissive={COLOR.noise}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </instancedMesh>
      <Text position={[POS.noise[0], POS.noise[1] - 2, 0]} fontSize={0.26} color={COLOR.noise} anchorX="center" anchorY="middle">
        Noise Init
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Iterative Refinement — particles organize
   from chaos into a recognizable grid pattern,
   with multiple visible denoising steps
   ──────────────────────────────────────────── */

const REFINE_COUNT = 80;

// Target positions: organized grid (a recognizable shape — a simple square image)
const REFINE_TARGETS = Array.from({ length: REFINE_COUNT }, (_, i) => {
  const cols = 8;
  const row = Math.floor(i / cols);
  const col = i % cols;
  return {
    tx: (col - cols / 2 + 0.5) * 0.25,
    ty: (row - cols / 2 + 0.5) * 0.25,
    tz: 0,
    // Random start
    sx: (Math.random() - 0.5) * 3,
    sy: (Math.random() - 0.5) * 3,
    sz: (Math.random() - 0.5) * 3,
    phase: Math.random() * Math.PI * 2,
  };
});

function IterativeRefinement({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lightRef = useRef<THREE.PointLight>(null);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const noiseColor = useMemo(() => new THREE.Color(COLOR.noise), []);
  const cleanColor = useMemo(() => new THREE.Color(COLOR.refine), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = phaseT(elapsedRef.current, PHASE.REFINE);
    const time = clock.elapsedTime;

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;
    }

    // Multiple refinement steps: particles converge in 4 discrete steps
    const stepCount = 4;
    const stepP = Math.min(Math.floor(p * stepCount), stepCount - 1);
    const stepFrac = (p * stepCount) - stepP;
    // Convergence increases with each step
    const convergence = clamp01((stepP + easeInOut(stepFrac)) / stepCount);

    for (let i = 0; i < REFINE_COUNT; i++) {
      const pt = REFINE_TARGETS[i];
      if (p > 0 && p < 1) {
        const jitter = (1 - convergence) * 0.8;
        dummy.position.set(
          POS.refine[0] + lerp(pt.sx, pt.tx, convergence) + Math.sin(time * 2 + pt.phase) * jitter,
          POS.refine[1] + lerp(pt.sy, pt.ty, convergence) + Math.cos(time * 2 + pt.phase) * jitter,
          lerp(pt.sz, pt.tz, convergence) + Math.sin(time + i) * jitter * 0.5
        );
        dummy.scale.setScalar(0.04 + convergence * 0.02);

        // Color transitions from noisy to clean — no allocation
        tempColor.copy(noiseColor).lerp(cleanColor, convergence);
        ref.current.setColorAt(i, tempColor);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.refine} color={COLOR.refine} intensity={0} distance={8} />
      <instancedMesh ref={ref} args={[undefined, undefined, REFINE_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.refine}
          emissive={COLOR.refine}
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </instancedMesh>
      <Text position={[POS.refine[0], POS.refine[1] - 2, 0]} fontSize={0.26} color={COLOR.refine} anchorX="center" anchorY="middle">
        Refinement
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Upscaling — shape expands with more detail
   ──────────────────────────────────────────── */

function Upscaling({ elapsedRef }: { elapsedRef: ElRef }) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!innerRef.current || !outerRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.UPSCALE);
    const time = clock.elapsedTime;

    const activity = p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
    const expand = easeOut(p);

    innerRef.current.scale.setScalar(0.6 + expand * 0.6);
    innerRef.current.rotation.y = time * 0.3;
    innerRef.current.visible = p > 0;

    outerRef.current.scale.setScalar(0.3 + expand * 1.2);
    outerRef.current.rotation.y = -time * 0.2;
    outerRef.current.visible = p > 0.3;

    lightRef.current.intensity = activity * 5;
  });

  return (
    <group position={POS.upscale}>
      <pointLight ref={lightRef} color={COLOR.upscale} intensity={0} distance={8} />
      <mesh ref={innerRef} visible={false}>
        <boxGeometry args={[1, 1, 0.1, 4, 4, 1]} />
        <meshStandardMaterial
          color={COLOR.upscale}
          emissive={COLOR.upscale}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh ref={outerRef} visible={false}>
        <boxGeometry args={[1, 1, 0.1, 8, 8, 1]} />
        <meshStandardMaterial
          color={COLOR.upscale}
          emissive={COLOR.upscale}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
      <Text position={[0, -1.5, 0]} fontSize={0.26} color={COLOR.upscale} anchorX="center" anchorY="middle">
        Upscaling
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Output Image — clean final result
   ──────────────────────────────────────────── */

function OutputImage({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.OUTPUT);
    const time = clock.elapsedTime;

    const appear = easeOut(p);
    meshRef.current.visible = p > 0;
    meshRef.current.scale.setScalar(appear * 1.2);
    meshRef.current.rotation.y = Math.sin(time * 0.5) * 0.1;

    glowRef.current.visible = p > 0.3;
    glowRef.current.scale.setScalar(appear * 1.8);

    lightRef.current.intensity = p > 0 ? appear * 6 : 0;
  });

  return (
    <group position={POS.output}>
      <pointLight ref={lightRef} color={COLOR.output} intensity={0} distance={8} />
      <mesh ref={meshRef} visible={false}>
        <boxGeometry args={[1.4, 1.4, 0.08]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <boxGeometry args={[1.6, 1.6, 0.02]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={0.3}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
      <Text position={[0, -1.5, 0]} fontSize={0.26} color={COLOR.output} anchorX="center" anchorY="middle">
        Output Image
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Transfer flights between stages
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

    const visible = p > 0.3 && p < 0.9;
    const fp = visible ? easeInOut((p - 0.3) / 0.6) : 0;

    if (orbRef.current) {
      if (visible) {
        const x = lerp(from[0], to[0], fp);
        const y = lerp(from[1], to[1], fp) + Math.sin(fp * Math.PI) * 1.2;
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
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
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

export default function ImageGenScene({ playing, onStepChange, onComplete }: SceneProps) {
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
    if (t >= PHASE.ENCODE[0]) step = 1;
    if (t >= PHASE.NOISE[0]) step = 2;
    if (t >= PHASE.REFINE[0]) step = 3;
    if (t >= PHASE.UPSCALE[0]) step = 4;
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
      <Encoder elapsedRef={elapsedRef} />
      <EncodeFlight elapsedRef={elapsedRef} />
      <NoiseField elapsedRef={elapsedRef} />
      <IterativeRefinement elapsedRef={elapsedRef} />
      <Upscaling elapsedRef={elapsedRef} />
      <OutputImage elapsedRef={elapsedRef} />

      {/* Transfer orbs between stages */}
      <TransferOrb
        elapsedRef={elapsedRef}
        phase={PHASE.NOISE}
        from={POS.encode as unknown as V3}
        to={POS.noise as unknown as V3}
        color={COLOR.encode}
      />
      <TransferOrb
        elapsedRef={elapsedRef}
        phase={PHASE.REFINE}
        from={POS.noise as unknown as V3}
        to={POS.refine as unknown as V3}
        color={COLOR.noise}
      />
      <TransferOrb
        elapsedRef={elapsedRef}
        phase={PHASE.UPSCALE}
        from={POS.refine as unknown as V3}
        to={POS.upscale as unknown as V3}
        color={COLOR.refine}
      />
      <TransferOrb
        elapsedRef={elapsedRef}
        phase={PHASE.OUTPUT}
        from={POS.upscale as unknown as V3}
        to={POS.output as unknown as V3}
        color={COLOR.upscale}
      />
    </>
  );
}
