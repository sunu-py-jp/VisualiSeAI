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
  TrailRing,
  type V3,
  type ElRef,
  type SceneProps,
} from "../shared/sceneUtils";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";

/* ────────────────────────────────────────────
   Pre-computed data
   ──────────────────────────────────────────── */

// Text fragments that fly toward CLIP encoder
const TEXT_FRAGMENTS = [
  "a cat", "sitting", "on", "a", "red", "couch", "photo", "realistic",
];

const TEXT_OFFSETS: V3[] = TEXT_FRAGMENTS.map((_, i) => [
  -1.5 + (i % 4) * 1.0,
  1.5 - Math.floor(i / 4) * 1.2,
  (Math.random() - 0.5) * 0.8,
]);

// Latent grid dots (8x8 = 64 dots representing latent space)
const LATENT_SIZE = 8;
const LATENT_COUNT = LATENT_SIZE * LATENT_SIZE;
const LATENT_DOTS: { pos: V3; noisePhase: number }[] = [];
for (let row = 0; row < LATENT_SIZE; row++) {
  for (let col = 0; col < LATENT_SIZE; col++) {
    const x = (col / (LATENT_SIZE - 1) - 0.5) * 2.0;
    const y = (row / (LATENT_SIZE - 1) - 0.5) * 2.0;
    LATENT_DOTS.push({
      pos: [x, y, 0] as V3,
      noisePhase: Math.random() * Math.PI * 2,
    });
  }
}

// VAE expanded grid (larger version, 10x10 = 100)
const VAE_SIZE = 10;
const VAE_COUNT = VAE_SIZE * VAE_SIZE;
const VAE_DOTS: V3[] = [];
for (let row = 0; row < VAE_SIZE; row++) {
  for (let col = 0; col < VAE_SIZE; col++) {
    VAE_DOTS.push([
      (col / (VAE_SIZE - 1) - 0.5) * 3.5,
      (row / (VAE_SIZE - 1) - 0.5) * 3.5,
      0,
    ] as V3);
  }
}

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
   Text Prompt — floating text fragments
   ──────────────────────────────────────────── */

function TextPromptFragment({
  text,
  index,
  elapsedRef,
}: {
  text: string;
  index: number;
  elapsedRef: ElRef;
}) {
  const ref = useRef<THREE.Group>(null);
  const offset = TEXT_OFFSETS[index];

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const promptP = phaseT(elapsedRef.current, PHASE.PROMPT);
    const clipP = phaseT(elapsedRef.current, PHASE.CLIP);

    if (promptP <= 0 || clipP >= 1) {
      ref.current.visible = false;
      return;
    }

    ref.current.visible = true;
    const time = clock.elapsedTime;

    // Appear with stagger
    const appear = easeOut(clamp01((promptP - index * 0.08) / 0.5));

    if (clipP <= 0) {
      // Float around prompt position
      ref.current.position.set(
        POS.prompt[0] + offset[0],
        POS.prompt[1] + offset[1] + Math.sin(time * 0.8 + index) * 0.15,
        POS.prompt[2] + offset[2]
      );
      ref.current.scale.setScalar(appear);
    } else {
      // Fly toward CLIP sphere
      const fly = easeInOut(clamp01((clipP - index * 0.05) / 0.6));
      ref.current.position.set(
        lerp(POS.prompt[0] + offset[0], POS.clip[0], fly),
        lerp(POS.prompt[1] + offset[1], POS.clip[1], fly) + Math.sin(fly * Math.PI) * 1.0,
        lerp(POS.prompt[2] + offset[2], POS.clip[2], fly)
      );
      ref.current.scale.setScalar(appear * (1 - fly * 0.7));
    }
  });

  return (
    <group ref={ref} visible={false}>
      <Text
        fontSize={0.25}
        color={COLOR.prompt}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="black"
      >
        {text}
      </Text>
    </group>
  );
}

