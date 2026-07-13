"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Icosahedron, Torus, Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

const NEON = "#4ade80";
const NEON_DIM = "#22c55e";
const AMBER = "#fbbf24";

/** Параллакс-камера: плавно тянется за курсором */
function CameraRig({ compact }: { compact?: boolean }) {
  const base = useMemo(() => new THREE.Vector3(0, 0.4, compact ? 6.5 : 7.5), [compact]);
  useFrame(({ camera, pointer }, delta) => {
    const target = new THREE.Vector3(
      base.x + pointer.x * 0.6,
      base.y + pointer.y * 0.35,
      base.z
    );
    camera.position.lerp(target, Math.min(delta * 2.5, 1));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Ядро: wireframe-кристалл + пульсирующее светящееся ядро + внутренний свет */
function CoreCrystal() {
  const outer = useRef<THREE.Mesh>(null);
  const mid = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const innerMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    const pulse = Math.sin(t * 1.6);
    if (outer.current) {
      outer.current.rotation.y = t * 0.18 + pointer.x * 0.4;
      outer.current.rotation.x = Math.sin(t * 0.22) * 0.18 + pointer.y * -0.25;
    }
    if (mid.current) {
      mid.current.rotation.y = -t * 0.26;
      mid.current.rotation.x = t * 0.1;
    }
    if (inner.current) {
      inner.current.rotation.y = -t * 0.35;
      inner.current.rotation.z = t * 0.15;
      inner.current.scale.setScalar((1 + pulse * 0.06) * 0.55);
    }
    if (innerMat.current) innerMat.current.emissiveIntensity = 1.8 + pulse * 0.7;
    if (light.current) light.current.intensity = 9 + pulse * 4;
  });

  return (
    <group>
      <pointLight ref={light} color={NEON} intensity={9} distance={7} />
      <Icosahedron ref={outer} args={[1.6, 1]}>
        <meshBasicMaterial color={NEON} wireframe transparent opacity={0.5} />
      </Icosahedron>
      <Icosahedron ref={mid} args={[1.25, 1]}>
        <meshBasicMaterial color={NEON_DIM} wireframe transparent opacity={0.18} />
      </Icosahedron>
      <Icosahedron ref={inner} args={[1, 0]}>
        <meshStandardMaterial
          ref={innerMat}
          color={NEON_DIM}
          emissive={NEON}
          emissiveIntensity={1.8}
          roughness={0.2}
          metalness={0.4}
        />
      </Icosahedron>
    </group>
  );
}

/** Мелкие светящиеся осколки, вращающиеся вокруг ядра */
function OrbitingShards({ count = 7 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const shards = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        radius: 2 + (i % 3) * 0.35,
        speed: 0.25 + (i % 4) * 0.08,
        phase: (i / count) * Math.PI * 2,
        y: ((i % 5) - 2) * 0.28,
        size: 0.05 + (i % 3) * 0.03,
        amber: i % 3 === 0,
      })),
    [count]
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    shards.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      const a = s.phase + t * s.speed;
      m.position.set(Math.cos(a) * s.radius, s.y + Math.sin(t * 0.8 + s.phase) * 0.15, Math.sin(a) * s.radius);
      m.rotation.x = t * 0.9 + s.phase;
      m.rotation.y = t * 0.7;
    });
  });

  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <octahedronGeometry args={[s.size, 0]} />
          <meshStandardMaterial
            color={s.amber ? AMBER : NEON_DIM}
            emissive={s.amber ? AMBER : NEON}
            emissiveIntensity={1.4}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Кометы: редкие частицы, пролетающие через сцену со шлейфом */
function Comets({ count = 3 }: { count?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        speed: 1.6 + i * 0.5,
        offset: i * 4.2,
        y: 1.2 - i * 1.1,
        z: -2 - i * 1.2,
      })),
    [count]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    seeds.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      // Пролёт слева направо с телепортом обратно
      const x = ((t * s.speed + s.offset) % 16) - 8;
      m.position.set(x, s.y + Math.sin(x * 0.6) * 0.3, s.z);
      const mat = m.material as THREE.MeshBasicMaterial;
      // Затухание у краёв
      mat.opacity = Math.max(0, 1 - Math.abs(x) / 7);
    });
  });

  return (
    <>
      {seeds.map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color={i % 2 ? AMBER : NEON} transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  );
}

function OrbitRings() {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  const g3 = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (g1.current) g1.current.rotation.z = t * 0.12;
    if (g2.current) g2.current.rotation.z = -t * 0.08;
    if (g3.current) g3.current.rotation.z = t * 0.05;
  });

  return (
    <>
      <group ref={g1} rotation={[Math.PI / 2.4, 0.4, 0]}>
        <Torus args={[2.5, 0.006, 8, 128]}>
          <meshBasicMaterial color={NEON} transparent opacity={0.35} />
        </Torus>
        <mesh position={[2.5, 0, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={AMBER} />
        </mesh>
      </group>
      <group ref={g2} rotation={[Math.PI / 1.8, -0.5, 0.3]}>
        <Torus args={[3.1, 0.004, 8, 128]}>
          <meshBasicMaterial color={NEON} transparent opacity={0.2} />
        </Torus>
        <mesh position={[-3.1, 0, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={NEON} />
        </mesh>
      </group>
      <group ref={g3} rotation={[Math.PI / 2.1, 0.9, -0.2]}>
        <Torus args={[3.7, 0.003, 8, 128]}>
          <meshBasicMaterial color={AMBER} transparent opacity={0.12} />
        </Torus>
      </group>
    </>
  );
}

function GridFloor() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(30, 46, new THREE.Color(NEON), new THREE.Color(NEON));
    const mat = g.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = 0.07;
    return g;
  }, []);
  return <primitive object={grid} position={[0, -2.6, 0]} />;
}

function SceneContent({ compact }: { compact?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 4, 4]} intensity={40} color={NEON} />
      <pointLight position={[-4, -2, -3]} intensity={12} color={AMBER} />

      <CameraRig compact={compact} />

      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.9}>
        <CoreCrystal />
      </Float>
      <OrbitingShards count={compact ? 5 : 8} />
      <OrbitRings />
      {!compact && <Comets count={3} />}
      <Sparkles count={compact ? 40 : 90} scale={[9, 6, 6]} size={2.2} speed={0.35} color={NEON} opacity={0.7} />
      <Sparkles count={compact ? 12 : 28} scale={[10, 7, 6]} size={3.5} speed={0.2} color={AMBER} opacity={0.4} />
      {!compact && <Stars radius={40} depth={20} count={900} factor={2.5} saturation={0} fade speed={0.6} />}
      {!compact && <GridFloor />}
      <fog attach="fog" args={["#0a120d", 7, 16]} />

      <EffectComposer>
        <Bloom
          intensity={compact ? 0.55 : 0.85}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.65}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={compact ? 0.4 : 0.6} />
      </EffectComposer>
    </>
  );
}

/**
 * Неоновая 3D-сцена: пульсирующий кристалл-ядро, орбитальные кольца и осколки,
 * кометы, звёздное поле, bloom-свечение и параллакс камеры за курсором.
 * compact — облегчённый вариант для встраивания в hero-карточки.
 */
export function NeonScene({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, compact ? 6.5 : 7.5], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SceneContent compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}
