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
  TrailRing,
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
   User Node — the human who submits a task
   ──────────────────────────────────────────── */

function UserNode({ elapsedRef }: { elapsedRef: ElRef }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = clock.elapsedTime * 0.3;
      ringRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <group position={POS.user}>
      <pointLight color={COLOR.user} intensity={0.5} distance={6} />
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.user}
          emissive={COLOR.user}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.8, 0.06, 8, 32]} />
        <meshStandardMaterial
          color={COLOR.user}
          emissive={COLOR.user}
          emissiveIntensity={0.5}
        />
      </mesh>
      <Text
        position={[0, -1.3, 0]}
        fontSize={0.28}
        color={COLOR.user}
        anchorX="center"
        anchorY="middle"
      >
        User
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Task Cube — flies from User to Brain
   ──────────────────────────────────────────── */

function TaskFlight({ elapsedRef }: { elapsedRef: ElRef }) {
  const cubeRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const TRAIL = 20;
  const trail = useRef(new TrailRing(TRAIL));
  const _pos = useRef<V3>([0, 0, 0]);

  function computePos(t: number): boolean {
    const p = phaseT(t, PHASE.TASK);
    if (p <= 0.05 || p >= 0.95) return false;
    const e = easeInOut(p);
    _pos.current[0] = lerp(POS.user[0], POS.brain[0], e);
    _pos.current[1] =
      lerp(POS.user[1], POS.brain[1], e) + Math.sin(e * Math.PI) * 2.5;
    _pos.current[2] = Math.sin(e * Math.PI * 2) * 0.5;
    return true;
  }

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const hasPos = computePos(t);
    const cur = _pos.current;
    if (t < 0.1) trail.current.reset();

    if (cubeRef.current) {
      if (hasPos) {
        cubeRef.current.position.set(cur[0], cur[1], cur[2]);
        cubeRef.current.visible = true;
        cubeRef.current.rotation.x = clock.elapsedTime * 2;
        cubeRef.current.rotation.y = clock.elapsedTime * 1.5;
        cubeRef.current.scale.setScalar(
          0.35 + Math.sin(clock.elapsedTime * 8) * 0.04
        );
      } else {
        cubeRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      lightRef.current.position.set(cur[0], cur[1], cur[2]);
      lightRef.current.intensity = hasPos ? 3 : 0;
    }

    if (labelRef.current) {
      if (hasPos && t < 2.5) {
        labelRef.current.position.set(cur[0], cur[1] + 0.8, cur[2]);
        labelRef.current.visible = true;
      } else {
        labelRef.current.visible = false;
      }
    }

    if (hasPos) {
      const ring = trail.current;
      if (ring.length === 0) {
        ring.push(cur[0], cur[1], cur[2]);
      } else {
        const last = ring.get(0);
        const dx = cur[0] - last[0];
        const dy = cur[1] - last[1];
        if (dx * dx + dy * dy > 0.01) {
          ring.push(cur[0], cur[1], cur[2]);
        }
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && hasPos) {
          const pt = ring.get(i);
          dummy.position.set(pt[0], pt[1], pt[2]);
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
          color={COLOR.task}
          emissive={COLOR.task}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.task}
        intensity={0}
        distance={6}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.task}
          emissive={COLOR.task}
          emissiveIntensity={1}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.32}
          color={COLOR.task}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Task
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Brain / Planning Node — decomposes task
   Shows sub-cubes bursting out during planning
   ──────────────────────────────────────────── */

const SUB_CUBE_COUNT = 8;
const SUB_CUBES = Array.from({ length: SUB_CUBE_COUNT }, (_, i) => {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / SUB_CUBE_COUNT);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    dx: Math.sin(phi) * Math.cos(theta),
    dy: Math.sin(phi) * Math.sin(theta),
    dz: Math.cos(phi),
  };
});

