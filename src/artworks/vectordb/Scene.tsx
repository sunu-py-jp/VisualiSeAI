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
    const stages = [POS.input, POS.embed, POS.index, POS.query, POS.results];
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
   Document shapes — input data entering
   ──────────────────────────────────────────── */

const DOC_COUNT = 8;

function DocumentShape({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const delay = index * 0.1;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const inputP = phaseT(elapsedRef.current, PHASE.INPUT);
    const embedP = phaseT(elapsedRef.current, PHASE.EMBED);

    if (inputP <= delay) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    if (embedP > 0) {
      // Transform into vectors — shrink and fade during embed phase
      const fade = 1 - easeInOut(clamp01(embedP / 0.5));
      if (fade <= 0.01) {
        meshRef.current.visible = false;
        return;
      }
      meshRef.current.scale.set(0.25 * fade, 0.35 * fade, 0.04);
    } else {
      // Float in from the left
      const localP = easeOut(clamp01((inputP - delay) / (1 - delay)));
      const startX = POS.input[0] - 4;
      const x = lerp(startX, POS.input[0], localP);
      const yOffset = (index - DOC_COUNT / 2) * 0.6;
      const y = POS.input[1] + yOffset + Math.sin(clock.elapsedTime * 2 + index) * 0.1;
      meshRef.current.position.set(x, y, (index - DOC_COUNT / 2) * 0.15);
      meshRef.current.scale.set(0.25, 0.35, 0.04);
      meshRef.current.rotation.z = Math.sin(clock.elapsedTime + index) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.doc}
        emissive={COLOR.doc}
        emissiveIntensity={0.8}
        transparent
        opacity={0.8}
        toneMapped={false}
      />
    </mesh>
  );
}

function Documents({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const inputP = phaseT(elapsedRef.current, PHASE.INPUT);
    labelRef.current.visible = inputP > 0.3 && inputP < 0.95;
  });

  return (
    <group>
      {Array.from({ length: DOC_COUNT }, (_, i) => (
        <DocumentShape key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false}>
        <Text
          position={[POS.input[0], POS.input[1] - 2.5, 0]}
          fontSize={0.26}
          color={COLOR.doc}
          anchorX="center"
          anchorY="middle"
        >
          Documents
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Vector Arrows — embeddings in 3D space
   ──────────────────────────────────────────── */

const VECTOR_COUNT = 20;

// Pre-compute stable vector positions in embedding space
const VECTOR_DATA = Array.from({ length: VECTOR_COUNT }, (_, i) => {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / VECTOR_COUNT);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  const r = 2.0 + (i % 3) * 0.4;
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi) * 0.6,
    // Arrow direction (unit vector from origin)
    dx: Math.sin(phi) * Math.cos(theta),
    dy: Math.sin(phi) * Math.sin(theta),
    dz: Math.cos(phi),
  };
});

