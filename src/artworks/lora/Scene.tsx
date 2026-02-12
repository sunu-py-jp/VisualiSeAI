"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  type SceneProps,
  type ElRef,
  lerp,
  easeInOut,
  easeOut,
  easeIn,
  clamp01,
  phaseT,
} from "../shared/sceneUtils";
import { PHASE, TOTAL_DURATION, TOTAL_STEPS, POS, COLOR } from "./constants";

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
        x: (Math.random() - 0.5) * 44,
        y: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 16 - 5,
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
        p.x + Math.sin(time * p.speed + p.phase) * 0.5,
        p.y + Math.sin(time * p.speed * 0.7 + p.phase + 1) * 0.3,
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
   Original Weight Matrix — large grid of dots
   8x8 = 64 dots to show a "big" matrix
   ──────────────────────────────────────────── */

const GRID_ROWS = 8;
const GRID_COLS = 8;
const GRID_COUNT = GRID_ROWS * GRID_COLS;

function OriginalWeights({ elapsedRef }: { elapsedRef: ElRef }) {
  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const weightColor = useMemo(() => new THREE.Color(COLOR.weight), []);
  const frozenColor = useMemo(() => new THREE.Color(COLOR.frozen), []);
  const efficientColor = useMemo(() => new THREE.Color(COLOR.efficient), []);
  const labelRef = useRef<THREE.Group>(null);
  const freezeLabelRef = useRef<THREE.Group>(null);
  const sizeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!dotsRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    const origP = phaseT(t, PHASE.ORIGINAL);
    const freezeP = phaseT(t, PHASE.FREEZE);
    const effP = phaseT(t, PHASE.EFFICIENT);

    const appear = easeOut(clamp01(origP / 0.6));
    const frozen = easeInOut(freezeP);

    for (let i = 0; i < GRID_COUNT; i++) {
      const row = Math.floor(i / GRID_COLS);
      const col = i % GRID_COLS;
      const x = POS.matrix[0] + (col - GRID_COLS / 2 + 0.5) * 0.55;
      const y = POS.matrix[1] + (row - GRID_ROWS / 2 + 0.5) * 0.55;

      // Stagger appear
      const stagger = (row + col) * 0.02;
      const dotAppear = easeOut(clamp01((origP - stagger) / 0.4));

      // Float gently if not frozen
      const floatY = frozen < 1 ? Math.sin(time * 1.2 + i * 0.3) * 0.04 * (1 - frozen) : 0;
      const floatX = frozen < 1 ? Math.sin(time * 0.8 + i * 0.5) * 0.03 * (1 - frozen) : 0;

      // Merge animation: dots slightly pulse
      const mergePulse = effP > 0 ? Math.sin(time * 4 + i) * 0.02 * easeOut(clamp01(effP / 0.5)) : 0;

      dummy.position.set(x + floatX, y + floatY + mergePulse, 0);
      dummy.scale.setScalar(0.09 * dotAppear * appear);
      dummy.updateMatrix();
      dotsRef.current!.setMatrixAt(i, dummy.matrix);

      // Color: blue -> icy when frozen, -> efficient glow at merge
      if (effP > 0) {
        const mergeP = easeInOut(effP);
        tempColor.copy(frozenColor).lerp(efficientColor, mergeP);
      } else {
        tempColor.copy(weightColor).lerp(frozenColor, frozen);
      }
      dotsRef.current!.setColorAt(i, tempColor);
    }

    dotsRef.current.instanceMatrix.needsUpdate = true;
    if (dotsRef.current.instanceColor)
      dotsRef.current.instanceColor.needsUpdate = true;

    // Labels
    if (labelRef.current) {
      labelRef.current.visible = origP > 0.3 && freezeP < 0.5;
    }
    if (freezeLabelRef.current) {
      freezeLabelRef.current.visible = freezeP > 0.2 && freezeP < 1;
    }
    if (sizeRef.current) {
      sizeRef.current.visible = origP > 0.5;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={dotsRef}
        args={[undefined, undefined, GRID_COUNT]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={COLOR.weight}
          emissive={COLOR.weight}
          emissiveIntensity={0.5}
          transparent
          opacity={0.85}
        />
      </instancedMesh>
      {/* Bounding box to show matrix shape */}
      <mesh position={[POS.matrix[0], POS.matrix[1], -0.1]}>
        <planeGeometry args={[GRID_COLS * 0.55 + 0.3, GRID_ROWS * 0.55 + 0.3]} />
        <meshStandardMaterial
          color={COLOR.weight}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group ref={labelRef} visible={false} position={[POS.matrix[0], POS.matrix[1] - 3, 0]}>
        <Text
          fontSize={0.3}
          color={COLOR.weight}
          anchorX="center"
          anchorY="middle"
        >
          Original Weights (d x d)
        </Text>
      </group>
      <group ref={freezeLabelRef} visible={false} position={[POS.matrix[0], POS.matrix[1] + 3.2, 0]}>
        <Text
          fontSize={0.28}
          color={COLOR.frozen}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Frozen
        </Text>
      </group>
      <group ref={sizeRef} visible={false} position={[POS.matrix[0] + 3, POS.matrix[1], 0]}>
        <Text
          fontSize={0.2}
          color={COLOR.weight}
          anchorX="center"
          anchorY="middle"
        >
          {`${GRID_ROWS}x${GRID_COLS}`}
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   LoRA Matrix A — thin tall shape (d x r)
   r is small (2) compared to d (8)
   ──────────────────────────────────────────── */

const LORA_R = 2; // Low rank!
const LORA_A_ROWS = GRID_ROWS; // d = 8
const LORA_A_COLS = LORA_R; // r = 2
const LORA_A_COUNT = LORA_A_ROWS * LORA_A_COLS;

function LoraMatrixA({ elapsedRef }: { elapsedRef: ElRef }) {
  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const labelRef = useRef<THREE.Group>(null);
  const sizeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!dotsRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    const loraAP = phaseT(t, PHASE.LORA_A);
    const mulP = phaseT(t, PHASE.MULTIPLY);
    const effP = phaseT(t, PHASE.EFFICIENT);

    if (loraAP <= 0) {
      for (let i = 0; i < LORA_A_COUNT; i++) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        dotsRef.current!.setMatrixAt(i, dummy.matrix);
      }
      dotsRef.current.instanceMatrix.needsUpdate = true;
      if (labelRef.current) labelRef.current.visible = false;
      if (sizeRef.current) sizeRef.current.visible = false;
      return;
    }

    // Fade out during efficient phase
    if (effP > 0.5) {
      for (let i = 0; i < LORA_A_COUNT; i++) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        dotsRef.current!.setMatrixAt(i, dummy.matrix);
      }
      dotsRef.current.instanceMatrix.needsUpdate = true;
      if (labelRef.current) labelRef.current.visible = false;
      if (sizeRef.current) sizeRef.current.visible = false;
      return;
    }

    const appear = easeOut(clamp01(loraAP / 0.6));

    for (let i = 0; i < LORA_A_COUNT; i++) {
      const row = Math.floor(i / LORA_A_COLS);
      const col = i % LORA_A_COLS;
      const x = POS.loraA[0] + (col - LORA_A_COLS / 2 + 0.5) * 0.55;
      const y = POS.loraA[1] + (row - LORA_A_ROWS / 2 + 0.5) * 0.55;

      const stagger = (row + col) * 0.03;
      const dotAppear = easeOut(clamp01((loraAP - stagger) / 0.4));

      // Particles fly toward result during multiply
      const flyP = mulP > 0 ? easeInOut(clamp01(mulP / 0.7)) : 0;
      const targetX = POS.result[0] + (col - LORA_A_COLS / 2 + 0.5) * 0.55;
      const targetY = POS.result[1] + (row - LORA_A_ROWS / 2 + 0.5) * 0.55;

      const finalX = lerp(x, targetX, flyP);
      const finalY = lerp(y, targetY, flyP);

      const pulse = Math.sin(time * 3 + i) * 0.03;
      dummy.position.set(finalX + pulse, finalY, 0.1);
      dummy.scale.setScalar(0.09 * dotAppear * appear * (1 - flyP * 0.5));
      dummy.updateMatrix();
      dotsRef.current!.setMatrixAt(i, dummy.matrix);
    }
    dotsRef.current.instanceMatrix.needsUpdate = true;

    if (labelRef.current) labelRef.current.visible = loraAP > 0.3 && mulP < 0.5;
    if (sizeRef.current) sizeRef.current.visible = loraAP > 0.5 && mulP < 0.5;
  });

  return (
    <group>
      <instancedMesh
        ref={dotsRef}
        args={[undefined, undefined, LORA_A_COUNT]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={COLOR.loraA}
          emissive={COLOR.loraA}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false} position={[POS.loraA[0], POS.loraA[1] - 3.2, 0]}>
        <Text
          fontSize={0.26}
          color={COLOR.loraA}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Matrix A (d x r)
        </Text>
      </group>
      <group ref={sizeRef} visible={false} position={[POS.loraA[0] + 1.5, POS.loraA[1], 0]}>
        <Text
          fontSize={0.2}
          color={COLOR.loraA}
          anchorX="center"
          anchorY="middle"
        >
          {`${LORA_A_ROWS}x${LORA_R}`}
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   LoRA Matrix B — wide short shape (r x d)
   ──────────────────────────────────────────── */

const LORA_B_ROWS = LORA_R; // r = 2
const LORA_B_COLS = GRID_COLS; // d = 8
const LORA_B_COUNT = LORA_B_ROWS * LORA_B_COLS;

function LoraMatrixB({ elapsedRef }: { elapsedRef: ElRef }) {
  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const labelRef = useRef<THREE.Group>(null);
  const sizeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!dotsRef.current) return;
    const t = elapsedRef.current;
    const time = clock.elapsedTime;

    const loraBP = phaseT(t, PHASE.LORA_B);
    const mulP = phaseT(t, PHASE.MULTIPLY);
    const effP = phaseT(t, PHASE.EFFICIENT);

    if (loraBP <= 0) {
      for (let i = 0; i < LORA_B_COUNT; i++) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        dotsRef.current!.setMatrixAt(i, dummy.matrix);
      }
      dotsRef.current.instanceMatrix.needsUpdate = true;
      if (labelRef.current) labelRef.current.visible = false;
      if (sizeRef.current) sizeRef.current.visible = false;
      return;
    }

    if (effP > 0.5) {
      for (let i = 0; i < LORA_B_COUNT; i++) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        dotsRef.current!.setMatrixAt(i, dummy.matrix);
      }
      dotsRef.current.instanceMatrix.needsUpdate = true;
      if (labelRef.current) labelRef.current.visible = false;
      if (sizeRef.current) sizeRef.current.visible = false;
      return;
    }

    const appear = easeOut(clamp01(loraBP / 0.6));

    for (let i = 0; i < LORA_B_COUNT; i++) {
      const row = Math.floor(i / LORA_B_COLS);
      const col = i % LORA_B_COLS;
      const x = POS.loraB[0] + (col - LORA_B_COLS / 2 + 0.5) * 0.55;
      const y = POS.loraB[1] + (row - LORA_B_ROWS / 2 + 0.5) * 0.55;

      const stagger = (row + col) * 0.03;
      const dotAppear = easeOut(clamp01((loraBP - stagger) / 0.4));

      // Fly toward result during multiply
      const flyP = mulP > 0 ? easeInOut(clamp01(mulP / 0.7)) : 0;
      const targetX = POS.result[0] + (col - LORA_B_COLS / 2 + 0.5) * 0.55;
      const targetY = POS.result[1] + (row - LORA_B_ROWS / 2 + 0.5) * 0.55;

      const finalX = lerp(x, targetX, flyP);
      const finalY = lerp(y, targetY, flyP);

      const pulse = Math.sin(time * 3 + i * 0.7) * 0.03;
      dummy.position.set(finalX, finalY + pulse, 0.1);
      dummy.scale.setScalar(0.09 * dotAppear * appear * (1 - flyP * 0.5));
      dummy.updateMatrix();
      dotsRef.current!.setMatrixAt(i, dummy.matrix);
    }
    dotsRef.current.instanceMatrix.needsUpdate = true;

    if (labelRef.current) labelRef.current.visible = loraBP > 0.3 && mulP < 0.5;
    if (sizeRef.current) sizeRef.current.visible = loraBP > 0.5 && mulP < 0.5;
  });

  return (
    <group>
      <instancedMesh
        ref={dotsRef}
        args={[undefined, undefined, LORA_B_COUNT]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={COLOR.loraB}
          emissive={COLOR.loraB}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false} position={[POS.loraB[0], POS.loraB[1] + 1.5, 0]}>
        <Text
          fontSize={0.26}
          color={COLOR.loraB}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Matrix B (r x d)
        </Text>
      </group>
      <group ref={sizeRef} visible={false} position={[POS.loraB[0], POS.loraB[1] - 1.2, 0]}>
        <Text
          fontSize={0.2}
          color={COLOR.loraB}
          anchorX="center"
          anchorY="middle"
        >
          {`${LORA_R}x${LORA_B_COLS}`}
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Multiply particles — fly between A and B
   during the AxB phase, forming update matrix
   ──────────────────────────────────────────── */

const SPARK_COUNT = 24;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => ({
  phase: (i / SPARK_COUNT) * Math.PI * 2,
  speed: 0.6 + Math.random() * 0.6,
  radius: 0.3 + Math.random() * 0.5,
}));

