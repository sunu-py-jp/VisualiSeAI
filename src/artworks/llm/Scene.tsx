"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";
import {
  lerp,
  easeInOut,
  easeOut,
  clamp01,
  phaseT,
  type ElRef,
  type SceneProps,
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
    const stages = [POS.input, POS.tokenize, POS.embed, POS.transform, POS.predict, POS.output];
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
   Stage 1: Text Input — floating text fragments
   ──────────────────────────────────────────── */

const INPUT_WORDS = ["Hello", "world", "how", "are", "you"];

function TextInput({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.INPUT);
    const time = clock.elapsedTime;

    for (let i = 0; i < INPUT_WORDS.length; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const delay = i * 0.15;
      const ip = easeOut(clamp01((p - delay) / (1 - delay)));

      // Fly in from left
      mesh.position.set(
        POS.input[0] + lerp(-3, (i - 2) * 0.9, ip),
        POS.input[1] + Math.sin(time * 2 + i) * 0.15 * ip,
        POS.input[2] + Math.sin(time * 1.5 + i * 0.5) * 0.1
      );
      mesh.scale.setScalar(0.3 + ip * 0.7);
    }

    if (groupRef.current) {
      groupRef.current.visible = p > 0;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {INPUT_WORDS.map((word, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[0.7, 0.4, 0.15]} />
          <meshStandardMaterial
            color={COLOR.input}
            emissive={COLOR.input}
            emissiveIntensity={0.4}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
      <Text
        position={[POS.input[0], POS.input[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.input}
        anchorX="center"
        anchorY="middle"
      >
        Text Input
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 2: Tokenization — text breaks into token cubes
   ──────────────────────────────────────────── */

const TOKEN_COUNT = 8;

function TokenizationStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  const tokenData = useMemo(
    () =>
      Array.from({ length: TOKEN_COUNT }, (_, i) => ({
        startX: POS.input[0] + ((i % 5) - 2) * 0.9,
        targetX: POS.tokenize[0] + (i - TOKEN_COUNT / 2) * 0.65,
        targetY: POS.tokenize[1] + (Math.random() - 0.5) * 0.6,
        delay: i * 0.08,
      })),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.TOKENIZE);
    const time = clock.elapsedTime;

    for (let i = 0; i < TOKEN_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const td = tokenData[i];

      if (p <= 0 || p >= 1) {
        mesh.visible = p >= 1;
        if (p >= 1) {
          mesh.position.set(td.targetX, td.targetY, 0);
          mesh.scale.setScalar(0.22);
        }
        continue;
      }

      mesh.visible = true;
      const ip = easeInOut(clamp01((p - td.delay) / (0.8 - td.delay)));

      mesh.position.set(
        lerp(td.startX, td.targetX, ip),
        lerp(POS.input[1], td.targetY, ip) + Math.sin(ip * Math.PI) * 1.2,
        Math.sin(ip * Math.PI * 2) * 0.3
      );
      mesh.scale.setScalar(0.15 + ip * 0.1);
      mesh.rotation.y = ip * Math.PI * 0.5;
      mesh.rotation.x = Math.sin(time * 3 + i) * 0.1;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.tokenize}
        color={COLOR.token}
        intensity={0}
        distance={6}
      />
      {Array.from({ length: TOKEN_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.token}
            emissive={COLOR.token}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Text
        position={[POS.tokenize[0], POS.tokenize[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.token}
        anchorX="center"
        anchorY="middle"
      >
        Tokenization
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 3: Embedding — cubes transform into glowing vectors
   ──────────────────────────────────────────── */

const EMBED_COUNT = 8;

function EmbeddingStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  const embedData = useMemo(
    () =>
      Array.from({ length: EMBED_COUNT }, (_, i) => ({
        startX: POS.tokenize[0] + (i - EMBED_COUNT / 2) * 0.65,
        targetX: POS.embed[0] + (i - EMBED_COUNT / 2) * 0.5,
        targetY: POS.embed[1] + (Math.random() - 0.5) * 1.5,
        targetZ: (Math.random() - 0.5) * 1.0,
        delay: i * 0.06,
      })),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.EMBED);
    const time = clock.elapsedTime;

    for (let i = 0; i < EMBED_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const ed = embedData[i];

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const ip = easeInOut(clamp01((p - ed.delay) / (0.85 - ed.delay)));

      // Fly from tokenize to embed, morphing from cube to elongated vector shape
      mesh.position.set(
        lerp(ed.startX, ed.targetX, ip),
        lerp(POS.tokenize[1], ed.targetY, ip) + Math.sin(ip * Math.PI) * 0.8,
        lerp(0, ed.targetZ, ip)
      );

      // Scale morphs: cube -> tall thin vector
      const scaleX = lerp(0.22, 0.08, ip);
      const scaleY = lerp(0.22, 0.6, ip);
      const scaleZ = lerp(0.22, 0.08, ip);
      mesh.scale.set(scaleX, scaleY, scaleZ);

      // Glow pulses
      mesh.rotation.z = Math.sin(time * 2 + i * 0.7) * 0.15 * ip;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 && p < 1 ? 4 * Math.sin(p * Math.PI) : (p >= 1 ? 1 : 0);
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.embed}
        color={COLOR.embed}
        intensity={0}
        distance={7}
      />
      {Array.from({ length: EMBED_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.embed}
            emissive={COLOR.embed}
            emissiveIntensity={1.5}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
      <Text
        position={[POS.embed[0], POS.embed[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.embed}
        anchorX="center"
        anchorY="middle"
      >
        Embedding
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 4: Transformer Layers — stacked translucent planes
   with vectors passing through
   ──────────────────────────────────────────── */

const LAYER_COUNT = 6;
const VECTOR_COUNT = 8;

function TransformerLayers({ elapsedRef }: { elapsedRef: ElRef }) {
  const layerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const vectorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  const layerPositions = useMemo(
    () =>
      Array.from({ length: LAYER_COUNT }, (_, i) => ({
        x: POS.transform[0] + (i - LAYER_COUNT / 2) * 0.8,
        y: POS.transform[1],
        z: POS.transform[2],
      })),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.TRANSFORM);
    const time = clock.elapsedTime;

    // Layer planes appear sequentially
    for (let i = 0; i < LAYER_COUNT; i++) {
      const mesh = layerRefs.current[i];
      if (!mesh) continue;
      const lp = layerPositions[i];

      const layerDelay = i * 0.1;
      const layerP = easeOut(clamp01((p - layerDelay) / 0.3));

      mesh.visible = layerP > 0;
      mesh.position.set(lp.x, lp.y, lp.z);
      mesh.scale.set(0.05, 2.5 * layerP, 2 * layerP);
      mesh.rotation.y = Math.sin(time * 0.5 + i * 0.5) * 0.05;

      // Flash when vectors pass through
      const flashPhase = clamp01((p - 0.3 - i * 0.08) / 0.15);
      const flash = flashPhase > 0 && flashPhase < 1 ? Math.sin(flashPhase * Math.PI) : 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + flash * 1.5;
      mat.opacity = 0.15 + flash * 0.3;
    }

    // Vectors fly through layers left to right
    for (let i = 0; i < VECTOR_COUNT; i++) {
      const mesh = vectorRefs.current[i];
      if (!mesh) continue;

      const vecStart = p > 0.2 ? 1 : 0;
      if (vecStart === 0 || p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const vecP = easeInOut(clamp01((p - 0.25 - i * 0.04) / 0.65));

      const startX = POS.embed[0] + (i - VECTOR_COUNT / 2) * 0.5;
      const endX = POS.predict[0];
      mesh.position.set(
        lerp(startX, endX, vecP),
        POS.transform[1] + (i - VECTOR_COUNT / 2) * 0.25 + Math.sin(time * 3 + i) * 0.1,
        Math.sin(vecP * Math.PI) * 0.4
      );
      mesh.scale.set(0.06, 0.4 + vecP * 0.2, 0.06);
      mesh.rotation.z = Math.sin(time * 2 + i) * 0.2;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + p * 4 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.transform}
        color={COLOR.transform}
        intensity={0}
        distance={10}
      />
      {/* Transformer layer planes */}
      {Array.from({ length: LAYER_COUNT }, (_, i) => (
        <mesh
          key={`layer-${i}`}
          ref={(el) => {
            layerRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.transform}
            emissive={COLOR.transform}
            emissiveIntensity={0.3}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Vectors passing through */}
      {Array.from({ length: VECTOR_COUNT }, (_, i) => (
        <mesh
          key={`vec-${i}`}
          ref={(el) => {
            vectorRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.accent}
            emissive={COLOR.accent}
            emissiveIntensity={2}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
      <Text
        position={[POS.transform[0], POS.transform[1] - 2, 0]}
        fontSize={0.26}
        color={COLOR.transform}
        anchorX="center"
        anchorY="middle"
      >
        Transformer Layers
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 5: Prediction — probability bar chart
   ──────────────────────────────────────────── */

const BAR_COUNT = 12;

function PredictionStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const barRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  const barData = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        // Create a probability-like distribution with one peak
        const peak = 4;
        const dist = Math.abs(i - peak);
        const height = Math.max(0.15, 1.8 * Math.exp(-dist * 0.5));
        return { height, x: (i - BAR_COUNT / 2) * 0.35 };
      }),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.PREDICT);
    const time = clock.elapsedTime;

    for (let i = 0; i < BAR_COUNT; i++) {
      const mesh = barRefs.current[i];
      if (!mesh) continue;
      const bd = barData[i];

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const delay = i * 0.04;
      const ip = easeOut(clamp01((p - delay) / (0.7 - delay)));

      const h = bd.height * ip;
      mesh.position.set(
        POS.predict[0] + bd.x,
        POS.predict[1] - 0.8 + h / 2,
        0
      );
      mesh.scale.set(0.25, h, 0.15);

      // Highlight peak bar
      const isPeak = i === 4;
      if (isPeak && p > 0.6) {
        const pulse = Math.sin(time * 6) * 0.1;
        mesh.scale.y = h + pulse;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0.3 ? easeOut((p - 0.3) / 0.7) * 4 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={[POS.predict[0], POS.predict[1] + 1, 1]}
        color={COLOR.predict}
        intensity={0}
        distance={6}
      />
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={i === 4 ? COLOR.accent : COLOR.predict}
            emissive={i === 4 ? COLOR.accent : COLOR.predict}
            emissiveIntensity={i === 4 ? 2 : 0.8}
            toneMapped={false}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
      <Text
        position={[POS.predict[0], POS.predict[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.predict}
        anchorX="center"
        anchorY="middle"
      >
        Prediction
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 6: Output — text emerges as glowing result
   ──────────────────────────────────────────── */

function OutputStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.OUTPUT);
    const time = clock.elapsedTime;

    if (orbRef.current) {
      if (p <= 0) {
        orbRef.current.visible = false;
      } else {
        orbRef.current.visible = true;
        const ip = easeOut(p);
        orbRef.current.position.set(
          lerp(POS.predict[0], POS.output[0], ip),
          POS.output[1] + Math.sin(ip * Math.PI) * 1.5,
          Math.sin(ip * Math.PI) * 0.5
        );
        orbRef.current.scale.setScalar(0.3 + ip * 0.4);
      }
    }

    if (ringRef.current) {
      if (p <= 0.3) {
        ringRef.current.visible = false;
      } else {
        ringRef.current.visible = true;
        const rp = easeOut((p - 0.3) / 0.7);
        ringRef.current.position.set(POS.output[0], POS.output[1], 0);
        ringRef.current.scale.setScalar(rp * 1.2);
        ringRef.current.rotation.x = time * 0.5;
        ringRef.current.rotation.y = time * 0.3;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? easeOut(p) * 6 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.output}
        color={COLOR.output}
        intensity={0}
        distance={8}
      />
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
        <torusGeometry args={[1, 0.06, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={1.5}
          transparent
          opacity={0.6}
        />
      </mesh>
      <Text
        position={[POS.output[0], POS.output[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.output}
        anchorX="center"
        anchorY="middle"
      >
        Output
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   LLM Core — distorted icosahedron (center piece)
   ──────────────────────────────────────────── */

function LLMCore({ elapsedRef }: { elapsedRef: ElRef }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<
    THREE.MeshStandardMaterial & { distort?: number; speed?: number }
  >(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const transformP = phaseT(t, PHASE.TRANSFORM);
    const activity = transformP;

    if (outerRef.current) {
      outerRef.current.rotation.y = time * (0.15 + activity * 0.5);
      outerRef.current.rotation.x = Math.sin(time * 0.3) * 0.12;
      outerRef.current.scale.setScalar(1 + activity * 0.15);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.4;
      innerRef.current.rotation.z = time * 0.3;
    }
    if (matRef.current) {
      if (matRef.current.distort !== undefined)
        matRef.current.distort = 0.1 + activity * 0.35;
      matRef.current.emissiveIntensity = 0.2 + activity * 1.0;
    }
  });

  return (
    <group position={POS.transform}>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.0, 4]} />
        <MeshDistortMaterial
          ref={matRef as never}
          color={COLOR.transform}
          emissive={COLOR.transform}
          emissiveIntensity={0.2}
          distort={0.1}
          speed={2}
          transparent
          opacity={0.5}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshStandardMaterial
          color={COLOR.transform}
          emissive={COLOR.transform}
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function LlmScene({
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
    if (t >= PHASE.INPUT[0]) step = 0;
    if (t >= PHASE.TOKENIZE[0]) step = 1;
    if (t >= PHASE.EMBED[0]) step = 2;
    if (t >= PHASE.TRANSFORM[0]) step = 3;
    if (t >= PHASE.PREDICT[0]) step = 4;
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
      <TextInput elapsedRef={elapsedRef} />
      <TokenizationStage elapsedRef={elapsedRef} />
      <EmbeddingStage elapsedRef={elapsedRef} />
      <TransformerLayers elapsedRef={elapsedRef} />
      <LLMCore elapsedRef={elapsedRef} />
      <PredictionStage elapsedRef={elapsedRef} />
      <OutputStage elapsedRef={elapsedRef} />
    </>
  );
}