function TextPrompt({ elapsedRef }: { elapsedRef: ElRef }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.PROMPT);
    lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.prompt} color={COLOR.prompt} intensity={0} distance={6} />
      {TEXT_FRAGMENTS.map((text, i) => (
        <TextPromptFragment key={i} text={text} index={i} elapsedRef={elapsedRef} />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   CLIP Encoder — sphere that absorbs text
   ──────────────────────────────────────────── */

function CLIPEncoder({ elapsedRef }: { elapsedRef: ElRef }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!sphereRef.current || !ringRef.current) return;
    const t = elapsedRef.current;
    const clipP = phaseT(t, PHASE.CLIP);
    const latentP = phaseT(t, PHASE.LATENT);
    const time = clock.elapsedTime;

    const visible = clipP > 0 || (latentP > 0 && latentP < 0.5);
    sphereRef.current.visible = visible;
    ringRef.current.visible = visible;

    if (visible) {
      // Pulse as it absorbs text
      const absorb = clipP > 0 ? easeOut(clipP) : 0;
      const shrink = latentP > 0 ? easeIn(clamp01(latentP * 2)) : 0;
      const scale = (0.6 + absorb * 0.5) * (1 - shrink * 0.8);

      sphereRef.current.scale.setScalar(scale + Math.sin(time * 4) * 0.05 * absorb);
      sphereRef.current.rotation.y = time * 0.5;

      ringRef.current.rotation.x = time * 0.7;
      ringRef.current.rotation.z = time * 0.3;
      ringRef.current.scale.setScalar(scale * 1.5);

      const mat = sphereRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + absorb * 1.5;
    }

    if (lightRef.current) {
      lightRef.current.intensity = (clipP > 0 ? 4 * easeOut(clipP) : 0) * (1 - (latentP > 0.5 ? 1 : 0));
    }
  });

  return (
    <group position={POS.clip}>
      <pointLight ref={lightRef} color={COLOR.clip} intensity={0} distance={8} />
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={COLOR.clip}
          emissive={COLOR.clip}
          emissiveIntensity={0.3}
          transparent
          opacity={0.7}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.04, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.clip}
          emissive={COLOR.clip}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.26}
        color={COLOR.clip}
        anchorX="center"
        anchorY="middle"
      >
        CLIP Encoder
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Encoded Vector — compressed glowing cube
   Flies from CLIP to Latent space
   ──────────────────────────────────────────── */