function SubCube({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pt = SUB_CUBES[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.PLAN);

    if (p <= 0 || p >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    if (p < 0.5) {
      // Burst outward from brain
      const bp = easeOut(p / 0.5);
      meshRef.current.position.set(
        POS.brain[0] + pt.dx * bp * 2.5,
        POS.brain[1] + pt.dy * bp * 2.5,
        POS.brain[2] + pt.dz * bp * 2.5
      );
      meshRef.current.scale.setScalar(0.12 + bp * 0.1);
    } else {
      // Orbit around brain
      const op = (p - 0.5) / 0.5;
      const angle = op * Math.PI * 2 + index * ((Math.PI * 2) / SUB_CUBE_COUNT);
      const r = 2.0 + Math.sin(clock.elapsedTime * 2 + index) * 0.3;
      meshRef.current.position.set(
        POS.brain[0] + Math.cos(angle) * r,
        POS.brain[1] + pt.dy * 1.5 + Math.sin(clock.elapsedTime + index) * 0.3,
        POS.brain[2] + Math.sin(angle) * r * 0.6
      );
      meshRef.current.scale.setScalar(0.18);
    }

    meshRef.current.rotation.x = clock.elapsedTime * 1.5 + index;
    meshRef.current.rotation.y = clock.elapsedTime * 2 + index * 0.5;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={COLOR.plan}
        emissive={COLOR.plan}
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function BrainNode({ elapsedRef }: { elapsedRef: ElRef }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const time = clock.elapsedTime;
    const planP = phaseT(t, PHASE.PLAN);
    const taskP = phaseT(t, PHASE.TASK);
    const obsP = phaseT(t, PHASE.OBSERVE);
    const activity = Math.max(planP, taskP * 0.4, obsP * 0.6);

    if (outerRef.current) {
      outerRef.current.rotation.y = time * (0.15 + activity * 0.5);
      outerRef.current.rotation.x = Math.sin(time * 0.3) * 0.15;
      outerRef.current.scale.setScalar(1 + activity * 0.25);
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -time * 0.4;
      innerRef.current.rotation.z = time * 0.3;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.3 + activity * 4;
    }
  });

  return (
    <group position={POS.brain}>
      <pointLight
        ref={lightRef}
        color={COLOR.brain}
        intensity={0.3}
        distance={8}
      />
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.1, 3]} />
        <meshStandardMaterial
          color={COLOR.brain}
          emissive={COLOR.brain}
          emissiveIntensity={0.3}
          transparent
          opacity={0.55}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={COLOR.brain}
          emissive={COLOR.brain}
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
      {/* Sub-cubes for planning phase */}
      {SUB_CUBES.map((_, i) => (
        <SubCube key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <Text
        position={[0, -2, 0]}
        fontSize={0.28}
        color={COLOR.brain}
        anchorX="center"
        anchorY="middle"
      >
        Agent Brain
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Tool Nodes — Search, Code, API
   Three tools that glow when selected
   ──────────────────────────────────────────── */

function ToolNode({
  position,
  label,
  geoType,
  elapsedRef,
  activateAt,
}: {
  position: V3;
  label: string;
  geoType: "search" | "code" | "api";
  elapsedRef: ElRef;
  activateAt: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const toolP = phaseT(t, PHASE.TOOL);
    const execP = phaseT(t, PHASE.EXEC);
    const time = clock.elapsedTime;

    // Activation: tool lights up when selected
    const activateP = clamp01((toolP - activateAt) / 0.25);
    const active = easeOut(activateP);
    const firing = execP > 0 && execP < 0.8 ? Math.sin(time * 6) * 0.5 + 0.5 : 0;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(0.5 + active * 0.3 + firing * 0.15);
      meshRef.current.rotation.y = time * 0.5;
      meshRef.current.rotation.x = time * 0.3;
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(active);
      ringRef.current.rotation.z = time * 1.5;
      ringRef.current.visible = active > 0.01;
    }
    if (lightRef.current) {
      lightRef.current.intensity = active * 2 + firing * 3;
    }
  });

  const geometry = useMemo(() => {
    if (geoType === "search") return <octahedronGeometry args={[1, 0]} />;
    if (geoType === "code") return <boxGeometry args={[1, 1.2, 0.4]} />;
    return <dodecahedronGeometry args={[0.8, 0]} />;
  }, [geoType]);

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color={COLOR.tool}
        intensity={0}
        distance={5}
      />
      <mesh ref={meshRef}>
        {geometry}
        <meshStandardMaterial
          color={COLOR.tool}
          emissive={COLOR.tool}
          emissiveIntensity={0.4}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[1.0, 0.04, 8, 24]} />
        <meshStandardMaterial
          color={COLOR.exec}
          emissive={COLOR.exec}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, -1.2, 0]}
        fontSize={0.22}
        color={COLOR.tool}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

/* ────────────────────────────────────────────
   Execution Arrows — fly from tools outward
   ──────────────────────────────────────────── */

