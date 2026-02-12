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
   Constants
   ──────────────────────────────────────────── */

const EXPERT_COUNT = 8;
const SELECTED_EXPERTS = [2, 5]; // Which 2 of 8 experts are selected

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
    const stages = [POS.input, POS.router, POS.experts, POS.combine, POS.output];
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
   Input Token — sphere with token label
   ──────────────────────────────────────────── */

function InputToken({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !ringRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.INPUT);
    const time = clock.elapsedTime;

    const appear = easeOut(clamp01(p / 0.5));
    meshRef.current.scale.setScalar(0.5 * appear);
    meshRef.current.visible = p > 0;

    ringRef.current.rotation.x = Math.sin(time * 0.5) * 0.2;
    ringRef.current.rotation.y = time * 0.3;
    ringRef.current.scale.setScalar(appear);
    ringRef.current.visible = p > 0;

    lightRef.current.intensity = p > 0 && p < 1 ? 2 * Math.sin(p * Math.PI) : 0;
  });

  return (
    <group position={POS.input}>
      <pointLight ref={lightRef} color={COLOR.input} intensity={0} distance={6} />
      <mesh ref={meshRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.input}
          emissive={COLOR.input}
          emissiveIntensity={0.4}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[0.8, 0.05, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.input}
          emissive={COLOR.input}
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </mesh>
      <Text position={[0, -1.3, 0]} fontSize={0.26} color={COLOR.input} anchorX="center" anchorY="middle">
        Input Token
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Router Network — small neural net visualization
   (gate/routing network that evaluates which experts)
   ──────────────────────────────────────────── */

const ROUTER_NODES = 12;

function RouterNetwork({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lightRef = useRef<THREE.PointLight>(null);

  // Small network: 3 layers of 4 nodes each
  const nodes = useMemo(() => {
    const result: { x: number; y: number; z: number; layer: number }[] = [];
    for (let layer = 0; layer < 3; layer++) {
      for (let node = 0; node < 4; node++) {
        result.push({
          x: (layer - 1) * 0.6,
          y: (node - 1.5) * 0.4,
          z: 0,
          layer,
        });
      }
    }
    return result;
  }, []);

  // Connection lines between layers
  const lineObjs = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let layer = 0; layer < 2; layer++) {
      for (let from = 0; from < 4; from++) {
        for (let to = 0; to < 4; to++) {
          const p1 = new THREE.Vector3(
            POS.router[0] + (layer - 1) * 0.6,
            POS.router[1] + (from - 1.5) * 0.4,
            0
          );
          const p2 = new THREE.Vector3(
            POS.router[0] + (layer) * 0.6,
            POS.router[1] + (to - 1.5) * 0.4,
            0
          );
          const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
          const mat = new THREE.LineBasicMaterial({
            color: COLOR.router,
            transparent: true,
            opacity: 0.15,
          });
          lines.push(new THREE.Line(geo, mat));
        }
      }
    }
    return lines;
  }, []);

  const linesGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.ROUTER);
    const time = clock.elapsedTime;

    lightRef.current.intensity = p > 0 && p < 1 ? 3 * Math.sin(p * Math.PI) : 0;

    for (let i = 0; i < ROUTER_NODES; i++) {
      const node = nodes[i];
      const delay = node.layer * 0.15;
      const ip = easeOut(clamp01((p - delay) / (0.5)));

      if (p > 0 && p < 1) {
        dummy.position.set(
          POS.router[0] + node.x,
          POS.router[1] + node.y,
          node.z
        );
        // Pulse through layers
        const pulse = Math.sin(time * 4 - node.layer * 1.5) * 0.3;
        dummy.scale.setScalar((0.06 + Math.max(0, pulse) * 0.04) * ip);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;

    // Animate connection lines
    if (linesGroupRef.current) {
      for (let i = 0; i < linesGroupRef.current.children.length; i++) {
        const line = linesGroupRef.current.children[i];
        line.visible = p > 0.2 && p < 1;
        if (line.visible) {
          const mat = (line as THREE.Line).material as THREE.LineBasicMaterial;
          const pulse = Math.sin(time * 6 + i * 0.3) * 0.5 + 0.5;
          mat.opacity = 0.1 + pulse * 0.3 * easeOut(clamp01((p - 0.2) / 0.5));
        }
      }
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} position={POS.router} color={COLOR.router} intensity={0} distance={6} />
      <instancedMesh ref={ref} args={[undefined, undefined, ROUTER_NODES]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={COLOR.router}
          emissive={COLOR.router}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </instancedMesh>
      <group ref={linesGroupRef}>
        {lineObjs.map((line, i) => (
          <primitive key={i} object={line} />
        ))}
      </group>
      <Text position={[POS.router[0], POS.router[1] - 1.5, 0]} fontSize={0.26} color={COLOR.router} anchorX="center" anchorY="middle">
        Router Network
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Expert Panels — 8 experts arranged in 2 rows of 4
   2 selected (bright), 6 dimmed
   ──────────────────────────────────────────── */

// Expert positions in a 2x4 grid
const EXPERT_POSITIONS: V3[] = Array.from({ length: EXPERT_COUNT }, (_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return [
    POS.experts[0] + (col - 1.5) * 1.3,
    POS.experts[1] + (row - 0.5) * 1.8,
    0,
  ] as V3;
});

function ExpertPanels({ elapsedRef }: { elapsedRef: ElRef }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const selectP = phaseT(elapsedRef.current, PHASE.SELECT);
    const processP = phaseT(elapsedRef.current, PHASE.PROCESS);
    const time = clock.elapsedTime;

    const children = groupRef.current.children;
    for (let i = 0; i < EXPERT_COUNT; i++) {
      const group = children[i] as THREE.Group;
      if (!group) continue;

      const isSelected = SELECTED_EXPERTS.includes(i);
      const pos = EXPERT_POSITIONS[i];

      // Selection animation
      const delay = i * 0.08;
      const appear = easeOut(clamp01((selectP - delay) / 0.4));

      // During SELECT phase: all appear, then non-selected dim
      const dimPhase = clamp01((selectP - 0.5) / 0.5);
      const brightness = isSelected ? 1 : Math.max(0.15, 1 - dimPhase * 0.85);

      // During PROCESS phase: selected experts pulse
      const processPulse =
        isSelected && processP > 0 && processP < 1
          ? Math.sin(time * 5 + i * 2) * 0.3 + 0.7
          : 0;

      if (selectP > 0 || processP > 0) {
        group.visible = true;
        group.position.set(pos[0], pos[1], pos[2]);

        // The box mesh
        const box = group.children[0] as THREE.Mesh;
        if (box) {
          box.scale.setScalar(appear * (0.8 + processPulse * 0.3));
          const mat = box.material as THREE.MeshStandardMaterial;
          mat.opacity = brightness * 0.8;
          mat.emissiveIntensity = brightness * 0.5 + processPulse * 0.8;
        }

        // Inner wireframe
        const wire = group.children[1] as THREE.Mesh;
        if (wire) {
          wire.scale.setScalar(appear * (0.6 + processPulse * 0.2));
          wire.rotation.y = time * (isSelected ? 0.5 : 0.1);
          const wmat = wire.material as THREE.MeshStandardMaterial;
          wmat.opacity = brightness * 0.4;
        }
      } else {
        group.visible = false;
      }

      // Lights for selected experts
      const light = lightRefs.current[i];
      if (light) {
        light.intensity =
          isSelected && (selectP > 0.5 || processP > 0) ? 2 + processPulse * 3 : 0;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: EXPERT_COUNT }, (_, i) => {
        const isSelected = SELECTED_EXPERTS.includes(i);
        const col = isSelected ? COLOR.selected : COLOR.dimmed;
        return (
          <group key={i} visible={false}>
            <mesh>
              <boxGeometry args={[0.9, 0.9, 0.3]} />
              <meshStandardMaterial
                color={col}
                emissive={isSelected ? COLOR.selected : COLOR.expert}
                emissiveIntensity={0.3}
                transparent
                opacity={0.8}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[0.6, 0.6, 0.2]} />
              <meshStandardMaterial
                color={isSelected ? COLOR.accent : COLOR.dimmed}
                emissive={isSelected ? COLOR.selected : COLOR.dimmed}
                emissiveIntensity={0.2}
                wireframe
                transparent
                opacity={0.4}
              />
            </mesh>
            <pointLight
              ref={(el) => { lightRefs.current[i] = el; }}
              color={COLOR.selected}
              intensity={0}
              distance={4}
            />
            <Text
              position={[0, -0.7, 0]}
              fontSize={0.18}
              color={isSelected ? COLOR.selected : COLOR.dimmed}
              anchorX="center"
              anchorY="middle"
            >
              {`E${i + 1}`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ────────────────────────────────────────────
   Data flow: Router → Selected Experts
   ──────────────────────────────────────────── */

function RouterToExpertFlow({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const selectP = phaseT(elapsedRef.current, PHASE.SELECT);

    for (let si = 0; si < SELECTED_EXPERTS.length; si++) {
      const expertIdx = SELECTED_EXPERTS[si];
      const orb = orbs.current[si];
      if (!orb) continue;

      const delay = si * 0.15;
      const fp = easeInOut(clamp01((selectP - 0.2 - delay) / 0.4));

      if (selectP > 0.2 && selectP < 0.8) {
        orb.visible = true;
        const target = EXPERT_POSITIONS[expertIdx];
        orb.position.set(
          lerp(POS.router[0], target[0], fp),
          lerp(POS.router[1], target[1], fp) + Math.sin(fp * Math.PI) * 0.8,
          0
        );
        orb.scale.setScalar(0.12 * (1 - fp * 0.3));
      } else {
        orb.visible = false;
      }
    }
  });

  return (
    <>
      {SELECTED_EXPERTS.map((_, si) => (
        <mesh
          key={si}
          ref={(el) => { orbs.current[si] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color={COLOR.selected}
            emissive={COLOR.selected}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/* ────────────────────────────────────────────
   Data flow through selected experts (processing)
   ──────────────────────────────────────────── */

const PROCESS_PARTICLE_COUNT = 12;

function ExpertProcessFlow({ elapsedRef }: { elapsedRef: ElRef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = phaseT(elapsedRef.current, PHASE.PROCESS);
    const time = clock.elapsedTime;

    for (let i = 0; i < PROCESS_PARTICLE_COUNT; i++) {
      const expertSide = i < PROCESS_PARTICLE_COUNT / 2 ? 0 : 1;
      const localIdx = i % (PROCESS_PARTICLE_COUNT / 2);
      const expertIdx = SELECTED_EXPERTS[expertSide];
      const expertPos = EXPERT_POSITIONS[expertIdx];

      if (p > 0 && p < 1) {
        // Particles orbit around the selected expert
        const angle = time * 3 + (localIdx / (PROCESS_PARTICLE_COUNT / 2)) * Math.PI * 2;
        const radius = 0.5 + Math.sin(time * 2 + localIdx) * 0.15;
        dummy.position.set(
          expertPos[0] + Math.cos(angle) * radius,
          expertPos[1] + Math.sin(angle) * radius,
          Math.sin(time + localIdx * 0.5) * 0.3
        );
        dummy.scale.setScalar(0.05 * Math.sin(p * Math.PI));
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
    <instancedMesh ref={ref} args={[undefined, undefined, PROCESS_PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={COLOR.accent}
        emissive={COLOR.selected}
        emissiveIntensity={1.2}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────────────────────
   Weighted Combine — outputs merge with visible weights
   ──────────────────────────────────────────── */

function WeightedCombine({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const orbs = useRef<(THREE.Mesh | null)[]>([]);

  // Weight labels
  const weights = [0.7, 0.3]; // weights for the 2 selected experts

  useFrame(({ clock }) => {
    if (!meshRef.current || !wireRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.COMBINE);
    const time = clock.elapsedTime;

    const activity = p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;

    meshRef.current.visible = p > 0.3;
    meshRef.current.scale.setScalar(0.6 + activity * 0.4);
    meshRef.current.rotation.y = time * 0.3;

    wireRef.current.visible = p > 0.3;
    wireRef.current.rotation.y = -time * 0.5;
    wireRef.current.scale.setScalar(0.9 + activity * 0.3);

    lightRef.current.intensity = activity * 5;

    // Converging orbs from experts to combine point
    for (let si = 0; si < SELECTED_EXPERTS.length; si++) {
      const orb = orbs.current[si];
      if (!orb) continue;

      const delay = si * 0.1;
      const fp = easeInOut(clamp01((p - delay) / 0.5));

      if (p > 0 && p < 0.7) {
        orb.visible = true;
        const expertPos = EXPERT_POSITIONS[SELECTED_EXPERTS[si]];
        orb.position.set(
          lerp(expertPos[0], POS.combine[0], fp),
          lerp(expertPos[1], POS.combine[1], fp) + Math.sin(fp * Math.PI) * 1,
          0
        );
        orb.scale.setScalar(0.15 * weights[si] * 2 * (1 - fp * 0.3));
      } else {
        orb.visible = false;
      }
    }
  });

  return (
    <>
      <group position={POS.combine}>
        <pointLight ref={lightRef} color={COLOR.combine} intensity={0} distance={8} />
        <mesh ref={meshRef} visible={false}>
          <icosahedronGeometry args={[0.6, 2]} />
          <meshStandardMaterial
            color={COLOR.combine}
            emissive={COLOR.combine}
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
          />
        </mesh>
        <mesh ref={wireRef} visible={false}>
          <icosahedronGeometry args={[0.9, 1]} />
          <meshStandardMaterial
            color={COLOR.combine}
            emissive={COLOR.combine}
            emissiveIntensity={0.3}
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>
        <Text position={[0, -1.5, 0]} fontSize={0.26} color={COLOR.combine} anchorX="center" anchorY="middle">
          Weighted Combine
        </Text>
      </group>

      {/* Converging orbs — world-space positioned, outside the combine group */}
      {SELECTED_EXPERTS.map((_, si) => (
        <mesh
          key={si}
          ref={(el) => { orbs.current[si] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color={COLOR.selected}
            emissive={COLOR.selected}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/* ────────────────────────────────────────────
   Output — final result sphere
   ──────────────────────────────────────────── */

function OutputResult({ elapsedRef }: { elapsedRef: ElRef }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current || !lightRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.OUTPUT);
    const time = clock.elapsedTime;

    const appear = easeOut(p);
    meshRef.current.visible = p > 0;
    meshRef.current.scale.setScalar(appear * 0.6);
    meshRef.current.rotation.y = time * 0.3;

    glowRef.current.visible = p > 0.3;
    glowRef.current.scale.setScalar(appear * 1);
    glowRef.current.rotation.y = -time * 0.2;

    lightRef.current.intensity = p > 0 ? appear * 6 : 0;
  });

  return (
    <group position={POS.output}>
      <pointLight ref={lightRef} color={COLOR.output} intensity={0} distance={8} />
      <mesh ref={meshRef} visible={false}>
        <icosahedronGeometry args={[1, 3]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={COLOR.output}
          emissive={COLOR.output}
          emissiveIntensity={0.3}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
      <Text position={[0, -1.5, 0]} fontSize={0.26} color={COLOR.output} anchorX="center" anchorY="middle">
        Output
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Transfer orb: Input → Router
   ──────────────────────────────────────────── */

function InputToRouterFlight({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const trail = useRef(new TrailRing(18));
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const p = phaseT(elapsedRef.current, PHASE.ROUTER);
    if (elapsedRef.current < 0.1) trail.current.reset();

    const visible = p > 0 && p < 0.4;
    const fp = visible ? easeInOut(p / 0.4) : 0;

    if (orbRef.current) {
      if (visible) {
        const x = lerp(POS.input[0], POS.router[0], fp);
        const y = lerp(POS.input[1], POS.router[1], fp) + Math.sin(fp * Math.PI) * 1.5;
        orbRef.current.position.set(x, y, 0);
        orbRef.current.visible = true;
        orbRef.current.scale.setScalar(0.18);
        trail.current.push(x, y, 0);
      } else {
        orbRef.current.visible = false;
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < 18; i++) {
        if (i < ring.length && visible) {
          const pt = ring.get(i);
          dummy.position.set(pt[0], pt[1], pt[2]);
          dummy.scale.setScalar(((18 - i) / 18) * 0.1);
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
          color={COLOR.input}
          emissive={COLOR.input}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, 18]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.input}
          emissive={COLOR.input}
          emissiveIntensity={1}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}

/* ────────────────────────────────────────────
   Transfer orb: Combine → Output
   ──────────────────────────────────────────── */

function CombineToOutputFlight({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const trail = useRef(new TrailRing(15));
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const p = phaseT(elapsedRef.current, PHASE.OUTPUT);
    if (elapsedRef.current < 0.1) trail.current.reset();

    const visible = p > 0 && p < 0.5;
    const fp = visible ? easeInOut(p / 0.5) : 0;

    if (orbRef.current) {
      if (visible) {
        const x = lerp(POS.combine[0], POS.output[0], fp);
        const y = lerp(POS.combine[1], POS.output[1], fp) + Math.sin(fp * Math.PI) * 1;
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
          color={COLOR.combine}
          emissive={COLOR.combine}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh ref={trailRef} args={[undefined, undefined, 15]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.combine}
          emissive={COLOR.combine}
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

export default function MoEScene({ playing, onStepChange, onComplete }: SceneProps) {
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
    if (t >= PHASE.ROUTER[0]) step = 1;
    if (t >= PHASE.SELECT[0]) step = 2;
    if (t >= PHASE.PROCESS[0]) step = 3;
    if (t >= PHASE.COMBINE[0]) step = 4;
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

      <InputToken elapsedRef={elapsedRef} />
      <RouterNetwork elapsedRef={elapsedRef} />
      <ExpertPanels elapsedRef={elapsedRef} />
      <RouterToExpertFlow elapsedRef={elapsedRef} />
      <ExpertProcessFlow elapsedRef={elapsedRef} />
      <WeightedCombine elapsedRef={elapsedRef} />
      <OutputResult elapsedRef={elapsedRef} />

      <InputToRouterFlight elapsedRef={elapsedRef} />
      <CombineToOutputFlight elapsedRef={elapsedRef} />
    </>
  );
}
