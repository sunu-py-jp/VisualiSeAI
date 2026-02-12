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
  type ElRef,
  type SceneProps,
} from "../shared/sceneUtils";

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
      <meshBasicMaterial color={COLOR.bg} transparent opacity={0.3} depthWrite={false} />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Connection lines
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const stages = [POS.rawText, POS.charSplit, POS.bpe, POS.merge, POS.tokenIds, POS.vocab];
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
   Stage 1: Raw Text — a text string appears
   ──────────────────────────────────────────── */

const RAW_TEXT = "Hello world";

function RawTextStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const blockRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.RAW_TEXT);
    const time = clock.elapsedTime;

    if (blockRef.current) {
      if (p <= 0) {
        blockRef.current.visible = false;
      } else {
        blockRef.current.visible = true;
        const ip = easeOut(p);
        blockRef.current.position.set(
          POS.rawText[0],
          POS.rawText[1] + Math.sin(time * 1.5) * 0.1,
          0
        );
        blockRef.current.scale.set(3 * ip, 0.6 * ip, 0.15);
        blockRef.current.rotation.y = Math.sin(time * 0.5) * 0.05;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 * easeOut(p) : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.rawText}
        color={COLOR.text}
        intensity={0}
        distance={6}
      />
      <mesh ref={blockRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.text}
          emissive={COLOR.text}
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
        />
      </mesh>
      <Text
        position={[POS.rawText[0], POS.rawText[1], 0.2]}
        fontSize={0.3}
        color={COLOR.accent}
        anchorX="center"
        anchorY="middle"
      >
        {RAW_TEXT}
      </Text>
      <Text
        position={[POS.rawText[0], POS.rawText[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.text}
        anchorX="center"
        anchorY="middle"
      >
        Raw Text
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 2: Character Split — text breaks into character cubes
   ──────────────────────────────────────────── */

const CHARS = "Hello world".split("");
const CHAR_COUNT = CHARS.length;

function CharSplitStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.CHAR_SPLIT);
    const time = clock.elapsedTime;

    for (let i = 0; i < CHAR_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const delay = i * 0.06;
      const ip = easeInOut(clamp01((p - delay) / (0.7 - delay)));

      // Characters fly from raw text position to split positions
      const startX = POS.rawText[0] + (i - CHAR_COUNT / 2) * 0.25;
      const endX = POS.charSplit[0] + (i - CHAR_COUNT / 2) * 0.5;

      mesh.position.set(
        lerp(startX, endX, ip),
        POS.charSplit[1] + Math.sin(ip * Math.PI) * 1.0 + Math.sin(time * 2 + i) * 0.08,
        Math.sin(ip * Math.PI * 2) * 0.2
      );
      mesh.scale.setScalar(0.18 + ip * 0.05);
      mesh.rotation.z = Math.sin(time * 1.5 + i * 0.3) * 0.1;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.charSplit}
        color={COLOR.char}
        intensity={0}
        distance={6}
      />
      {CHARS.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.char}
            emissive={COLOR.char}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Text
        position={[POS.charSplit[0], POS.charSplit[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.char}
        anchorX="center"
        anchorY="middle"
      >
        Character Split
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 3: Byte Pair Encoding — pairs highlight & merge
   ──────────────────────────────────────────── */

// BPE merges: pairs of adjacent characters merge into tokens
// "H" "e" "l" "l" "o" " " "w" "o" "r" "l" "d" -> merging pairs
const BPE_PAIRS = [
  { left: 0, right: 1 },  // H + e -> He
  { left: 2, right: 3 },  // l + l -> ll
  { left: 6, right: 7 },  // w + o -> wo
  { left: 9, right: 10 }, // l + d -> ld
];
const BPE_RESULT_COUNT = 7; // He, ll, o, ' ', wo, r, ld

function BPEStage({ elapsedRef }: { elapsedRef: ElRef }) {
  // Source character cubes
  const srcRefs = useRef<(THREE.Mesh | null)[]>([]);
  // Merged result cubes
  const mergedRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  // Highlight beams connecting merging pairs
  const beamRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.BPE);
    const time = clock.elapsedTime;

    // Source chars stay in position, then pairs highlight
    for (let i = 0; i < CHAR_COUNT; i++) {
      const mesh = srcRefs.current[i];
      if (!mesh) continue;

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      // Check if this char is part of a merging pair
      const pairIdx = BPE_PAIRS.findIndex(
        (bp) => bp.left === i || bp.right === i
      );
      const isMerging = pairIdx >= 0;

      // Chars start at charSplit positions
      const baseX = POS.charSplit[0] + (i - CHAR_COUNT / 2) * 0.5;

      if (p < 0.4) {
        // Fly from charSplit to bpe staging area
        const flyP = easeInOut(p / 0.4);
        const targetX = POS.bpe[0] + (i - CHAR_COUNT / 2) * 0.45;
        mesh.visible = true;
        mesh.position.set(
          lerp(baseX, targetX, flyP),
          POS.bpe[1] + Math.sin(flyP * Math.PI) * 0.8,
          0
        );
        mesh.scale.setScalar(0.18);
      } else if (isMerging) {
        // Merging pairs glow and slide together
        const mergeP = easeInOut(clamp01((p - 0.4 - pairIdx * 0.08) / 0.35));
        const pair = BPE_PAIRS[pairIdx];
        const isLeft = pair.left === i;
        const targetX = POS.bpe[0] + ((pair.left + pair.right) / 2 - CHAR_COUNT / 2) * 0.45;
        const currentX = POS.bpe[0] + (i - CHAR_COUNT / 2) * 0.45;

        mesh.visible = mergeP < 0.95;
        mesh.position.set(
          lerp(currentX, targetX, mergeP),
          POS.bpe[1],
          0
        );
        mesh.scale.setScalar(0.18 * (1 - mergeP * 0.3));

        // Glow when merging
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.8 + mergeP * 2;
      } else {
        mesh.visible = true;
        mesh.position.set(
          POS.bpe[0] + (i - CHAR_COUNT / 2) * 0.45,
          POS.bpe[1] + Math.sin(time * 2 + i) * 0.05,
          0
        );
        mesh.scale.setScalar(0.18);
      }
    }

    // Highlight beams between merging pairs
    for (let i = 0; i < BPE_PAIRS.length; i++) {
      const mesh = beamRefs.current[i];
      if (!mesh) continue;

      const beamP = clamp01((p - 0.3 - i * 0.1) / 0.2);
      if (beamP <= 0 || p < 0.3) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const pair = BPE_PAIRS[i];
      const lx = POS.bpe[0] + (pair.left - CHAR_COUNT / 2) * 0.45;
      const rx = POS.bpe[0] + (pair.right - CHAR_COUNT / 2) * 0.45;
      mesh.position.set((lx + rx) / 2, POS.bpe[1], 0.1);
      mesh.scale.set(Math.abs(rx - lx), 0.06, 0.02);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(time * 6 + i) * 0.5;
      mat.opacity = beamP * 0.8;
    }

    // Merged tokens appear after merge completes
    for (let i = 0; i < BPE_RESULT_COUNT; i++) {
      const mesh = mergedRefs.current[i];
      if (!mesh) continue;

      const mergeAppear = easeOut(clamp01((p - 0.65 - i * 0.03) / 0.25));
      if (mergeAppear <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      mesh.position.set(
        POS.bpe[0] + (i - BPE_RESULT_COUNT / 2) * 0.6,
        POS.bpe[1] - 0.8,
        0
      );
      mesh.scale.setScalar(0.22 * mergeAppear);
      mesh.rotation.y = Math.sin(time * 1.5 + i * 0.5) * 0.1;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + p * 3 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.bpe}
        color={COLOR.accent}
        intensity={0}
        distance={8}
      />
      {/* Source character cubes */}
      {CHARS.map((_, i) => (
        <mesh
          key={`src-${i}`}
          ref={(el) => { srcRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={COLOR.bpe}
            emissive={COLOR.bpe}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Highlight beams */}
      {BPE_PAIRS.map((_, i) => (
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
            opacity={0.8}
          />
        </mesh>
      ))}
      {/* Merged result tokens */}
      {Array.from({ length: BPE_RESULT_COUNT }, (_, i) => (
        <mesh
          key={`merged-${i}`}
          ref={(el) => { mergedRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 0.5]} />
          <meshStandardMaterial
            color={COLOR.accent}
            emissive={COLOR.accent}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Text
        position={[POS.bpe[0], POS.bpe[1] - 2, 0]}
        fontSize={0.26}
        color={COLOR.bpe}
        anchorX="center"
        anchorY="middle"
      >
        Byte Pair Encoding
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 4: Merge Rules — rules visualized as connections
   ──────────────────────────────────────────── */

const RULE_COUNT = 6;

function MergeRulesStage({ elapsedRef }: { elapsedRef: ElRef }) {
  // Left items (source pairs), right items (merged result), connecting lines
  const leftRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rightRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lineRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.MERGE);
    const time = clock.elapsedTime;

    for (let i = 0; i < RULE_COUNT; i++) {
      const left = leftRefs.current[i];
      const right = rightRefs.current[i];
      const line = lineRefs.current[i];

      const delay = i * 0.1;
      const ip = easeOut(clamp01((p - delay) / (0.6 - delay)));

      // Left pair
      if (left) {
        if (ip <= 0) {
          left.visible = false;
        } else {
          left.visible = true;
          left.position.set(
            POS.merge[0] - 1.2,
            POS.merge[1] + (i - RULE_COUNT / 2) * 0.55,
            0
          );
          left.scale.set(0.35 * ip, 0.2 * ip, 0.15);
          left.rotation.z = Math.sin(time * 1.5 + i) * 0.05;
        }
      }

      // Arrow/line
      if (line) {
        const lineP = easeOut(clamp01((p - delay - 0.15) / 0.3));
        if (lineP <= 0) {
          line.visible = false;
        } else {
          line.visible = true;
          line.position.set(
            POS.merge[0],
            POS.merge[1] + (i - RULE_COUNT / 2) * 0.55,
            0
          );
          line.scale.set(1.5 * lineP, 0.03, 0.02);

          const mat = line.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.5 + Math.sin(time * 4 + i) * 0.3;
        }
      }

      // Right merged result
      if (right) {
        const rightP = easeOut(clamp01((p - delay - 0.25) / 0.4));
        if (rightP <= 0) {
          right.visible = false;
        } else {
          right.visible = true;
          right.position.set(
            POS.merge[0] + 1.2,
            POS.merge[1] + (i - RULE_COUNT / 2) * 0.55,
            0
          );
          right.scale.set(0.3 * rightP, 0.2 * rightP, 0.15);

          // Glow on completion
          const mat = right.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.6 + rightP * 1.0;
        }
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? 2 + p * 2 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.merge}
        color={COLOR.merge}
        intensity={0}
        distance={7}
      />
      {Array.from({ length: RULE_COUNT }, (_, i) => (
        <group key={i}>
          {/* Left: source pair */}
          <mesh
            ref={(el) => { leftRefs.current[i] = el; }}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={COLOR.merge}
              emissive={COLOR.merge}
              emissiveIntensity={0.6}
              toneMapped={false}
            />
          </mesh>
          {/* Arrow line */}
          <mesh
            ref={(el) => { lineRefs.current[i] = el; }}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={COLOR.accent}
              emissive={COLOR.accent}
              emissiveIntensity={0.8}
              toneMapped={false}
              transparent
              opacity={0.7}
            />
          </mesh>
          {/* Right: merged result */}
          <mesh
            ref={(el) => { rightRefs.current[i] = el; }}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={COLOR.accent}
              emissive={COLOR.accent}
              emissiveIntensity={0.6}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <Text
        position={[POS.merge[0], POS.merge[1] - 2.2, 0]}
        fontSize={0.26}
        color={COLOR.merge}
        anchorX="center"
        anchorY="middle"
      >
        Merge Rules
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 5: Token IDs — numbered blocks appear
   ──────────────────────────────────────────── */

const ID_COUNT = 7;
const TOKEN_IDS_DATA = [1024, 432, 87, 12, 2048, 156, 891];

function TokenIDsStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.TOKEN_IDS);
    const time = clock.elapsedTime;

    for (let i = 0; i < ID_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      const delay = i * 0.08;
      const ip = easeOut(clamp01((p - delay) / (0.6 - delay)));

      mesh.visible = ip > 0;

      // Fly from merge area and arrange in a row
      const startX = POS.merge[0] + 1.2;
      const endX = POS.tokenIds[0] + (i - ID_COUNT / 2) * 0.7;

      mesh.position.set(
        lerp(startX, endX, ip),
        POS.tokenIds[1] + Math.sin(ip * Math.PI) * 1.0 + Math.sin(time * 2 + i) * 0.06,
        Math.sin(ip * Math.PI) * 0.3
      );
      mesh.scale.setScalar(0.25 * ip);
      mesh.rotation.y = Math.sin(time * 1 + i * 0.5) * 0.08;
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? easeOut(p) * 4 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.tokenIds}
        color={COLOR.tokenId}
        intensity={0}
        distance={6}
      />
      {Array.from({ length: ID_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 0.5]} />
          <meshStandardMaterial
            color={COLOR.tokenId}
            emissive={COLOR.tokenId}
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Text
        position={[POS.tokenIds[0], POS.tokenIds[1] - 1.5, 0]}
        fontSize={0.26}
        color={COLOR.tokenId}
        anchorX="center"
        anchorY="middle"
      >
        Token IDs
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Stage 6: Vocabulary — grid shows mapping
   ──────────────────────────────────────────── */

const VOCAB_ROWS = 4;
const VOCAB_COLS = 5;
const VOCAB_TOTAL = VOCAB_ROWS * VOCAB_COLS;

function VocabularyStage({ elapsedRef }: { elapsedRef: ElRef }) {
  const cellRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);

  // Highlight certain cells as "active" matches
  const activeIndices = useMemo(() => new Set([2, 5, 8, 12, 14, 17, 19]), []);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const p = phaseT(t, PHASE.VOCAB);
    const time = clock.elapsedTime;

    for (let i = 0; i < VOCAB_TOTAL; i++) {
      const mesh = cellRefs.current[i];
      if (!mesh) continue;

      if (p <= 0) {
        mesh.visible = false;
        continue;
      }

      const row = Math.floor(i / VOCAB_COLS);
      const col = i % VOCAB_COLS;
      const delay = (row * 0.08 + col * 0.04);
      const ip = easeOut(clamp01((p - delay) / 0.4));

      if (ip <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const spacing = 0.45;
      mesh.position.set(
        POS.vocab[0] + (col - VOCAB_COLS / 2 + 0.5) * spacing,
        POS.vocab[1] + (VOCAB_ROWS / 2 - row - 0.5) * spacing,
        0
      );
      mesh.scale.setScalar(0.18 * ip);

      const isActive = activeIndices.has(i);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (isActive && p > 0.5) {
        const glow = Math.sin(time * 4 + i) * 0.5 + 0.5;
        mat.color.set(COLOR.accent);
        mat.emissive.set(COLOR.accent);
        mat.emissiveIntensity = 1.2 + glow * 0.8;
        mat.opacity = 0.95;
      } else {
        mat.color.set(COLOR.vocab);
        mat.emissive.set(COLOR.vocab);
        mat.emissiveIntensity = 0.3;
        mat.opacity = 0.5;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = p > 0 ? easeOut(p) * 4 : 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={POS.vocab}
        color={COLOR.vocab}
        intensity={0}
        distance={8}
      />
      {Array.from({ length: VOCAB_TOTAL }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { cellRefs.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 0.3]} />
          <meshStandardMaterial
            color={COLOR.vocab}
            emissive={COLOR.vocab}
            emissiveIntensity={0.3}
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}
      <Text
        position={[POS.vocab[0], POS.vocab[1] - 1.8, 0]}
        fontSize={0.26}
        color={COLOR.vocab}
        anchorX="center"
        anchorY="middle"
      >
        Vocabulary
      </Text>
    </group>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function TokenizationScene({
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
    if (t >= PHASE.RAW_TEXT[0]) step = 0;
    if (t >= PHASE.CHAR_SPLIT[0]) step = 1;
    if (t >= PHASE.BPE[0]) step = 2;
    if (t >= PHASE.MERGE[0]) step = 3;
    if (t >= PHASE.TOKEN_IDS[0]) step = 4;
    if (t >= PHASE.VOCAB[0]) step = 5;

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
      <RawTextStage elapsedRef={elapsedRef} />
      <CharSplitStage elapsedRef={elapsedRef} />
      <BPEStage elapsedRef={elapsedRef} />
      <MergeRulesStage elapsedRef={elapsedRef} />
      <TokenIDsStage elapsedRef={elapsedRef} />
      <VocabularyStage elapsedRef={elapsedRef} />
    </>
  );
}
