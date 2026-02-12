"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";
import {
  lerp,
  easeInOut,
  easeOut,
  clamp01,
  phaseT,
  type V3,
  type ElRef,
  type SceneProps,
} from "../shared/sceneUtils";

/* ────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────── */

const TOKEN_COUNT = 5;
// Pentagon arrangement offsets (for attention phase)
const PENTAGON = Array.from({ length: TOKEN_COUNT }, (_, i) => {
  const angle = (i / TOKEN_COUNT) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * 2.2, y: Math.sin(angle) * 2.2 };
});

// All pairs of token indices for attention beams (10 connections)
const BEAM_PAIRS: [number, number][] = [];
for (let i = 0; i < TOKEN_COUNT; i++)
  for (let j = i + 1; j < TOKEN_COUNT; j++) BEAM_PAIRS.push([i, j]);

/* ────────────────────────────────────────────
   Ambient floating particles (background)
   ──────────────────────────────────────────── */

function AmbientParticles() {
  const count = 180;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const speed = 0.04 + Math.random() * 0.12;
        const phase = Math.random() * Math.PI * 2;
        return {
          x: (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 24,
          z: (Math.random() - 0.5) * 18 - 6,
          speed,
          speedY: speed * 0.7,
          phase,
          phaseY: phase + 1,
          scale: 0.015 + Math.random() * 0.025,
        };
      }),
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
        p.y + Math.sin(time * p.speedY + p.phaseY) * 0.4,
        p.z
      );
      dummy.scale.setScalar(
        p.scale + Math.sin(time * 1.5 + p.phase) * 0.005
      );
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
   Connection lines (faint guides between stages)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.tokens, POS.posEnc, POS.attention, POS.ffn, POS.output];
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
   Token cubes — 5 cubes that travel through pipeline
   ──────────────────────────────────────────── */

function TokenCube({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const delay = index * 0.12;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    // Phase 1: Tokens appear at left with staggered drop-in
    const tokP = phaseT(t, PHASE.TOKENS);
    // Phase 2: Positional encoding — fly to posEnc, get golden ring
    const posP = phaseT(t, PHASE.POS_ENC);
    // Phase 3: Self-Attention — arrange in pentagon
    const attP = phaseT(t, PHASE.ATTENTION);
    // Phase 4: Feed Forward — fly into FFN prism
    const ffnP = phaseT(t, PHASE.FFN);
    // Phase 5: Output — emerge and arrange at output
    const outP = phaseT(t, PHASE.OUTPUT);

    let x: number, y: number, z: number;
    let scaleVal = 0.001;
    let ringVisible = false;
    let colorStr = COLOR.tokens;

    if (tokP > 0 && posP <= 0) {
      // Appear staggered at token position
      const ip = easeOut(clamp01((tokP - delay) / (1 - delay * TOKEN_COUNT)));
      x = POS.tokens[0] + index * 0.8;
      y = POS.tokens[1] + (1 - ip) * 2;
      z = 0;
      scaleVal = ip * 0.35;
    } else if (posP > 0 && attP <= 0) {
      // Fly to posEnc, gain golden ring
      const ip = easeInOut(clamp01((posP - delay * 0.5) / (1 - delay * 2)));
      const fromX = POS.tokens[0] + index * 0.8;
      const toX = POS.posEnc[0] + (index - 2) * 0.9;
      x = lerp(fromX, toX, ip);
      y = lerp(POS.tokens[1], POS.posEnc[1], ip) + Math.sin(ip * Math.PI) * 1.5;
      z = 0;
      scaleVal = 0.35;
      ringVisible = ip > 0.5;
      if (ip > 0.6) colorStr = COLOR.posEnc;
    } else if (attP > 0 && ffnP <= 0) {
      // Pentagon arrangement for self-attention
      const ip = easeInOut(clamp01((attP - delay * 0.3) / 0.35));
      const fromX = POS.posEnc[0] + (index - 2) * 0.9;
      const toX = POS.attention[0] + PENTAGON[index].x;
      const toY = POS.attention[1] + PENTAGON[index].y;
      x = lerp(fromX, toX, ip);
      y = lerp(POS.posEnc[1], toY, ip);
      z = 0;
      scaleVal = 0.35;
      ringVisible = true;
      colorStr = attP > 0.3 ? COLOR.attention : COLOR.posEnc;
    } else if (ffnP > 0 && outP <= 0) {
      // Fly into FFN prism
      const ip = easeInOut(clamp01((ffnP - delay * 0.3) / 0.5));
      const fromX = POS.attention[0] + PENTAGON[index].x;
      const fromY = POS.attention[1] + PENTAGON[index].y;
      x = lerp(fromX, POS.ffn[0], ip);
      y = lerp(fromY, POS.ffn[1] + (index - 2) * 0.5, ip);
      z = 0;
      // Shrink as they enter the prism
      scaleVal = 0.35 * (1 - clamp01((ip - 0.7) / 0.3) * 0.8);
      ringVisible = ip < 0.6;
      colorStr = ip > 0.5 ? COLOR.ffn : COLOR.attention;
    } else if (outP > 0) {
      // Emerge from FFN and fly to output
      const ip = easeOut(clamp01((outP - delay * 0.3) / 0.6));
      x = lerp(POS.ffn[0] + 1, POS.output[0] + (index - 2) * 0.8, ip);
      y = lerp(POS.ffn[1] + (index - 2) * 0.3, POS.output[1], ip) + Math.sin(ip * Math.PI) * 1;
      z = 0;
      scaleVal = lerp(0.1, 0.4, ip);
      ringVisible = false;
      colorStr = lerp(0, 1, ip) > 0.5 ? COLOR.output : COLOR.ffn;
    } else {
      x = POS.tokens[0] + index * 0.8;
      y = POS.tokens[1] + 3;
      z = 0;
    }

    meshRef.current.position.set(x, y, z);
    meshRef.current.scale.setScalar(scaleVal);
    meshRef.current.rotation.y = time * 0.5 + index;
    meshRef.current.rotation.x = Math.sin(time * 0.3 + index) * 0.2;
    meshRef.current.visible = scaleVal > 0.01;

    // Update material color
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.color.set(colorStr);
    mat.emissive.set(colorStr);

    // Position ring
    if (ringRef.current) {
      ringRef.current.visible = ringVisible;
      if (ringVisible) {
        ringRef.current.position.set(x, y, z);
        ringRef.current.rotation.x = Math.PI / 2 + Math.sin(time + index) * 0.3;
        ringRef.current.rotation.y = time * 0.8 + index * 1.2;
        const ringScale = scaleVal * 2.2;
        ringRef.current.scale.setScalar(ringScale);
      }
    }
  });

  return (
    <>
      <mesh ref={meshRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.tokens}
          emissive={COLOR.tokens}
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[1, 0.06, 8, 24]} />
        <meshStandardMaterial
          color={COLOR.posEnc}
          emissive={COLOR.posEnc}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