function VectorArrow({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const lineRef = useRef<THREE.Group>(null);
  const vd = VECTOR_DATA[index];
  const delay = index * 0.04;

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const embedP = phaseT(elapsedRef.current, PHASE.EMBED);
    const indexP = phaseT(elapsedRef.current, PHASE.INDEX);
    const searchP = phaseT(elapsedRef.current, PHASE.SEARCH);
    const topkP = phaseT(elapsedRef.current, PHASE.TOPK);

    if (embedP <= delay) {
      lineRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;
    const localP = easeOut(clamp01((embedP - delay) / (1 - delay)));

    // Vectors appear at embed position then move to index position
    let targetX = POS.embed[0] + vd.x * localP;
    let targetY = POS.embed[1] + vd.y * localP;
    let targetZ = vd.z * localP;

    if (indexP > 0) {
      const moveP = easeInOut(clamp01(indexP / 0.6));
      targetX = lerp(POS.embed[0] + vd.x, POS.index[0] + vd.x * 0.8, moveP);
      targetY = lerp(POS.embed[1] + vd.y, POS.index[1] + vd.y * 0.8, moveP);
      targetZ = lerp(vd.z, vd.z * 0.6, moveP);
    }

    // Top-K results fly to output
    const isTopK = index < 5;
    if (isTopK && topkP > 0.1) {
      const flyP = easeInOut(clamp01((topkP - 0.1 - index * 0.08) / 0.6));
      targetX = lerp(targetX, POS.results[0], flyP);
      targetY = lerp(targetY, POS.results[1] + (index - 2) * 0.6, flyP);
      targetZ = lerp(targetZ, 0, flyP);
    }

    lineRef.current.position.set(targetX, targetY, targetZ);

    // Pulse scale during search
    let s = 0.12;
    if (searchP > 0 && searchP < 1) {
      const wave = Math.sin((searchP * 5 - index / VECTOR_COUNT) * Math.PI);
      s += Math.max(0, wave) * 0.08;
    }
    if (isTopK && searchP > 0.5) {
      s += 0.06;
    }
    lineRef.current.scale.setScalar(s);

    lineRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.5 + index) * 0.05;
  });

  // Determine color based on whether this is a top-K result
  const isTopK = index < 5;
  const arrowColor = isTopK ? COLOR.result : COLOR.vector;

  return (
    <group ref={lineRef} visible={false}>
      {/* Arrow body */}
      <mesh rotation={[0, 0, Math.atan2(vd.dy, vd.dx)]}>
        <cylinderGeometry args={[0.3, 0.3, 5, 6]} />
        <meshStandardMaterial
          color={arrowColor}
          emissive={arrowColor}
          emissiveIntensity={isTopK ? 1.5 : 0.8}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>
      {/* Arrow head */}
      <mesh
        position={[vd.dx * 0.4, vd.dy * 0.4, 0]}
        rotation={[0, 0, Math.atan2(vd.dy, vd.dx) - Math.PI / 2]}
      >
        <coneGeometry args={[0.6, 1, 6]} />
        <meshStandardMaterial
          color={arrowColor}
          emissive={arrowColor}
          emissiveIntensity={isTopK ? 1.5 : 0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function VectorSpace({ elapsedRef }: { elapsedRef: ElRef }) {
  return (
    <group>
      {Array.from({ length: VECTOR_COUNT }, (_, i) => (
        <VectorArrow key={i} index={i} elapsedRef={elapsedRef} />
      ))}
    </group>
  );
}

/* ────────────────────────────────────────────
   Index Structure — wireframe tree/graph structure
   ──────────────────────────────────────────── */

function IndexStructure({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const wireRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const indexP = phaseT(elapsedRef.current, PHASE.INDEX);
    const time = clock.elapsedTime;

    if (groupRef.current) {
      const appear = easeOut(clamp01(indexP / 0.4));
      groupRef.current.visible = indexP > 0;
      groupRef.current.scale.setScalar(appear);
    }
    if (wireRef.current) {
      wireRef.current.rotation.y = time * 0.1;
      wireRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={POS.index} visible={false}>
      {/* Outer wireframe dodecahedron as index structure */}
      <mesh ref={wireRef}>
        <dodecahedronGeometry args={[2.5, 0]} />
        <meshStandardMaterial
          color={COLOR.index}
          emissive={COLOR.index}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
      {/* Inner sphere to show structure */}
      <mesh>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial
          color={COLOR.index}
          emissive={COLOR.index}
          emissiveIntensity={0.2}
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>
      <pointLight color={COLOR.index} intensity={1.5} distance={6} />
      <Text
        position={[0, -3.2, 0]}
        fontSize={0.26}
        color={COLOR.index}
        anchorX="center"
        anchorY="middle"
      >
        Vector Index
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Query Vector — bright search vector
   ──────────────────────────────────────────── */

function QueryVector({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const queryP = phaseT(elapsedRef.current, PHASE.QUERY);
    const searchP = phaseT(elapsedRef.current, PHASE.SEARCH);
    const time = clock.elapsedTime;

    if (meshRef.current) {
      if (queryP > 0) {
        meshRef.current.visible = true;
        const appear = easeOut(clamp01(queryP / 0.4));

        // Appears at query position
        let x = POS.query[0];
        let y = POS.query[1];
        let z = 0;

        // During search, moves toward index
        if (searchP > 0) {
          const moveP = easeInOut(clamp01(searchP / 0.4));
          x = lerp(POS.query[0], POS.index[0], moveP);
          y = lerp(POS.query[1], POS.index[1], moveP);
        }

        meshRef.current.position.set(x, y, z);
        meshRef.current.scale.setScalar(
          appear * 0.4 + Math.sin(time * 5) * 0.03
        );
        meshRef.current.rotation.y = time * 0.8;
      } else {
        meshRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = queryP > 0 ? 2 + queryP * 3 : 0;
      if (meshRef.current?.visible) {
        lightRef.current.position.copy(meshRef.current.position);
      }
    }

    if (labelRef.current) {
      labelRef.current.visible = queryP > 0.3 && searchP < 0.5;
      if (meshRef.current?.visible) {
        labelRef.current.position.set(
          meshRef.current.position.x,
          meshRef.current.position.y + 1,
          0
        );
      }
    }
  });

  return (
    <>
      <mesh ref={meshRef} visible={false}>
        <octahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={COLOR.query}
          emissive={COLOR.query}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.query}
        intensity={0}
        distance={8}
      />
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.28}
          color={COLOR.query}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Query
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Search Beams — radiate from query to find neighbors
   ──────────────────────────────────────────── */

const BEAM_COUNT = 12;

function SearchBeam({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const angle = (index / BEAM_COUNT) * Math.PI * 2;
  const delay = index * 0.04;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const searchP = phaseT(elapsedRef.current, PHASE.SEARCH);

    if (searchP <= delay || searchP >= 0.95) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const localP = easeOut(clamp01((searchP - delay) / (0.6 - delay)));

    // Beams radiate outward from index center
    const beamLength = localP * 4;
    const x = POS.index[0] + Math.cos(angle + clock.elapsedTime * 0.3) * beamLength * 0.5;
    const y = POS.index[1] + Math.sin(angle + clock.elapsedTime * 0.3) * beamLength * 0.5;
    const z = Math.sin(angle * 2 + clock.elapsedTime * 0.2) * beamLength * 0.3;

    meshRef.current.position.set(x, y, z);
    meshRef.current.scale.set(0.03, beamLength * 0.5, 0.03);
    meshRef.current.rotation.z = angle + clock.elapsedTime * 0.3;

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = (1 - localP * 0.5) * 0.6;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <cylinderGeometry args={[1, 0.3, 1, 6]} />
      <meshStandardMaterial
        color={COLOR.search}
        emissive={COLOR.search}
        emissiveIntensity={2}
        transparent
        opacity={0.6}
        toneMapped={false}
      />
    </mesh>
  );
}

function SearchBeams({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const searchP = phaseT(elapsedRef.current, PHASE.SEARCH);
    labelRef.current.visible = searchP > 0.1 && searchP < 0.9;
  });

  return (
    <group>
      {Array.from({ length: BEAM_COUNT }, (_, i) => (
        <SearchBeam key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false}>
        <Text
          position={[POS.index[0], POS.index[1] + 3.5, 0]}
          fontSize={0.26}
          color={COLOR.search}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          ANN Search
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Top-K Results — highlighted vectors at output
   ──────────────────────────────────────────── */

function TopKResults({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const topkP = phaseT(elapsedRef.current, PHASE.TOPK);

    if (groupRef.current) {
      const appear = easeOut(clamp01(topkP / 0.4));
      groupRef.current.visible = topkP > 0.3;
      groupRef.current.scale.setScalar(appear);
    }
    if (lightRef.current) {
      lightRef.current.intensity = topkP > 0.3 ? 2 + topkP * 5 : 0;
    }
  });

  return (
    <group ref={groupRef} position={POS.results} visible={false}>
      <pointLight
        ref={lightRef}
        color={COLOR.result}
        intensity={0}
        distance={8}
      />
      <Text
        position={[0, -2.2, 0]}
        fontSize={0.28}
        color={COLOR.result}
        anchorX="center"
        anchorY="middle"
      >
        Top-K Results
      </Text>
    </group>
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
    if (t >= PHASE.INPUT[0]) step = 0;
    if (t >= PHASE.EMBED[0]) step = 1;
    if (t >= PHASE.INDEX[0]) step = 2;
    if (t >= PHASE.QUERY[0]) step = 3;
    if (t >= PHASE.SEARCH[0]) step = 4;
    if (t >= PHASE.TOPK[0]) step = 5;

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
      <Documents elapsedRef={elapsedRef} />
      <VectorSpace elapsedRef={elapsedRef} />
      <IndexStructure elapsedRef={elapsedRef} />
      <QueryVector elapsedRef={elapsedRef} />
      <SearchBeams elapsedRef={elapsedRef} />
      <TopKResults elapsedRef={elapsedRef} />
    </>
  );
}