function EncodedVector({ elapsedRef }: { elapsedRef: ElRef }) {
  const cubeRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const TRAIL = 20;
  const trail = useRef(new TrailRing(TRAIL));

  useFrame(({ clock }) => {
    if (!cubeRef.current) return;
    const t = elapsedRef.current;
    const clipP = phaseT(t, PHASE.CLIP);
    const latentP = phaseT(t, PHASE.LATENT);
    const time = clock.elapsedTime;

    // Visible during late CLIP → early LATENT
    const visible = clipP > 0.6 && latentP < 0.5;
    cubeRef.current.visible = visible;

    if (t < 0.1) trail.current.reset();

    if (visible) {
      const flyP = easeInOut(clamp01((clipP - 0.6) / 0.4 + latentP * 0.5));
      const x = lerp(POS.clip[0], POS.latent[0], flyP);
      const y = lerp(POS.clip[1], POS.latent[1], flyP) + Math.sin(flyP * Math.PI) * 1.5;
      const z = Math.sin(flyP * Math.PI * 2) * 0.5;

      cubeRef.current.position.set(x, y, z);
      cubeRef.current.rotation.x = time * 2;
      cubeRef.current.rotation.y = time * 1.5;
      cubeRef.current.scale.setScalar(0.3 + Math.sin(time * 6) * 0.04);

      // Push trail
      const ring = trail.current;
      if (ring.length === 0) {
        ring.push(x, y, z);
      } else {
        const last = ring.get(0);
        const dx = x - last[0];
        const dy = y - last[1];
        const dz2 = z - last[2];
        if (dx * dx + dy * dy + dz2 * dz2 > 0.005) {
          ring.push(x, y, z);
        }
      }
    }

    // Trail instances
    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && visible) {
          const p = ring.get(i);
          dummy.position.set(p[0], p[1], p[2]);
          dummy.scale.setScalar(((TRAIL - i) / TRAIL) * 0.12);
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
      <mesh ref={cubeRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.clip}
          emissive={COLOR.clip}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.clip}
          emissive={COLOR.clip}
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
   Latent Space Grid — small noisy grid
   ──────────────────────────────────────────── */

function LatentGrid({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const latentColor = useMemo(() => new THREE.Color(COLOR.latent), []);
  const unetColor = useMemo(() => new THREE.Color(COLOR.unet), []);
  const frameRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = elapsedRef.current;
    const latentP = phaseT(t, PHASE.LATENT);
    const unetP = phaseT(t, PHASE.UNET);
    const vaeP = phaseT(t, PHASE.VAE);
    const time = clock.elapsedTime;

    const visible = latentP > 0.2 && vaeP < 0.8;
    if (frameRef.current) {
      frameRef.current.visible = visible;
    }

    if (!visible) {
      // Hide all instances
      for (let i = 0; i < LATENT_COUNT; i++) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
      }
      ref.current.instanceMatrix.needsUpdate = true;
      return;
    }

    const fadeIn = easeOut(clamp01((latentP - 0.2) / 0.5));
    const fadeOut = 1 - easeIn(clamp01((vaeP - 0.3) / 0.5));

    // U-Net denoising: noise level decreases over unetP
    // Multiple visible "passes" using sine waves
    const noiseLevel = unetP > 0 ? 1 - easeInOut(unetP) : 1;
    const passWave = unetP > 0 ? Math.sin(unetP * Math.PI * 4) * 0.3 : 0;

    for (let i = 0; i < LATENT_COUNT; i++) {
      const d = LATENT_DOTS[i];

      // Base position
      let x = POS.latent[0] + d.pos[0];
      let y = POS.latent[1] + d.pos[1];
      const z = POS.latent[2];

      // Add noise jitter (diminishes during U-Net phase)
      const jitter = noiseLevel * 0.4;
      x += Math.sin(time * 2.5 + d.noisePhase) * jitter;
      y += Math.cos(time * 2.0 + d.noisePhase + 1) * jitter;

      const scale = 0.06 * fadeIn * fadeOut + Math.abs(passWave) * 0.02;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);

      // Color transitions: noisy → clean
      const cleanness = 1 - noiseLevel;
      tempColor.copy(latentColor).lerp(unetColor, cleanness);
      // Bright flash during pass waves
      if (unetP > 0 && passWave > 0.1) {
        const flash = passWave * 2;
        tempColor.r = Math.min(1, tempColor.r + flash * 0.3);
        tempColor.g = Math.min(1, tempColor.g + flash * 0.3);
        tempColor.b = Math.min(1, tempColor.b + flash * 0.3);
      }
      ref.current!.setColorAt(i, tempColor);
    }

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Latent space bounding frame */}
      <mesh ref={frameRef} position={POS.latent} visible={false}>
        <boxGeometry args={[2.5, 2.5, 0.1]} />
        <meshStandardMaterial
          color={COLOR.latent}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          emissive={COLOR.latent}
          emissiveIntensity={0.1}
        />
      </mesh>

      <instancedMesh ref={ref} args={[undefined, undefined, LATENT_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.latent}
          emissive={COLOR.latent}
          emissiveIntensity={1}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </instancedMesh>

      <Text
        position={[POS.latent[0], POS.latent[1] - 2, 0]}
        fontSize={0.22}
        color={COLOR.latent}
        anchorX="center"
        anchorY="middle"
      >
        Latent Space
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   U-Net Denoising visualization —
   scan line sweeps across the latent grid
   ──────────────────────────────────────────── */

function UNetScanLine({ elapsedRef }: { elapsedRef: ElRef }) {
  const lineRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const unetP = phaseT(elapsedRef.current, PHASE.UNET);

    const visible = unetP > 0 && unetP < 1;
    lineRef.current.visible = visible;

    if (visible) {
      // Sweep back and forth multiple times
      const sweepCount = 3;
      const sweep = (unetP * sweepCount) % 1;
      const pass = Math.floor(unetP * sweepCount);
      const direction = pass % 2 === 0 ? 1 : -1;

      const x = POS.latent[0] + (sweep * direction) * 2.2 - (direction > 0 ? 1.1 : -1.1);
      lineRef.current.position.set(x, POS.latent[1], POS.latent[2] + 0.1);
      lineRef.current.scale.set(0.03, 2.5, 0.03);

      const mat = lineRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2 + Math.sin(clock.elapsedTime * 8) * 0.5;
    }

    if (lightRef.current) {
      lightRef.current.intensity = unetP > 0 && unetP < 1 ? 3 : 0;
      if (lineRef.current.visible) {
        lightRef.current.position.copy(lineRef.current.position);
      }
    }
  });

  return (
    <>
      <mesh ref={lineRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.unet}
          emissive={COLOR.unet}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.8}
        />
      </mesh>
      <pointLight ref={lightRef} color={COLOR.unet} intensity={0} distance={6} />
    </>
  );
}

