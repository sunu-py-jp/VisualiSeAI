"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  lerp,
  easeInOut,
  easeOut,
  easeIn,
  clamp01,
  phaseT,
  type V3,
  type ElRef,
  type SceneProps,
} from "../shared/sceneUtils";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR, PARTICLE_COUNT } from "./constants";

/* ────────────────────────────────────────────
   Pre-compute icosahedron surface points
   ──────────────────────────────────────────── */

function generateIcosahedronPoints(count: number, radius: number): V3[] {
  const points: V3[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / count);
    const phi = Math.PI * 2 * i / goldenRatio;
    points.push([
      Math.sin(theta) * Math.cos(phi) * radius,
      Math.sin(theta) * Math.sin(phi) * radius,
      Math.cos(theta) * radius,
    ]);
  }
  return points;
}

// Original shape points (icosahedron-ish sphere)
const ORIG_POINTS = generateIcosahedronPoints(PARTICLE_COUNT, 1.8);

// Generated shape points (different shape - torus-like)
const GEN_POINTS: V3[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const u = (i / PARTICLE_COUNT) * Math.PI * 2;
  const v = ((i * 7.31) % PARTICLE_COUNT) / PARTICLE_COUNT * Math.PI * 2;
  const R = 1.5;
  const r = 0.6;
  return [
    (R + r * Math.cos(v)) * Math.cos(u),
    (R + r * Math.cos(v)) * Math.sin(u),
    r * Math.sin(v),
  ] as V3;
});

// Pre-compute random scatter directions for noise state
const NOISE_OFFSETS: V3[] = Array.from({ length: PARTICLE_COUNT }, () => {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 2.5 + Math.random() * 3.5;
  return [
    Math.sin(phi) * Math.cos(theta) * r,
    Math.sin(phi) * Math.sin(theta) * r,
    Math.cos(phi) * r,
  ] as V3;
});

// Per-particle random speeds for noise jitter
const NOISE_SPEEDS = Array.from({ length: PARTICLE_COUNT }, () => ({
  sx: 0.3 + Math.random() * 1.2,
  sy: 0.4 + Math.random() * 1.0,
  sz: 0.2 + Math.random() * 0.8,
  phase: Math.random() * Math.PI * 2,
}));

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
   Main particle cloud (200 particles)
   InstancedMesh for performance
   ──────────────────────────────────────────── */

