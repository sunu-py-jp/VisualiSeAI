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
      <meshBasicMaterial color={COLOR.bg} transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Connection lines
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.tokenEmbed, POS.posEncode, POS.causalMask, POS.attention, POS.nextToken, POS.autoLoop];
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
   Stage 1: Token Embed — tokens enter as cubes
   ──────────────────────────────────────────── */

const TOKEN_EMB_COUNT = 6;

function TokenEmbedStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.TOKEN_EMBED);
    const time = clock.elapsedTime;

    for (let i = 0; i < TOKEN_EMB_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const delay = i * 0.12;
      const ip = easeOut(clamp01((p - delay) / (0.8 - delay)));

      // Fly in from below
      mesh.position.set(
        POS.tokenEmbed[0] + (i - TOKEN_EMB_COUNT / 2) * 0.7,
        POS.tokenEmbed[1] + lerp(-3, 0, ip) + Math.sin(time * 2 + i) * 0.08,
        Math.sin(ip * Math.PI) * 0.3
      );
      mesh.scale.setScalar(0.25 * ip);
      mesh.rotation.y = time * 0.5 + i;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 3 * Math.sin(p * Math.PI) : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.tokenEmbed}
        color={COLOR.token}
        intensity={0}
        distance={6}
      />
      {Array.from({ length: TOKEN_EMB_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
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
        position={[POS.tokenEmbed[0], POS.tokenEmbed[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.token}
        anchorX="center"
        anchorY="middle"
      >
        Token Embed
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 2: Position Encode — rings added around tokens
   ──────────────────────────────────────────── */

function PositionEncodeStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const cubeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.POS_ENCODE);
    const time = clock.elapsedTime;

    for (let i = 0; i < TOKEN_EMB_COUNT; i++) {
      const ring = ringRefs.current[i];
      const cube = cubeRefs.current[i];
      if (!ring || !cube) continue;

      if (p <= 0) {
        ring.visible = false;
        cube.visible = false;
        continue;
      }

      const delay = i * 0.1;
      const ip = easeInOut(clamp01((p - delay) / (0.7 - delay)));

      // Token cube flies from tokenEmbed to posEncode
      const startX = POS.tokenEmbed[0] + (i - TOKEN_EMB_COUNT / 2) * 0.7;
      const endX = POS.posEncode[0] + (i - TOKEN_EMB_COUNT / 2) * 0.7;

      cube.visible = true;
      cube.position.set(
        lerp(startX, endX, ip),
        POS.posEncode[1] + Math.sin(ip * Math.PI) * 1.2,
        Math.sin(ip * Math.PI * 2) * 0.2
      );
      cube.scale.setScalar(0.22);
      cube.rotation.y = time * 0.5 + i;

      // Ring appears and wraps around the cube
      const ringP = easeOut(clamp01((p - 0.3 - delay) / 0.5));
      ring.visible = ringP > 0;
      ring.position.copy(cube.position);
      ring.scale.setScalar(0.4 * ringP);
      ring.rotation.x = time * (1 + i * 0.2);
      ring.rotation.z = time * 0.5;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + p * 2 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.posEncode}
        color={COLOR.position}
        intensity={0}
        distance={6}
      />
      {Array.from({ length: TOKEN_EMB_COUNT }, (_, i) => (
        <group key={i}>
          <mesh
            ref={(el) => { cubeRefs.current[i] = el; }}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={COLOR.token}
              emissive={COLOR.token}
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
          <mesh
            ref={(el) => { ringRefs.current[i] = el; }}
            visible={false}
          >
            <torusGeometry args={[1, 0.08, 8, 24]} />
            <meshStandardMaterial
              color={COLOR.position}
              emissive={COLOR.position}
              emissiveIntensity={1.5}
              toneMapped={false}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>
      ))}
      <Text
        position={[POS.posEncode[0], POS.posEncode[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.position}
        anchorX="center"
        anchorY="middle"
      >
        Position Encode
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 3: Causal Mask — triangular mask appears
   ──────────────────────────────────────────── */

function CausalMaskStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const cellRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  // 6x6 grid, lower triangle visible (causal mask)
  const GRID = 6;
  const cellData = useMemo(() => {
    const cells: { row: number; col: number; visible: boolean }[] = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        cells.push({ row: r, col: c, visible: c <= r });
      }
    }
    return cells;
  }, []);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.CAUSAL_MASK);
    const time = clock.elapsedTime;

    for (let i = 0; i < cellData.length; i++) {
      const mesh = cellRefs.current[i];
      if (!mesh) continue;
      const cd = cellData[i];

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      // Cells appear row by row
      const rowDelay = cd.row * 0.12;
      const cellP = easeOut(clamp01((p - rowDelay) / 0.4));

      if (cellP <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const spacing = 0.38;
      mesh.position.set(
        POS.causalMask[0] + (cd.col - GRID / 2 + 0.5) * spacing,
        POS.causalMask[1] + (GRID / 2 - cd.row - 0.5) * spacing,
        0
      );
      mesh.scale.setScalar(0.16 * cellP);

      // Causal (lower triangle) = bright, upper triangle = dim
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (cd.visible) {
        mat.color.set(COLOR.mask);
        mat.emissive.set(COLOR.mask);
        mat.emissiveIntensity = 0.8 + Math.sin(time * 3 + i * 0.2) * 0.3;
        mat.opacity = 0.9;
      } else {
        mat.color.set("#1a1a2e");
        mat.emissive.set("#1a1a2e");
        mat.emissiveIntensity = 0.1;
        mat.opacity = 0.25;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 3 * Math.sin(p * Math.PI) : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.causalMask}
        color={COLOR.mask}
        intensity={0}
        distance={6}
      />
      {cellData.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { cellRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 0.3]} />
          <meshStandardMaterial
            color={COLOR.mask}
            emissive={COLOR.mask}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
      <Text
        position={[POS.causalMask[0], POS.causalMask[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.mask}
        anchorX="center"
        anchorY="middle"
      >
        Causal Mask
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 4: Attention + FFN — attention beams + processing core
   ──────────────────────────────────────────── */

const BEAM_COUNT = 8;

function AttentionFFNStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const beamRefs = useRef<(THREE.Mesh | null)[]>([]);
  const coreRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<
    THREE.MeshStandardMaterial & { distort?: number; speed?: number }
  >(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const beamData = useMemo(
    () =>
      Array.from({ length: BEAM_COUNT }, (_, i) => {
        const angle = (i / BEAM_COUNT) * Math.PI * 2;
        return {
          angle,
          radius: 1.8,
          delay: i * 0.06,
        };
      }),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.ATTENTION_FFN);
    const time = clock.elapsedTime;

    // Attention beams radiate from center
    for (let i = 0; i < BEAM_COUNT; i++) {
      const mesh = beamRefs.current[i];
      if (!mesh) continue;
      const bd = beamData[i];

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      const beamP = easeOut(clamp01((p - bd.delay) / 0.4));
      mesh.visible = beamP > 0;

      const rotAngle = bd.angle + time * 0.3;
      const r = bd.radius * beamP;
      mesh.position.set(
        POS.attention[0] + Math.cos(rotAngle) * r * 0.5,
        POS.attention[1] + Math.sin(rotAngle) * r * 0.5,
        Math.sin(time + i) * 0.2
      );
      mesh.scale.set(r * 0.8, 0.04, 0.04);
      mesh.rotation.z = rotAngle;

      // Pulse brightness
      const pulse = 0.5 + Math.sin(time * 4 + i * 0.8) * 0.5;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1 + pulse * 1.5;
    }

    // Processing core
    if (coreRef.current) {
      const coreP = easeOut(clamp01((p - 0.1) / 0.4));
      coreRef.current.visible = coreP > 0;
      coreRef.current.scale.setScalar(0.8 + coreP * 0.4 + Math.sin(time * 3) * 0.05 * p);
      coreRef.current.rotation.y = time * (0.3 + p * 0.8);
      coreRef.current.rotation.x = Math.sin(time * 0.4) * 0.15;
    }

    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.5;
      innerRef.current.rotation.z = time * 0.35;
      innerRef.current.visible = p > 0.1;
    }

    if (matRef.current) {
      if (matRef.current.distort !== undefined)
        matRef.current.distort = 0.1 + p * 0.4;
      matRef.current.emissiveIntensity = 0.2 + p * 1.3;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + p * 5 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.attention}
        color={COLOR.attention}
        intensity={0}
        distance={10}
      />
      {/* Attention beams */}
      {Array.from({ length: BEAM_COUNT }, (_, i) => (
        <mesh
          key={`beam-${i}`}
          ref={(el) => { beamRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.accent}
            emissive={COLOR.accent}
            emissiveIntensity={1.5}
            toneMapped={false}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
      {/* Core */}
      <mesh ref={coreRef} position={POS.attention} visible={false}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          ref={matRef as never}
          color={COLOR.attention}
          emissive={COLOR.attention}
          emissiveIntensity={0.2}
          distort={0.1}
          speed={2}
          transparent
          opacity={0.55}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      <mesh ref={innerRef} position={POS.attention} visible={false}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshStandardMaterial
          color={COLOR.attention}
          emissive={COLOR.attention}
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      <Text
        position={[POS.attention[0], POS.attention[1] - 2, 0]}
        fontSize={0.26}
        color={COLOR.attention}
        anchorX="center"
        anchorY="middle"
      >
        Attention + FFN
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 5: Next Token — predicted token emerges
   ──────────────────────────────────────────── */

function NextTokenStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const tokenRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Probability bars
  const barRefs = useRef<(THREE.Mesh | null)[]>([]);
  const BAR_COUNT = 8;

  const barData = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        const peak = 3;
        const dist = Math.abs(i - peak);
        return { height: Math.max(0.2, 1.5 * Math.exp(-dist * 0.6)), x: (i - BAR_COUNT / 2) * 0.3 };
      }),
    []
  );

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.NEXT_TOKEN);
    const time = clock.elapsedTime;

    // Probability bars appear first
    for (let i = 0; i < BAR_COUNT; i++) {
      const mesh = barRefs.current[i];
      if (!mesh) continue;
      const bd = barData[i];

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      const barP = easeOut(clamp01((p - i * 0.03) / 0.4));
      mesh.visible = barP > 0;

      const h = bd.height * barP;
      mesh.position.set(
        POS.nextToken[0] + bd.x,
        POS.nextToken[1] - 0.6 + h / 2,
        0
      );
      mesh.scale.set(0.2, h, 0.1);
    }

    // Winning token rises from the peak bar
    if (tokenRef.current) {
      const tokenP = easeOut(clamp01((p - 0.4) / 0.5));
      if (tokenP <= 0) {
        tokenRef.current.visible = false;
      } else {
        tokenRef.current.visible = true;
        tokenRef.current.position.set(
          POS.nextToken[0] + barData[3].x,
          POS.nextToken[1] + 0.5 + tokenP * 1.2,
          0
        );
        tokenRef.current.scale.setScalar(0.3 * tokenP);
        tokenRef.current.rotation.y = time * 2;
      }
    }

    if (glowRef.current) {
      const glowP = easeOut(clamp01((p - 0.5) / 0.4));
      glowRef.current.visible = glowP > 0;
      if (glowP > 0 && tokenRef.current) {
        glowRef.current.position.copy(tokenRef.current.position);
        glowRef.current.scale.setScalar(0.5 + glowP * 0.3 + Math.sin(time * 5) * 0.05);
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0.3 ? easeOut((p - 0.3) / 0.7) * 5 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={[POS.nextToken[0], POS.nextToken[1] + 1, 1]}
        color={COLOR.predict}
        intensity={0}
        distance={6}
      />
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { barRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={i === 3 ? COLOR.predict : COLOR.attention}
            emissive={i === 3 ? COLOR.predict : COLOR.attention}
            emissiveIntensity={i === 3 ? 1.5 : 0.5}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
      <mesh ref={tokenRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.predict}
          emissive={COLOR.predict}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={COLOR.predict}
          emissive={COLOR.predict}
          emissiveIntensity={1}
          transparent
          opacity={0.2}
        />
      </mesh>
      <Text
        position={[POS.nextToken[0], POS.nextToken[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.predict}
        anchorX="center"
        anchorY="middle"
      >
        Next Token
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 6: Autoregressive Loop — token feeds back
   ──────────────────────────────────────────── */

function AutoregressiveLoop({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const arrowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const TRAIL = 10;

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.AUTO_LOOP);
    const time = clock.elapsedTime;

    if (orbRef.current) {
      if (p <= 0) {
        orbRef.current.visible = false;
      } else {
        orbRef.current.visible = true;
        const ip = easeInOut(p);

        // Arc from nextToken back toward tokenEmbed (loop)
        const startX = POS.nextToken[0];
        const endX = POS.autoLoop[0];
        orbRef.current.position.set(
          lerp(startX, endX, ip),
          POS.autoLoop[1] + Math.sin(ip * Math.PI) * 3,
          Math.sin(ip * Math.PI * 2) * 1.5
        );
        orbRef.current.scale.setScalar(0.3 + Math.sin(time * 8) * 0.04);
      }
    }

    // Trail particles following the orb
    for (let i = 0; i < TRAIL; i++) {
      const mesh = trailRefs.current[i];
      if (!mesh) continue;

      const trailP = clamp01(p - i * 0.03);
      if (trailP <= 0 || p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const tip = easeInOut(trailP);
      const startX = POS.nextToken[0];
      const endX = POS.autoLoop[0];
      mesh.position.set(
        lerp(startX, endX, tip),
        POS.autoLoop[1] + Math.sin(tip * Math.PI) * 3,
        Math.sin(tip * Math.PI * 2) * 1.5
      );
      mesh.scale.setScalar(0.12 * (1 - i / TRAIL));
    }

    // Loop arrow indicator
    if (arrowRef.current) {
      const arrowP = easeOut(clamp01((p - 0.5) / 0.4));
      arrowRef.current.visible = arrowP > 0;
      arrowRef.current.position.set(POS.autoLoop[0], POS.autoLoop[1] + 2, 0);
      arrowRef.current.scale.setScalar(0.5 * arrowP);
      arrowRef.current.rotation.z = time * 1.5;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? easeOut(p) * 5 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.autoLoop}
        color={COLOR.loop}
        intensity={0}
        distance={8}
      />
      <mesh ref={orbRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.loop}
          emissive={COLOR.loop}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      {Array.from({ length: TRAIL }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { trailRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={COLOR.loop}
            emissive={COLOR.loop}
            emissiveIntensity={1}
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Loop arrow — torus to represent the cycle */}
      <mesh ref={arrowRef} visible={false}>
        <torusGeometry args={[0.6, 0.08, 8, 24, Math.PI * 1.5]} />
        <meshStandardMaterial
          color={COLOR.loop}
          emissive={COLOR.loop}
          emissiveIntensity={1.5}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </mesh>
      <Text
        position={[POS.autoLoop[0], POS.autoLoop[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.loop}
        anchorX="center"
        anchorY="middle"
      >
        Autoregressive Loop
      </Text>
    </group>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function GptScene({
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
    if (t >= PHASE.TOKEN_EMBED[0]) step = 0;
    if (t >= PHASE.POS_ENCODE[0]) step = 1;
    if (t >= PHASE.CAUSAL_MASK[0]) step = 2;
    if (t >= PHASE.ATTENTION_FFN[0]) step = 3;
    if (t >= PHASE.NEXT_TOKEN[0]) step = 4;
    if (t >= PHASE.AUTO_LOOP[0]) step = 5;

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
      <TokenEmbedStage elapsedRef={elapsedRef} />
      <PositionEncodeStage elapsedRef={elapsedRef} />
      <CausalMaskStage elapsedRef={elapsedRef} />
      <AttentionFFNStage elapsedRef={elapsedRef} />
      <NextTokenStage elapsedRef={elapsedRef} />
      <AutoregressiveLoop elapsedRef={elapsedRef} />
    </>
  );
}