/* ────────────────────────────────────────────
   U-Net Label with step counter
   ──────────────────────────────────────────── */

function UNetLabel({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const unetP = phaseT(elapsedRef.current, PHASE.UNET);
    ref.current.visible = unetP > 0 && unetP < 1;
  });

  return (
    <group ref={ref} position={[POS.unet[0] - 1, POS.unet[1] + 2.2, 0]} visible={false}>
      <Text
        fontSize={0.28}
        color={COLOR.unet}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="black"
      >
        U-Net Denoising
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   VAE Decoder — expands latent to full image
   ──────────────────────────────────────────── */

function VAEDecoder({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const vaeColor = useMemo(() => new THREE.Color(COLOR.vae), []);
  const finalColor = useMemo(() => new THREE.Color(COLOR.final), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = elapsedRef.current;
    const vaeP = phaseT(t, PHASE.VAE);
    const finalP = phaseT(t, PHASE.FINAL);
    const time = clock.elapsedTime;

    const visible = vaeP > 0.1;

    for (let i = 0; i < VAE_COUNT; i++) {
      if (!visible) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const target = VAE_DOTS[i];
      // Map from latent grid to expanded grid
      const latentIdx = Math.floor((i / VAE_COUNT) * LATENT_COUNT);
      const latentDot = LATENT_DOTS[Math.min(latentIdx, LATENT_COUNT - 1)];

      const expand = easeOut(clamp01((vaeP - 0.1 - (i / VAE_COUNT) * 0.3) / 0.6));

      // Start from latent position, expand to VAE position
      const startX = POS.latent[0] + latentDot.pos[0];
      const startY = POS.latent[1] + latentDot.pos[1];
      const endX = POS.vae[0] + target[0];
      const endY = POS.vae[1] + target[1];

      const x = lerp(startX, endX, expand);
      const y = lerp(startY, endY, expand);
      const z = Math.sin(expand * Math.PI) * 0.3;

      // Gentle float in final phase
      const finalFloat = finalP > 0 ? Math.sin(time * 0.5 + i * 0.1) * 0.03 * finalP : 0;

      dummy.position.set(x, y + finalFloat, z);
      dummy.scale.setScalar(0.05 * expand + finalP * 0.01);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);

      // Color: vae purple → final vibrant
      tempColor.copy(vaeColor).lerp(finalColor, finalP);
      ref.current!.setColorAt(i, tempColor);
    }

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, VAE_COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.vae}
        emissive={COLOR.vae}
        emissiveIntensity={1.2}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   VAE Expansion frame — growing bounding box
   ──────────────────────────────────────────── */

function VAEFrame({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const vaeP = phaseT(elapsedRef.current, PHASE.VAE);
    const finalP = phaseT(elapsedRef.current, PHASE.FINAL);

    const visible = vaeP > 0.2;
    meshRef.current.visible = visible;

    if (visible) {
      const expand = easeOut(clamp01((vaeP - 0.2) / 0.6));
      const scale = lerp(2.5, 4.2, expand);
      meshRef.current.position.set(
        lerp(POS.latent[0], POS.vae[0], expand),
        POS.vae[1],
        0
      );
      meshRef.current.scale.set(scale, scale, 0.1);
      meshRef.current.rotation.z = clock.elapsedTime * 0.05;

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.05 + finalP * 0.03;
      mat.emissiveIntensity = 0.1 + finalP * 0.3;
    }

    if (lightRef.current) {
      lightRef.current.intensity = vaeP > 0.2 ? 3 * easeOut((vaeP - 0.2) / 0.8) + finalP * 4 : 0;
      lightRef.current.position.set(
        lerp(POS.latent[0], POS.vae[0], easeOut(clamp01((vaeP - 0.2) / 0.6))),
        POS.vae[1],
        1
      );
    }
  });

  return (
    <>
      <mesh ref={meshRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.vae}
          emissive={COLOR.vae}
          emissiveIntensity={0.1}
          wireframe
          transparent
          opacity={0.05}
        />
      </mesh>
      <pointLight ref={lightRef} color={COLOR.vae} intensity={0} distance={10} />
    </>
  );
}

/* ────────────────────────────────────────────
   Final Image glow
   ──────────────────────────────────────────── */

function FinalGlow({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const finalP = phaseT(elapsedRef.current, PHASE.FINAL);
    meshRef.current.visible = finalP > 0;

    if (finalP > 0) {
      const glow = easeOut(finalP);
      meshRef.current.position.set(POS.vae[0], POS.vae[1], -0.5);
      meshRef.current.scale.setScalar(4.5 * glow);
      meshRef.current.rotation.z = clock.elapsedTime * 0.02;

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = glow * 0.1;
      mat.emissiveIntensity = glow * 0.8;
    }

    if (lightRef.current) {
      lightRef.current.intensity = finalP > 0 ? easeOut(finalP) * 6 : 0;
    }
  });

  return (
    <>
      <mesh ref={meshRef} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={COLOR.final}
          emissive={COLOR.final}
          emissiveIntensity={0}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[POS.vae[0], POS.vae[1], 2]}
        color={COLOR.final}
        intensity={0}
        distance={12}
      />
    </>
  );
}