function DiffusionParticles({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const origColor = useMemo(() => new THREE.Color(COLOR.original), []);
  const noiseColor = useMemo(() => new THREE.Color(COLOR.noise), []);
  const reverseColor = useMemo(() => new THREE.Color(COLOR.reverse), []);
  const genColor = useMemo(() => new THREE.Color(COLOR.generated), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    const origP = phaseT(t, PHASE.ORIGINAL);
    const fwdP = phaseT(t, PHASE.FORWARD);
    const noiseP = phaseT(t, PHASE.NOISE);
    const revP = phaseT(t, PHASE.REVERSE);
    const genP = phaseT(t, PHASE.GENERATED);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const orig = ORIG_POINTS[i];
      const noff = NOISE_OFFSETS[i];
      const ns = NOISE_SPEEDS[i];
      const gen = GEN_POINTS[i];

      let x: number, y: number, z: number;
      let scale: number;

      // Phase 1: Original — particles form icosahedron shape, appear progressively
      if (fwdP <= 0) {
        const appear = easeOut(clamp01(origP * 3 - (i / PARTICLE_COUNT) * 2));
        x = POS.original[0] + orig[0];
        y = POS.original[1] + orig[1];
        z = POS.original[2] + orig[2];
        scale = 0.06 * appear;

        tempColor.copy(origColor);
      }
      // Phase 2: Forward Diffusion — particles scatter outward from shape to noise
      else if (noiseP <= 0) {
        const ep = easeInOut(fwdP);
        // Staggered departure
        const stagger = clamp01((fwdP - (i / PARTICLE_COUNT) * 0.3) / 0.7);
        const sp = easeOut(stagger);

        const baseX = POS.original[0] + orig[0];
        const baseY = POS.original[1] + orig[1];
        const baseZ = POS.original[2] + orig[2];

        const noiseX = POS.noise[0] + noff[0];
        const noiseY = POS.noise[1] + noff[1];
        const noiseZ = POS.noise[2] + noff[2];

        x = lerp(baseX, noiseX, sp);
        y = lerp(baseY, noiseY, sp);
        z = lerp(baseZ, noiseZ, sp);

        // Growing jitter as they scatter
        const jitter = sp * 0.3;
        x += Math.sin(time * ns.sx + ns.phase) * jitter;
        y += Math.sin(time * ns.sy + ns.phase + 1) * jitter;
        z += Math.sin(time * ns.sz + ns.phase + 2) * jitter;

        scale = 0.06 + sp * 0.02;
        tempColor.copy(origColor).lerp(noiseColor, ep);
      }
      // Phase 3: Pure Noise — particles jitter randomly
      else if (revP <= 0) {
        const jitter = 0.6 + noiseP * 0.3;
        x = POS.noise[0] + noff[0] + Math.sin(time * ns.sx + ns.phase) * jitter;
        y = POS.noise[1] + noff[1] + Math.sin(time * ns.sy + ns.phase + 1) * jitter;
        z = POS.noise[2] + noff[2] + Math.sin(time * ns.sz + ns.phase + 2) * jitter;
        scale = 0.05 + Math.sin(time * 3 + i) * 0.02;

        // Slight pulse effect
        tempColor.copy(noiseColor);
        const pulse = Math.sin(time * 2 + i * 0.1) * 0.15;
        tempColor.r += pulse;
        tempColor.g += pulse;
        tempColor.b += pulse;
      }
      // Phase 4: Reverse Diffusion — particles re-organize into new shape
      else if (genP <= 0) {
        // Staggered convergence (reverse order adds visual drama)
        const stagger = clamp01((revP - ((PARTICLE_COUNT - i) / PARTICLE_COUNT) * 0.3) / 0.7);
        const sp = easeInOut(stagger);

        const noiseX = POS.noise[0] + noff[0] + Math.sin(time * ns.sx * 0.3 + ns.phase) * 0.3 * (1 - sp);
        const noiseY = POS.noise[1] + noff[1] + Math.sin(time * ns.sy * 0.3 + ns.phase + 1) * 0.3 * (1 - sp);
        const noiseZ = POS.noise[2] + noff[2] + Math.sin(time * ns.sz * 0.3 + ns.phase + 2) * 0.3 * (1 - sp);

        const targetX = POS.generated[0] + gen[0];
        const targetY = POS.generated[1] + gen[1];
        const targetZ = POS.generated[2] + gen[2];

        x = lerp(noiseX, targetX, sp);
        y = lerp(noiseY, targetY, sp);
        z = lerp(noiseZ, targetZ, sp);
        scale = 0.06 + (1 - Math.abs(sp - 0.5) * 2) * 0.03;

        tempColor.copy(noiseColor).lerp(reverseColor, easeOut(revP));
      }
      // Phase 5: Generated — clean new shape formed, gentle rotation
      else {
        const settle = easeOut(genP);
        const angle = time * 0.3;
        const gx = gen[0];
        const gz = gen[2];
        const rx = gx * Math.cos(angle) - gz * Math.sin(angle);
        const rz = gx * Math.sin(angle) + gz * Math.cos(angle);

        x = POS.generated[0] + rx;
        y = POS.generated[1] + gen[1];
        z = POS.generated[2] + rz;
        scale = 0.06 + settle * 0.02;

        tempColor.copy(genColor);
        tempColor.r += Math.sin(time * 2 + i * 0.05) * 0.08;
      }

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      ref.current!.setColorAt(i, tempColor);
    }

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={1.2}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Original Shape ghost (icosahedron wireframe)
   ──────────────────────────────────────────── */

function OriginalShape({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const origP = phaseT(t, PHASE.ORIGINAL);
    const fwdP = phaseT(t, PHASE.FORWARD);

    const visible = origP > 0 && fwdP < 1;
    meshRef.current.visible = visible;

    if (visible) {
      const fadeIn = easeOut(clamp01(origP * 2));
      const fadeOut = 1 - easeIn(fwdP);
      const opacity = fadeIn * fadeOut;

      meshRef.current.rotation.y = clock.elapsedTime * 0.2;
      meshRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.1;
      meshRef.current.scale.setScalar(1.8 * (1 + fwdP * 0.3));

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = opacity * 0.3;
      mat.emissiveIntensity = opacity * 0.5;
    }

    if (lightRef.current) {
      lightRef.current.intensity = origP > 0 && fwdP < 1 ? 3 * (1 - fwdP) : 0;
    }
  });

  return (
    <group position={POS.original}>
      <pointLight ref={lightRef} color={COLOR.original} intensity={0} distance={8} />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={COLOR.original}
          emissive={COLOR.original}
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────
   Generated Shape ghost (torus wireframe)
   ──────────────────────────────────────────── */

function GeneratedShape({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const revP = phaseT(t, PHASE.REVERSE);
    const genP = phaseT(t, PHASE.GENERATED);

    const visible = revP > 0.3;
    meshRef.current.visible = visible;

    if (visible) {
      const fadeIn = easeOut(clamp01((revP - 0.3) / 0.7));
      meshRef.current.rotation.y = clock.elapsedTime * 0.3;
      meshRef.current.scale.setScalar(1 * fadeIn);

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = fadeIn * 0.25 + genP * 0.15;
      mat.emissiveIntensity = 0.3 + genP * 0.7;
    }

    if (lightRef.current) {
      lightRef.current.intensity = revP > 0.3 ? 4 * easeOut((revP - 0.3) / 0.7) + genP * 3 : 0;
    }
  });

  return (
    <group position={POS.generated}>
      <pointLight ref={lightRef} color={COLOR.generated} intensity={0} distance={8} />
      <mesh ref={meshRef}>
        <torusGeometry args={[1.5, 0.6, 12, 32]} />
        <meshStandardMaterial
          color={COLOR.generated}
          emissive={COLOR.generated}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────
   Noise field — pulsing wireframe sphere
   ──────────────────────────────────────────── */

function NoiseField({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const fwdP = phaseT(t, PHASE.FORWARD);
    const noiseP = phaseT(t, PHASE.NOISE);
    const revP = phaseT(t, PHASE.REVERSE);

    const active = fwdP > 0.3 && revP < 1;
    meshRef.current.visible = active;

    if (active) {
      const fadeIn = easeOut(clamp01((fwdP - 0.3) / 0.4));
      const fadeOut = 1 - easeIn(revP);
      const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.15;

      meshRef.current.scale.setScalar(4 * fadeIn * fadeOut * pulse);
      meshRef.current.rotation.x = clock.elapsedTime * 0.15;
      meshRef.current.rotation.z = clock.elapsedTime * 0.1;

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = fadeIn * fadeOut * 0.08;
    }

    if (lightRef.current) {
      lightRef.current.intensity = fwdP > 0.3 && revP < 1
        ? 2 * Math.sin(clock.elapsedTime * 2) + 2
        : 0;
    }
  });

  return (
    <group position={POS.noise}>
      <pointLight ref={lightRef} color={COLOR.noise} intensity={0} distance={10} />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={COLOR.noise}
          emissive={COLOR.noise}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────
   Directional arrows — show process flow
   ──────────────────────────────────────────── */

function FlowArrow({
  from,
  to,
  color,
  elapsedRef,
  phase,
}: {
  from: V3;
  to: V3;
  color: string;
  elapsedRef: ElRef;
  phase: readonly [number, number];
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const p = phaseT(elapsedRef.current, phase);
    ref.current.visible = p > 0 && p < 1;
    if (ref.current.visible) {
      const ep = easeInOut(p);
      ref.current.position.set(
        lerp(from[0], to[0], ep),
        lerp(from[1], to[1], ep) + Math.sin(ep * Math.PI) * 1.5,
        lerp(from[2], to[2], ep)
      );
      ref.current.scale.setScalar(0.15 + Math.sin(ep * Math.PI) * 0.1);
    }
  });

  return (
    <group ref={ref} visible={false}>
      <mesh>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage Labels
   ──────────────────────────────────────────── */

function StageLabels({ elapsedRef }: { elapsedRef: ElRef }) {
  const labels: { text: string; pos: V3; phase: readonly [number, number]; color: string }[] = [
    { text: "Original Image", pos: [POS.original[0], -3.2, 0], phase: PHASE.ORIGINAL, color: COLOR.original },
    { text: "Forward\nDiffusion", pos: [POS.forwardMid[0], -3.2, 0], phase: PHASE.FORWARD, color: COLOR.forward },
    { text: "Pure Noise", pos: [POS.noise[0], -3.2, 0], phase: PHASE.NOISE, color: COLOR.noise },
    { text: "Reverse\nDiffusion", pos: [POS.reverseMid[0], -3.2, 0], phase: PHASE.REVERSE, color: COLOR.reverse },
    { text: "Generated Image", pos: [POS.generated[0], -3.2, 0], phase: PHASE.GENERATED, color: COLOR.generated },
  ];

  return (
    <>
      {labels.map((label) => (
        <StageLabel
          key={label.text}
          text={label.text}
          position={label.pos}
          color={label.color}
          phase={label.phase}
          elapsedRef={elapsedRef}
        />
      ))}
    </>
  );
}

function StageLabel({
  text,
  position,
  color,
  phase,
  elapsedRef,
}: {
  text: string;
  position: V3;
  color: string;
  phase: readonly [number, number];
  elapsedRef: ElRef;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const p = phaseT(elapsedRef.current, phase);
    ref.current.visible = p > 0;
    if (ref.current.visible) {
      const mat = (ref.current.children[0] as THREE.Mesh)?.material;
      if (mat && "opacity" in mat) {
        (mat as THREE.MeshStandardMaterial).opacity = easeOut(clamp01(p * 3));
      }
    }
  });

  return (
    <group ref={ref} position={position} visible={false}>
      <Text
        fontSize={0.28}
        color={color}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        maxWidth={3}
      >
        {text}
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Connection line (faint guide)
   ──────────────────────────────────────────── */

function ConnectionLine() {
  const lineObj = useMemo(() => {
    const pts = [POS.original, POS.forwardMid, POS.noise, POS.reverseMid, POS.generated].map(
      (p) => new THREE.Vector3(...p)
    );
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

export default function DiffusionScene({ playing, onStepChange, onComplete }: SceneProps) {
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
    if (t >= PHASE.ORIGINAL[0]) step = 0;
    if (t >= PHASE.FORWARD[0]) step = 1;
    if (t >= PHASE.NOISE[0]) step = 2;
    if (t >= PHASE.REVERSE[0]) step = 3;
    if (t >= PHASE.GENERATED[0]) step = 4;

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
      <ambientLight intensity={0.12} />
      <directionalLight position={[5, 8, 5]} intensity={0.3} />
      <directionalLight position={[-8, 4, -3]} intensity={0.15} />

      {/* Background */}
      <AmbientParticles />
      <ConnectionLine />

      {/* Stage shapes */}
      <OriginalShape elapsedRef={elapsedRef} />
      <NoiseField elapsedRef={elapsedRef} />
      <GeneratedShape elapsedRef={elapsedRef} />

      {/* Main particle system */}
      <DiffusionParticles elapsedRef={elapsedRef} />

      {/* Flow arrows */}
      <FlowArrow
        from={POS.original}
        to={POS.noise}
        color={COLOR.forward}
        elapsedRef={elapsedRef}
        phase={PHASE.FORWARD}
      />
      <FlowArrow
        from={POS.noise}
        to={POS.generated}
        color={COLOR.reverse}
        elapsedRef={elapsedRef}
        phase={PHASE.REVERSE}
      />

      {/* Labels */}
      <StageLabels elapsedRef={elapsedRef} />
    </>
  );
}
