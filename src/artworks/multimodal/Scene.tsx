"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";
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
   Text Stream — cubes flowing from left
   ──────────────────────────────────────────── */

const TEXT_COUNT = 10;
const TEXT_PARTICLES = Array.from({ length: TEXT_COUNT }, (_, i) => ({
  delay: i * 0.08,
  yOff: (i - TEXT_COUNT / 2) * 0.35,
}));

function TextParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = TEXT_PARTICLES[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.TEXT);

    if (p <= 0) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeInOut(clamp01((p - item.delay) / (1 - item.delay)));

    // Flow from textStart to textEnc
    meshRef.current.position.set(
      lerp(POS.textStart[0], POS.textEnc[0], ip),
      lerp(POS.textStart[1], POS.textEnc[1], ip) + item.yOff,
      lerp(POS.textStart[2], POS.textEnc[2], ip)
    );

    const s = 0.15 + Math.sin(ip * Math.PI) * 0.05;
    meshRef.current.scale.set(s * 1.6, s, s * 0.4);
    meshRef.current.rotation.z = clock.elapsedTime + index * 0.3;

    // Fade out when reaching encoder during fusion
    const fusionP = phaseT(elapsedRef.current, PHASE.FUSION);
    if (fusionP > 0.3) {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.text}
        emissive={COLOR.text}
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function TextStream({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.TEXT);
    const fp = phaseT(elapsedRef.current, PHASE.FUSION);
    labelRef.current.visible = p > 0.1 && fp < 0.3;
  });

  return (
    <group>
      {TEXT_PARTICLES.map((_, i) => (
        <TextParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[-8.5, 1.5, 0]}>
        <Text
          fontSize={0.3}
          color={COLOR.text}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Text
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Image Stream — planes falling from top
   ──────────────────────────────────────────── */

const IMG_COUNT = 8;
const IMG_PARTICLES = Array.from({ length: IMG_COUNT }, (_, i) => ({
  delay: i * 0.1,
  xOff: (i - IMG_COUNT / 2) * 0.5,
  zOff: Math.sin(i * 1.3) * 0.5,
}));

function ImageParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = IMG_PARTICLES[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.IMAGE);

    if (p <= 0) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeOut(clamp01((p - item.delay) / (1 - item.delay)));

    meshRef.current.position.set(
      lerp(POS.imageStart[0], POS.imageEnc[0], ip) + item.xOff,
      lerp(POS.imageStart[1], POS.imageEnc[1], ip),
      lerp(POS.imageStart[2], POS.imageEnc[2], ip) + item.zOff
    );

    const s = 0.5 + Math.sin(ip * Math.PI) * 0.15;
    meshRef.current.scale.set(s, s, 0.04);
    meshRef.current.rotation.x = clock.elapsedTime * 0.5 + index;
    meshRef.current.rotation.y = clock.elapsedTime * 0.3 + index * 0.5;

    const fusionP = phaseT(elapsedRef.current, PHASE.FUSION);
    if (fusionP > 0.3) {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.image}
        emissive={COLOR.image}
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function ImageStream({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.IMAGE);
    const fp = phaseT(elapsedRef.current, PHASE.FUSION);
    labelRef.current.visible = p > 0.1 && fp < 0.3;
  });

  return (
    <group>
      {IMG_PARTICLES.map((_, i) => (
        <ImageParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[0, 7.5, -1.5]}>
        <Text
          fontSize={0.3}
          color={COLOR.image}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Image
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Audio Stream — wave-shaped particles from bottom
   ──────────────────────────────────────────── */

const AUDIO_COUNT = 12;
const AUDIO_PARTICLES = Array.from({ length: AUDIO_COUNT }, (_, i) => ({
  delay: i * 0.06,
  phase: (i / AUDIO_COUNT) * Math.PI * 4,
}));

function AudioParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = AUDIO_PARTICLES[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.AUDIO);

    if (p <= 0) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeInOut(clamp01((p - item.delay) / (1 - item.delay)));

    // Wave motion as audio moves from bottom to encoder
    const waveY = Math.sin(clock.elapsedTime * 4 + item.phase) * 0.4 * (1 - ip);
    meshRef.current.position.set(
      lerp(POS.audioStart[0], POS.audioEnc[0], ip) + Math.sin(item.phase + ip * Math.PI) * 1.5 * (1 - ip),
      lerp(POS.audioStart[1], POS.audioEnc[1], ip) + waveY,
      lerp(POS.audioStart[2], POS.audioEnc[2], ip)
    );

    // Scale based on "wave amplitude"
    const amp = 0.1 + Math.abs(Math.sin(clock.elapsedTime * 3 + item.phase)) * 0.12;
    meshRef.current.scale.set(amp, amp * 2.5, amp);

    const fusionP = phaseT(elapsedRef.current, PHASE.FUSION);
    if (fusionP > 0.3) {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <capsuleGeometry args={[0.5, 1, 4, 8]} />
      <meshStandardMaterial
        color={COLOR.audio}
        emissive={COLOR.audio}
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function AudioStream({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.AUDIO);
    const fp = phaseT(elapsedRef.current, PHASE.FUSION);
    labelRef.current.visible = p > 0.1 && fp < 0.3;
  });

  return (
    <group>
      {AUDIO_PARTICLES.map((_, i) => (
        <AudioParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[0, -7.5, 1]}>
        <Text
          fontSize={0.3}
          color={COLOR.audio}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Audio
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Encoder Nodes — three encoder spheres
   ──────────────────────────────────────────── */

function EncoderNode({
  position,
  color,
  label,
  elapsedRef,
  activePhase,
}: {
  position: V3;
  color: string;
  label: string;
  elapsedRef: ElRef;
  activePhase: readonly [number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = phaseT(elapsedRef.current, activePhase);
    const fusionP = phaseT(elapsedRef.current, PHASE.FUSION);
    const activity = Math.max(p * 0.5, fusionP > 0 && fusionP < 0.5 ? (0.5 - fusionP) * 2 : 0);

    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.4;
      meshRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.2;
      meshRef.current.scale.setScalar(0.6 + activity * 0.3);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.2 + activity * 3;
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color={color}
        intensity={0.2}
        distance={5}
      />
      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.7}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      <Text
        position={[0, -1.3, 0]}
        fontSize={0.22}
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
   Fusion Sphere — central merge point
   The dramatic convergence of all streams
   ──────────────────────────────────────────── */

function FusionSphere({ elapsedRef }: { elapsedRef: ElRef }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Merge particles flying from encoders to center
  const MERGE_COUNT = 18;
  const mergeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const mergeData = useMemo(
    () =>
      Array.from({ length: MERGE_COUNT }, (_, i) => {
        const source = i % 3; // 0=text, 1=image, 2=audio
        const startPos =
          source === 0
            ? POS.textEnc
            : source === 1
            ? POS.imageEnc
            : POS.audioEnc;
        return {
          start: startPos,
          delay: (i / MERGE_COUNT) * 0.5,
          source,
          color:
            source === 0 ? COLOR.text : source === 1 ? COLOR.image : COLOR.audio,
        };
      }),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const fusionP = phaseT(t, PHASE.FUSION);
    const crossP = phaseT(t, PHASE.CROSS);
    const activity = Math.max(fusionP, crossP * 0.7);

    if (outerRef.current) {
      const scale = fusionP > 0 ? 0.3 + easeOut(Math.min(fusionP * 2, 1)) * 1.2 : 0.3;
      outerRef.current.scale.setScalar(scale + crossP * 0.3);
      outerRef.current.rotation.y = time * (0.2 + activity * 0.5);
      outerRef.current.rotation.x = Math.sin(time * 0.3) * 0.15;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.5;
      innerRef.current.rotation.z = time * 0.35;
      innerRef.current.visible = fusionP > 0.3;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = time * 0.1;
      shellRef.current.visible = fusionP > 0.5;
      shellRef.current.scale.setScalar(1.8 + Math.sin(time * 2) * 0.15);
      const mat = shellRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.min((fusionP - 0.5) * 0.4, 0.15);
    }
    if (lightRef.current) {
      lightRef.current.intensity = activity * 6;
    }

    // Merge particles
    for (let i = 0; i < MERGE_COUNT; i++) {
      const mesh = mergeRefs.current[i];
      if (!mesh) continue;
      const d = mergeData[i];
      const mp = clamp01((fusionP - d.delay) / (0.6));

      if (fusionP <= 0 || mp >= 1) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const ep = easeInOut(mp);
      mesh.position.set(
        lerp(d.start[0], POS.fusion[0], ep),
        lerp(d.start[1], POS.fusion[1], ep) +
          Math.sin(ep * Math.PI) * (d.source === 1 ? 1.5 : d.source === 2 ? -1 : 0.5),
        lerp(d.start[2], POS.fusion[2], ep)
      );
      mesh.scale.setScalar(0.1 * (1 - ep * 0.5));
    }
  });

  return (
    <group position={POS.fusion}>
      <pointLight
        ref={lightRef}
        color={COLOR.fusion}
        intensity={0}
        distance={10}
      />
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial
          color={COLOR.fusion}
          emissive={COLOR.fusion}
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh ref={innerRef} visible={false}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshStandardMaterial
          color={COLOR.fusion}
          emissive={COLOR.fusion}
          emissiveIntensity={0.8}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh ref={shellRef} visible={false}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={COLOR.fusion}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          emissive={COLOR.fusion}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Merge particles — individual meshes */}
      {mergeData.map((d, i) => (
        <mesh
          key={i}
          ref={(el) => {
            mergeRefs.current[i] = el;
          }}
          visible={false}
          position={[0, -100, 0]}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial
            color={d.color}
            emissive={d.color}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}

      <Text
        position={[0, -2.2, 0]}
        fontSize={0.28}
        color={COLOR.fusion}
        anchorX="center"
        anchorY="middle"
      >
        Fusion
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Cross-Modal Attention Beams
   Beams connecting different modalities
   ──────────────────────────────────────────── */

const BEAM_PAIRS: Array<{ from: V3; to: V3; color: string }> = [
  { from: POS.textEnc, to: POS.imageEnc, color: COLOR.cross },
  { from: POS.imageEnc, to: POS.audioEnc, color: COLOR.cross },
  { from: POS.audioEnc, to: POS.textEnc, color: COLOR.cross },
  { from: POS.textEnc, to: POS.fusion, color: COLOR.text },
  { from: POS.imageEnc, to: POS.fusion, color: COLOR.image },
  { from: POS.audioEnc, to: POS.fusion, color: COLOR.audio },
];

function AttentionBeam({
  from,
  to,
  color,
  index,
  elapsedRef,
}: {
  from: V3;
  to: V3;
  color: string;
  index: number;
  elapsedRef: ElRef;
}) {
  const lineObj = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(
        new THREE.Vector3(
          lerp(from[0], to[0], t),
          lerp(from[1], to[1], t) + Math.sin(t * Math.PI) * 0.8,
          lerp(from[2], to[2], t)
        )
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [from, to, color]);

  useFrame(({ clock }) => {
    const crossP = phaseT(elapsedRef.current, PHASE.CROSS);
    const mat = lineObj.material as THREE.LineBasicMaterial;
    if (crossP <= 0 || crossP >= 1) {
      mat.opacity = 0;
      return;
    }
    const delay = index * 0.1;
    const ip = clamp01((crossP - delay) / 0.4);
    const pulse = Math.sin(clock.elapsedTime * 4 + index) * 0.15 + 0.85;
    mat.opacity = easeOut(ip) * 0.35 * pulse * (crossP < 0.9 ? 1 : (1 - crossP) * 10);
  });

  return <primitive object={lineObj} />;
}

/* ────────────────────────────────────────────
   Cross-Modal Attention Particles
   Flowing between encoder pairs
   ──────────────────────────────────────────── */

const CROSS_PARTICLES = 12;
const CROSS_DATA = Array.from({ length: CROSS_PARTICLES }, (_, i) => {
  const pair = i % 3; // text-img, img-audio, audio-text
  const fromPos = pair === 0 ? POS.textEnc : pair === 1 ? POS.imageEnc : POS.audioEnc;
  const toPos = pair === 0 ? POS.imageEnc : pair === 1 ? POS.audioEnc : POS.textEnc;
  return { from: fromPos, to: toPos, delay: i * 0.06, pair };
});

function CrossParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = CROSS_DATA[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const crossP = phaseT(elapsedRef.current, PHASE.CROSS);

    if (crossP <= 0 || crossP >= 0.9) {
      meshRef.current.visible = false;
      return;
    }

    const ip = easeInOut(
      clamp01(((crossP * 3 + item.delay) % 1))
    );

    meshRef.current.visible = true;
    meshRef.current.position.set(
      lerp(item.from[0], item.to[0], ip),
      lerp(item.from[1], item.to[1], ip) + Math.sin(ip * Math.PI) * 1.2,
      lerp(item.from[2], item.to[2], ip)
    );
    meshRef.current.scale.setScalar(0.06 + Math.sin(ip * Math.PI) * 0.04);
  });

  const color =
    item.pair === 0 ? COLOR.text : item.pair === 1 ? COLOR.image : COLOR.audio;

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function CrossModalAttention({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const crossP = phaseT(elapsedRef.current, PHASE.CROSS);
    labelRef.current.visible = crossP > 0.15 && crossP < 0.85;
  });

  return (
    <group>
      {BEAM_PAIRS.map((bp, i) => (
        <AttentionBeam
          key={i}
          from={bp.from}
          to={bp.to}
          color={bp.color}
          index={i}
          elapsedRef={elapsedRef}
        />
      ))}
      {CROSS_DATA.map((_, i) => (
        <CrossParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[-2, 5.5, 0]}>
        <Text
          fontSize={0.28}
          color={COLOR.cross}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Cross-Modal Attention
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Output Orb — unified result emerges
   ──────────────────────────────────────────── */

function OutputOrb({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);

  const _pos = useRef<V3>([0, 0, 0]);

  function computePos(t: number): boolean {
    const p = phaseT(t, PHASE.OUTPUT);
    if (p <= 0 || p >= 1) return false;
    const e = easeInOut(p);
    _pos.current[0] = lerp(POS.fusion[0], POS.output[0], e);
    _pos.current[1] = Math.sin(e * Math.PI) * 3;
    _pos.current[2] = Math.sin(e * Math.PI * 0.5) * 1.5;
    return true;
  }

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const hasPos = computePos(t);
    const cur = _pos.current;

    if (orbRef.current) {
      if (hasPos) {
        orbRef.current.position.set(cur[0], cur[1], cur[2]);
        orbRef.current.visible = true;
        const pulse = 0.45 + Math.sin(clock.elapsedTime * 8) * 0.05;
        orbRef.current.scale.setScalar(pulse);
        orbRef.current.rotation.y = clock.elapsedTime * 1.5;
      } else {
        orbRef.current.visible = false;
      }
    }

    if (glowRef.current) {
      if (hasPos) {
        glowRef.current.position.set(cur[0], cur[1], cur[2]);
        glowRef.current.visible = true;
        glowRef.current.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 3) * 0.1);
        glowRef.current.rotation.y = -clock.elapsedTime * 0.8;
      } else {
        glowRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      lightRef.current.position.set(cur[0], cur[1], cur[2]);
      lightRef.current.intensity = hasPos ? 6 : 0;
    }

    if (labelRef.current) {
      if (hasPos) {
        labelRef.current.position.set(cur[0], cur[1] + 1, cur[2]);
        labelRef.current.visible = true;
      } else {
        labelRef.current.visible = false;
      }
    }
  });

  return (
    <>
      <mesh ref={orbRef} visible={false}>
        <icosahedronGeometry args={[1, 3]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.fusion}
          emissive={COLOR.fusion}
          emissiveIntensity={0.8}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.output}
        intensity={0}
        distance={10}
      />
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.35}
          color={COLOR.output}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Unified Output
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Connection Lines (faint guides)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lines = useMemo(() => {
    const pairs: [V3, V3][] = [
      [POS.textStart, POS.textEnc],
      [POS.imageStart, POS.imageEnc],
      [POS.audioStart, POS.audioEnc],
      [POS.textEnc, POS.fusion],
      [POS.imageEnc, POS.fusion],
      [POS.audioEnc, POS.fusion],
      [POS.fusion, POS.output],
    ];
    return pairs.map(([a, b]) => {
      const pts = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
      const geometry = new THREE.BufferGeometry().setFromPoints(pts);
      const material = new THREE.LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
      });
      return new THREE.Line(geometry, material);
    });
  }, []);

  return (
    <>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function MultimodalScene({
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
    if (t >= PHASE.TEXT[0]) step = 0;
    if (t >= PHASE.IMAGE[0]) step = 1;
    if (t >= PHASE.AUDIO[0]) step = 2;
    if (t >= PHASE.FUSION[0]) step = 3;
    if (t >= PHASE.CROSS[0]) step = 4;
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

      {/* Encoder Nodes */}
      <EncoderNode
        position={POS.textEnc}
        color={COLOR.textEnc}
        label="Text Encoder"
        elapsedRef={elapsedRef}
        activePhase={PHASE.TEXT}
      />
      <EncoderNode
        position={POS.imageEnc}
        color={COLOR.imgEnc}
        label="Image Encoder"
        elapsedRef={elapsedRef}
        activePhase={PHASE.IMAGE}
      />
      <EncoderNode
        position={POS.audioEnc}
        color={COLOR.audEnc}
        label="Audio Encoder"
        elapsedRef={elapsedRef}
        activePhase={PHASE.AUDIO}
      />

      {/* Input Streams */}
      <TextStream elapsedRef={elapsedRef} />
      <ImageStream elapsedRef={elapsedRef} />
      <AudioStream elapsedRef={elapsedRef} />

      {/* Fusion & Attention */}
      <FusionSphere elapsedRef={elapsedRef} />
      <CrossModalAttention elapsedRef={elapsedRef} />

      {/* Output */}
      <OutputOrb elapsedRef={elapsedRef} />
    </>
  );
}