const ARROW_COUNT = 6;
const ARROWS = Array.from({ length: ARROW_COUNT }, (_, i) => {
  const fromTool = i % 3; // 0=A, 1=B, 2=C
  const toolPos = fromTool === 0 ? POS.toolA : fromTool === 1 ? POS.toolB : POS.toolC;
  const angle = ((i * 60 + 30) * Math.PI) / 180;
  return {
    start: toolPos,
    end: [
      toolPos[0] + Math.cos(angle) * 4,
      toolPos[1] + (Math.random() - 0.5) * 2,
      toolPos[2] + Math.sin(angle) * 3,
    ] as V3,
    delay: i * 0.08,
  };
});

function ExecArrow({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = ARROWS[index];

  useFrame(() => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.EXEC);

    if (p <= 0 || p >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeOut(clamp01((p - item.delay) / (0.7)));
    meshRef.current.position.set(
      lerp(item.start[0], item.end[0], ip),
      lerp(item.start[1], item.end[1], ip) + Math.sin(ip * Math.PI) * 1,
      lerp(item.start[2], item.end[2], ip)
    );
    meshRef.current.scale.set(0.12, 0.12, 0.3 + ip * 0.2);
    meshRef.current.lookAt(item.end[0], item.end[1], item.end[2]);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <coneGeometry args={[1, 2, 4]} />
      <meshStandardMaterial
        color={COLOR.exec}
        emissive={COLOR.exec}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

/* ────────────────────────────────────────────
   Observation Loop — data streams back to brain
   The key visual: showing feedback loop
   ──────────────────────────────────────────── */

const OBS_COUNT = 12;
const OBS_PARTICLES = Array.from({ length: OBS_COUNT }, (_, i) => ({
  delay: i * 0.06,
  offset: (i / OBS_COUNT) * Math.PI * 2,
}));

function ObsParticle({
  index,
  elapsedRef,
}: {
  index: number;
  elapsedRef: ElRef;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const item = OBS_PARTICLES[index];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.OBSERVE);

    if (p <= 0 || p >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const ip = easeInOut(clamp01((p - item.delay) / (1 - item.delay * 1.5)));

    // Arc from tools area back to brain (loop)
    const midX = (POS.tools[0] + POS.brain[0]) / 2;
    const midY = (POS.tools[1] + POS.brain[1]) / 2 + 3;
    const x = lerp(POS.tools[0], POS.brain[0], ip);
    const y =
      lerp(POS.tools[1], POS.brain[1], ip) +
      Math.sin(ip * Math.PI) * 3.5 +
      Math.sin(clock.elapsedTime * 3 + item.offset) * 0.3;
    const z =
      Math.sin(ip * Math.PI * 1.5 + item.offset) * 1.5;

    meshRef.current.position.set(x, y, z);
    meshRef.current.scale.setScalar(0.08 + Math.sin(ip * Math.PI) * 0.05);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={COLOR.observe}
        emissive={COLOR.observe}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function ObservationLoop({ elapsedRef }: { elapsedRef: ElRef }) {
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!labelRef.current) return;
    const p = phaseT(elapsedRef.current, PHASE.OBSERVE);
    labelRef.current.visible = p > 0.15 && p < 0.85;
  });

  return (
    <group>
      {OBS_PARTICLES.map((_, i) => (
        <ObsParticle key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <group ref={labelRef} visible={false} position={[0.5, 4.5, 0]}>
        <Text
          fontSize={0.3}
          color={COLOR.observe}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Observation Loop
        </Text>
      </group>
    </group>
  );
}

/* ────────────────────────────────────────────
   Loop Arc Line — visible arc from tools to brain
   ──────────────────────────────────────────── */

function LoopArc({ elapsedRef }: { elapsedRef: ElRef }) {
  const lineRef = useRef<THREE.Line>(null);

  const lineObj = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = lerp(POS.tools[0], POS.brain[0], t);
      const y = lerp(POS.tools[1], POS.brain[1], t) + Math.sin(t * Math.PI) * 3.5;
      const z = Math.sin(t * Math.PI * 1.5) * 1.2;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({
      color: COLOR.loop,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    return line;
  }, []);

  useFrame(() => {
    const mat = lineObj.material as THREE.LineBasicMaterial;
    const obsP = phaseT(elapsedRef.current, PHASE.OBSERVE);
    mat.opacity = obsP > 0 && obsP < 1 ? 0.25 : 0;
  });

  return <primitive object={lineObj} />;
}

/* ────────────────────────────────────────────
   Result Return — final orb arcs to user
   ──────────────────────────────────────────── */

function ResultReturn({ elapsedRef }: { elapsedRef: ElRef }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const TRAIL = 25;
  const trail = useRef(new TrailRing(TRAIL));
  const _pos = useRef<V3>([0, 0, 0]);

  function computePos(t: number): boolean {
    const p = phaseT(t, PHASE.RESULT);
    if (p <= 0 || p >= 1) return false;
    const e = easeInOut(p);
    _pos.current[0] = lerp(POS.brain[0], POS.result[0], e);
    _pos.current[1] = Math.sin(e * Math.PI) * 4;
    _pos.current[2] = Math.sin(e * Math.PI) * 2;
    return true;
  }

  useFrame(({ clock }) => {
    const t = elapsedRef.current;
    const hasPos = computePos(t);
    const cur = _pos.current;
    if (t < 0.1) trail.current.reset();

    if (orbRef.current) {
      if (hasPos) {
        orbRef.current.position.set(cur[0], cur[1], cur[2]);
        orbRef.current.visible = true;
        orbRef.current.scale.setScalar(
          0.4 + Math.sin(clock.elapsedTime * 10) * 0.05
        );
      } else {
        orbRef.current.visible = false;
      }
    }

    if (lightRef.current) {
      lightRef.current.position.set(cur[0], cur[1], cur[2]);
      lightRef.current.intensity = hasPos ? 5 : 0;
    }

    if (labelRef.current) {
      if (hasPos) {
        labelRef.current.position.set(cur[0], cur[1] + 0.9, cur[2]);
        labelRef.current.visible = true;
      } else {
        labelRef.current.visible = false;
      }
    }

    if (hasPos) {
      const ring = trail.current;
      if (ring.length === 0) {
        ring.push(cur[0], cur[1], cur[2]);
      } else {
        const last = ring.get(0);
        const dx = cur[0] - last[0];
        const dy = cur[1] - last[1];
        if (dx * dx + dy * dy > 0.005) {
          ring.push(cur[0], cur[1], cur[2]);
        }
      }
    }

    if (trailRef.current) {
      const ring = trail.current;
      for (let i = 0; i < TRAIL; i++) {
        if (i < ring.length && hasPos) {
          const pt = ring.get(i);
          dummy.position.set(pt[0], pt[1], pt[2]);
          dummy.scale.setScalar(((TRAIL - i) / TRAIL) * 0.18);
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
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={COLOR.result}
          emissive={COLOR.result}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={COLOR.result}
        intensity={0}
        distance={8}
      />
      <instancedMesh ref={trailRef} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color={COLOR.result}
          emissive={COLOR.result}
          emissiveIntensity={1.2}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={labelRef} visible={false}>
        <Text
          fontSize={0.35}
          color={COLOR.result}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Result
        </Text>
      </group>
    </>
  );
}

/* ────────────────────────────────────────────
   Connection Lines (faint guides)
   ──────────────────────────────────────────── */

function ConnectionLines() {
  const lineObj = useMemo(() => {
    const pts = [POS.user, POS.brain, POS.tools, POS.result].map(
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

export default function AgentsScene({
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
    if (t >= PHASE.TASK[0]) step = 0;
    if (t >= PHASE.PLAN[0]) step = 1;
    if (t >= PHASE.TOOL[0]) step = 2;
    if (t >= PHASE.EXEC[0]) step = 3;
    if (t >= PHASE.OBSERVE[0]) step = 4;
    if (t >= PHASE.RESULT[0]) step = 5;

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
      <UserNode elapsedRef={elapsedRef} />
      <BrainNode elapsedRef={elapsedRef} />
      <ToolNode
        position={POS.toolA}
        label="Search"
        geoType="search"
        elapsedRef={elapsedRef}
        activateAt={0.0}
      />
      <ToolNode
        position={POS.toolB}
        label="Code"
        geoType="code"
        elapsedRef={elapsedRef}
        activateAt={0.3}
      />
      <ToolNode
        position={POS.toolC}
        label="API"
        geoType="api"
        elapsedRef={elapsedRef}
        activateAt={0.6}
      />

      {/* Animated flow */}
      <TaskFlight elapsedRef={elapsedRef} />
      {ARROWS.map((_, i) => (
        <ExecArrow key={i} index={i} elapsedRef={elapsedRef} />
      ))}
      <ObservationLoop elapsedRef={elapsedRef} />
      <LoopArc elapsedRef={elapsedRef} />
      <ResultReturn elapsedRef={elapsedRef} />
    </>
  );
}