/* ────────────────────────────────────────────
   Attention beams — glowing lines between tokens
   ──────────────────────────────────────────── */

function AttentionBeams({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRefs = useRef<(THREE.Line | null)[]>([]);

  // Pre-compute attention weights (some pairs are "high attention")
  const weights = useMemo(() =>
    BEAM_PAIRS.map((_, i) => 0.15 + (i % 3 === 0 ? 0.85 : i % 2 === 0 ? 0.5 : 0.2)),
    []
  );

  // Create line objects
  const lines = useMemo(() => {
    return BEAM_PAIRS.map(() => {
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(6);
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: COLOR.attention,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      return new THREE.Line(geom, mat);
    });
  }, []);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const attP = phaseT(t, PHASE.ATTENTION);

    for (let i = 0; i < BEAM_PAIRS.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (attP <= 0.15 || attP >= 0.95) {
        (line.material as THREE.LineBasicMaterial).opacity = 0;
        continue;
      }

      const [a, b] = BEAM_PAIRS[i];
      const posArr = (line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;

      // Positions from pentagon
      posArr[0] = POS.attention[0] + PENTAGON[a].x;
      posArr[1] = POS.attention[1] + PENTAGON[a].y;
      posArr[2] = 0;
      posArr[3] = POS.attention[0] + PENTAGON[b].x;
      posArr[4] = POS.attention[1] + PENTAGON[b].y;
      posArr[5] = 0;
      line.geometry.attributes.position.needsUpdate = true;

      // Pulsing opacity based on attention weight and time
      const wave = Math.sin(time * 3 + i * 0.8) * 0.3 + 0.7;
      const fadeIn = easeOut(clamp01((attP - 0.15) / 0.25));
      const fadeOut = 1 - easeOut(clamp01((attP - 0.8) / 0.15));
      const w = weights[i];
      (line.material as THREE.LineBasicMaterial).opacity =
        w * wave * fadeIn * fadeOut * 0.9;
      (line.material as THREE.LineBasicMaterial).color.set(
        w > 0.7 ? "#ff6eb4" : COLOR.attention
      );
    }
  });

  return (
    <group ref={groupRef}>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Attention glow particles — sparks at intersections
   ──────────────────────────────────────────── */

function AttentionSparks({ elapsedRef }: { elapsedRef: ElRef }) {
  const count = 20;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2,
        radius: 0.5 + Math.random() * 2,
        speed: 1 + Math.random() * 2,
        yOff: (Math.random() - 0.5) * 2,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const attP = phaseT(t, PHASE.ATTENTION);

    for (let i = 0; i < count; i++) {
      if (attP <= 0.2 || attP >= 0.9) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
      } else {
        const d = data[i];
        const fade = Math.sin((attP - 0.2) / 0.7 * Math.PI);
        dummy.position.set(
          POS.attention[0] + Math.cos(time * d.speed + d.angle) * d.radius,
          POS.attention[1] + Math.sin(time * d.speed * 0.7 + d.angle) * d.radius + d.yOff,
          Math.sin(time * d.speed * 0.5 + i) * 0.5
        );
        dummy.scale.setScalar(0.04 + fade * 0.06);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={COLOR.attention}
        emissive={COLOR.attention}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Feed Forward Network — rectangular prism with glow wave
   ──────────────────────────────────────────── */

function FFNPrism({ elapsedRef }: { elapsedRef: ElRef }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const ffnP = phaseT(t, PHASE.FFN);

    if (outerRef.current) {
      outerRef.current.rotation.y = time * 0.15;
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = ffnP > 0 ? 0.2 + easeOut(clamp01(ffnP / 0.5)) * 0.8 : 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.3;
      // Glow wave: y position oscillates during processing
      if (ffnP > 0.2 && ffnP < 0.8) {
        const wave = Math.sin((ffnP - 0.2) / 0.6 * Math.PI * 3);
        innerRef.current.position.y = POS.ffn[1] + wave * 1.2;
      } else {
        innerRef.current.position.y = POS.ffn[1];
      }
    }
    if (lightRef.current) {
      lightRef.current.intensity = ffnP > 0 ? 2 + ffnP * 4 : 0.5;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.ffn}
        color={COLOR.ffn}
        intensity={0.5}
        distance={8}
      />
      <mesh ref={outerRef} position={POS.ffn}>
        <boxGeometry args={[2, 3.5, 1.5]} />
        <meshStandardMaterial
          color={COLOR.ffn}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          emissive={COLOR.ffn}
          emissiveIntensity={0.1}
        />
      </mesh>
      <mesh ref={innerRef} position={POS.ffn}>
        <boxGeometry args={[1.6, 0.3, 1.2]} />
        <meshStandardMaterial
          color={COLOR.ffn}
          emissive={COLOR.ffn}
          emissiveIntensity={1}
          toneMapped={false}
          transparent
          opacity={0.6}
        />
      </mesh>
      <Text
        position={[POS.ffn[0], POS.ffn[1] - 2.4, POS.ffn[2]]}
        fontSize={0.26}
        color={COLOR.ffn}
        anchorX="center"
        anchorY="middle"
      >
        Feed Forward
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage labels
   ──────────────────────────────────────────── */

function StageLabels({ elapsedRef }: { elapsedRef: ElRef }) {
  const tokRef = useRef<THREE.Group>(null);
  const posRef = useRef<THREE.Group>(null);
  const attRef = useRef<THREE.Group>(null);
  const outRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = elapsedRef.current;
    if (tokRef.current) tokRef.current.visible = phaseT(t, PHASE.TOKENS) > 0.1;
    if (posRef.current) posRef.current.visible = phaseT(t, PHASE.POS_ENC) > 0.1;
    if (attRef.current) attRef.current.visible = phaseT(t, PHASE.ATTENTION) > 0.1;
    if (outRef.current) outRef.current.visible = phaseT(t, PHASE.OUTPUT) > 0.1;
  });

  return (
    <>
      <group ref={tokRef} visible={false}>
        <Text
          position={[POS.tokens[0] + 1.5, POS.tokens[1] - 1.6, 0]}
          fontSize={0.26}
          color={COLOR.tokens}
          anchorX="center"
          anchorY="middle"
        >
          Tokens
        </Text>
      </group>
      <group ref={posRef} visible={false}>
        <Text
          position={[POS.posEnc[0], POS.posEnc[1] - 1.6, 0]}
          fontSize={0.26}
          color={COLOR.posEnc}
          anchorX="center"
          anchorY="middle"
        >
          Position Encoding
        </Text>
      </group>
      <group ref={attRef} visible={false}>
        <Text
          position={[POS.attention[0], POS.attention[1] - 3.2, 0]}
          fontSize={0.28}
          color={COLOR.attention}
          anchorX="center"
          anchorY="middle"
        >
          Self-Attention
        </Text>
      </group>
      <group ref={outRef} visible={false}>
        <Text
          position={[POS.output[0], POS.output[1] - 1.6, 0]}
          fontSize={0.26}
          color={COLOR.output}
          anchorX="center"
          anchorY="middle"
        >
          Output
        </Text>
      </group>
    </>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function TransformerScene({
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
    if (t >= PHASE.TOKENS[0]) step = 0;
    if (t >= PHASE.POS_ENC[0]) step = 1;
    if (t >= PHASE.ATTENTION[0]) step = 2;
    if (t >= PHASE.FFN[0]) step = 3;
    if (t >= PHASE.OUTPUT[0]) step = 4;

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
      <FFNPrism elapsedRef={elapsedRef} />
      <StageLabels elapsedRef={elapsedRef} />

      {/* Token cubes */}
      {Array.from({ length: TOKEN_COUNT }, (_, i) => (
        <TokenCube key={i} index={i} elapsedRef={elapsedRef} />
      ))}

      {/* Attention beams and sparks */}
      <AttentionBeams elapsedRef={elapsedRef} />
      <AttentionSparks elapsedRef={elapsedRef} />
    </>
  );
}