/* ────────────────────────────────────────────
   Stage Labels
   ──────────────────────────────────────────── */

function StageLabels({ elapsedRef }: { elapsedRef: ElRef }) {
  const labels: { text: string; pos: V3; phase: readonly [number, number]; color: string }[] = [
    { text: "Text Prompt", pos: [POS.prompt[0], -2.8, 0], phase: PHASE.PROMPT, color: COLOR.prompt },
    { text: "CLIP Encoding", pos: [POS.clip[0], -2.8, 0], phase: PHASE.CLIP, color: COLOR.clip },
    { text: "Latent Noise", pos: [POS.latent[0], -2.8, 0], phase: PHASE.LATENT, color: COLOR.latent },
    { text: "U-Net\nDenoising", pos: [POS.unet[0] - 1, -2.8, 0], phase: PHASE.UNET, color: COLOR.unet },
    { text: "VAE Decode", pos: [POS.vae[0], -2.8, 0], phase: PHASE.VAE, color: COLOR.vae },
    { text: "Final Image", pos: [POS.vae[0], -3.6, 0], phase: PHASE.FINAL, color: COLOR.final },
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
  });

  return (
    <group ref={ref} position={position} visible={false}>
      <Text
        fontSize={0.24}
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
    const pts = [POS.prompt, POS.clip, POS.latent, POS.unet, POS.vae, POS.final].map(
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

export default function StableDiffusionScene({ playing, onStepChange, onComplete }: SceneProps) {
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
    if (t >= PHASE.CLIP[0]) step = 1;
    if (t >= PHASE.LATENT[0]) step = 2;
    if (t >= PHASE.UNET[0]) step = 3;
    if (t >= PHASE.VAE[0]) step = 4;
    if (t >= PHASE.FINAL[0]) step = 5;

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

      {/* Text Prompt */}
      <TextPrompt elapsedRef={elapsedRef} />

      {/* CLIP Encoder */}
      <CLIPEncoder elapsedRef={elapsedRef} />
      <EncodedVector elapsedRef={elapsedRef} />

      {/* Latent Space */}
      <LatentGrid elapsedRef={elapsedRef} />

      {/* U-Net */}
      <UNetScanLine elapsedRef={elapsedRef} />
      <UNetLabel elapsedRef={elapsedRef} />

      {/* VAE Decoder */}
      <VAEDecoder elapsedRef={elapsedRef} />
      <VAEFrame elapsedRef={elapsedRef} />

      {/* Final */}
      <FinalGlow elapsedRef={elapsedRef} />

      {/* Labels */}
      <StageLabels elapsedRef={elapsedRef} />
    </>
  );
}