function MultiplySparks({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  return (
    <group>
      {SPARKS.map((spark, i) => (
        <MultiplySparkDot key={i} index={i} elapsedRef={elapsedRef} spark={spark} />
      ))}
      <MultiplyLabel elapsedRef={elapsedRef} labelRef={labelRef} />
    </group>
  );
}

function MultiplyLabel({ elapsedRef, labelRef }: { elapsedRef: ElRef; labelRef: React.RefObject<THREE.Group | null> }) {
  useFrame(() => {
    if (!labelRef.current) return;
    const mulP = phaseT(elapsedRef.current, PHASE.MULTIPLY);
    labelRef.current.visible = mulP > 0.1 && mulP < 0.8;
  });

  return (
    <group ref={labelRef} visible={false} position={[POS.result[0], POS.result[1] + 3, 0]}>
      <Text
        fontSize={0.28}
        color={COLOR.multiply}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="black"
      >
        A x B = Update
      </Text>
    </group>
  );
}

function MultiplySparkDot({
  index,
  elapsedRef,
  spark,
}: {
  index: number;
  elapsedRef: ElRef;
  spark: (typeof SPARKS)[0];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mulP = phaseT(elapsedRef.current, PHASE.MULTIPLY);
    const effP = phaseT(elapsedRef.current, PHASE.EFFICIENT);

    if (mulP <= 0 || effP > 0.3) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const time = clock.elapsedTime;
    const appear = easeOut(clamp01(mulP / 0.3));

    // Orbit between A and B positions, converging on result
    const cx = POS.result[0];
    const cy = POS.result[1];
    const angle = spark.phase + time * spark.speed * 3;
    const r = spark.radius * (2 - mulP * 1.5) * appear;

    meshRef.current.position.set(
      cx + Math.cos(angle) * r * 2,
      cy + Math.sin(angle) * r,
      Math.sin(angle * 2) * 0.5
    );
    meshRef.current.scale.setScalar(0.06 * appear);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={COLOR.multiply}
        emissive={COLOR.multiply}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ────────────────────────────────────────────
   Merge animation — update adds to original
   ──────────────────────────────────────────── */

function MergeEffect({ elapsedRef }: { elapsedRef: ElRef }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const effP = phaseT(elapsedRef.current, PHASE.EFFICIENT);

    if (lightRef.current) {
      if (effP > 0 && effP < 1) {
        const pulse = easeOut(clamp01(effP / 0.4));
        lightRef.current.intensity = pulse * 6;
        lightRef.current.position.set(POS.matrix[0], POS.matrix[1], 1);
      } else {
        lightRef.current.intensity = 0;
      }
    }

    if (ringRef.current) {
      if (effP > 0 && effP < 0.8) {
        ringRef.current.visible = true;
        const expand = easeOut(effP / 0.8);
        ringRef.current.scale.setScalar(expand * 4);
        const mat = ringRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.4 * (1 - expand);
      } else {
        ringRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        color={COLOR.efficient}
        intensity={0}
        distance={12}
      />
      <mesh
        ref={ringRef}
        visible={false}
        position={[POS.matrix[0], POS.matrix[1], 0]}
      >
        <torusGeometry args={[1, 0.04, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.efficient}
          emissive={COLOR.efficient}
          emissiveIntensity={2}
          transparent
          opacity={0.4}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────
   Efficient Model Label + glow
   ──────────────────────────────────────────── */

function EfficientLabel({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const effP = phaseT(elapsedRef.current, PHASE.EFFICIENT);
    ref.current.visible = effP > 0.3;
  });

  return (
    <group ref={ref} visible={false} position={[POS.matrix[0], POS.matrix[1] - 3.8, 0]}>
      <Text
        fontSize={0.3}
        color={COLOR.efficient}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="black"
      >
        W + A x B = Efficient Model
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Arrow from A,B result to original matrix
   Shows the "addition" visually
   ──────────────────────────────────────────── */

function UpdateArrow({ elapsedRef }: { elapsedRef: ElRef }) {
  const lineObj = useMemo(() => {
    const pts = [
      new THREE.Vector3(POS.result[0], POS.result[1], 0),
      new THREE.Vector3(
        (POS.result[0] + POS.matrix[0]) / 2,
        (POS.result[1] + POS.matrix[1]) / 2 + 1.5,
        0
      ),
      new THREE.Vector3(POS.matrix[0] + 2.5, POS.matrix[1], 0),
    ];
    const curve = new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
    const material = new THREE.LineBasicMaterial({
      color: COLOR.multiply,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, []);

  useFrame(() => {
    const mulP = phaseT(elapsedRef.current, PHASE.MULTIPLY);
    const effP = phaseT(elapsedRef.current, PHASE.EFFICIENT);
    const mat = lineObj.material as THREE.LineBasicMaterial;

    if (mulP > 0.3 && effP < 0.8) {
      mat.opacity = easeOut(clamp01((mulP - 0.3) / 0.4)) * 0.3 * (1 - effP);
    } else {
      mat.opacity = 0;
    }
  });

  return <primitive object={lineObj} />;
}

/* ────────────────────────────────────────────
   Connection lines (faint guides)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const pts = [
      new THREE.Vector3(...POS.loraA),
      new THREE.Vector3(...POS.result),
      new THREE.Vector3(...POS.loraB),
    ];
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
   Size comparison text
   ──────────────────────────────────────────── */

function SizeComparison({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const loraAP = phaseT(elapsedRef.current, PHASE.LORA_A);
    const loraBP = phaseT(elapsedRef.current, PHASE.LORA_B);
    const effP = phaseT(elapsedRef.current, PHASE.EFFICIENT);
    ref.current.visible = loraBP > 0.5 && effP < 0.5;
  });

  return (
    <group ref={ref} visible={false} position={[3, -4.5, 0]}>
      <Text
        fontSize={0.22}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {`Original: ${GRID_ROWS}x${GRID_COLS} = ${GRID_COUNT} params  |  LoRA: ${GRID_ROWS}x${LORA_R} + ${LORA_R}x${GRID_COLS} = ${LORA_A_COUNT + LORA_B_COUNT} params`}
      </Text>
    </group>
  );
}

/* ════════════════════════════════════════════
   Main Scene — orchestrator
   ════════════════════════════════════════════ */

export default function LoraScene({
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
    if (t >= PHASE.ORIGINAL[0]) step = 0;
    if (t >= PHASE.FREEZE[0]) step = 1;
    if (t >= PHASE.LORA_A[0]) step = 2;
    if (t >= PHASE.LORA_B[0]) step = 3;
    if (t >= PHASE.MULTIPLY[0]) step = 4;
    if (t >= PHASE.EFFICIENT[0]) step = 5;

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
      <OriginalWeights elapsedRef={elapsedRef} />
      <LoraMatrixA elapsedRef={elapsedRef} />
      <LoraMatrixB elapsedRef={elapsedRef} />

      {/* Animated flow */}
      <MultiplySparks elapsedRef={elapsedRef} />
      <UpdateArrow elapsedRef={elapsedRef} />
      <MergeEffect elapsedRef={elapsedRef} />
      <EfficientLabel elapsedRef={elapsedRef} />
      <SizeComparison elapsedRef={elapsedRef} />
    </>
  );
}
