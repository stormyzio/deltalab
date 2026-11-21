import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Molecule3DModel } from '@/lib/molecule-3d'

export type Molecule3DStyle = 'ball-stick' | 'space-filling'

const METALLIC_ELEMENTS = new Set([
  'Li', 'Be', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe',
  'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Rb', 'Sr', 'Ag', 'Cd', 'Sn', 'Cs', 'Ba', 'W',
  'Pt', 'Au', 'Hg', 'Pb', 'Bi', 'U',
])

const UP_VEC = new THREE.Vector3(0, 1, 0)

function getBallStickRadius(vdwRadius: number, covalentRadius: number): number {
  return Math.max(0.24, covalentRadius * 0.28 + vdwRadius * 0.19)
}

function getSpaceFillingRadius(vdwRadius: number): number {
  return vdwRadius * 0.96
}

function buildMoleculeGroup(
  model: Molecule3DModel,
  style: Molecule3DStyle,
  sphereGeo: THREE.SphereGeometry,
  cylinderGeo: THREE.CylinderGeometry,
): THREE.Group {
  const group = new THREE.Group()
  const materials = new Map<string, THREE.MeshPhysicalMaterial>()

  const getMaterial = (symbol: string, colorHex: string) => {
    const key = `${symbol}:${colorHex}`
    let mat = materials.get(key)
    if (!mat) {
      const isMetal = METALLIC_ELEMENTS.has(symbol)
      mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colorHex),
        roughness: isMetal ? 0.28 : 0.24,
        metalness: isMetal ? 0.45 : 0.04,
        clearcoat: isMetal ? 0.15 : 0.35,
        clearcoatRoughness: 0.22,
      })
      materials.set(key, mat)
    }
    return mat
  }

  for (const atom of model.atoms) {
    const r =
      style === 'space-filling'
        ? getSpaceFillingRadius(atom.vdwRadius)
        : getBallStickRadius(atom.vdwRadius, atom.covalentRadius)

    const mesh = new THREE.Mesh(sphereGeo, getMaterial(atom.symbol, atom.colorHex))
    mesh.position.set(atom.position.x, atom.position.y, atom.position.z)
    mesh.scale.setScalar(r)
    group.add(mesh)
  }

  if (style === 'ball-stick') {
    const pA = new THREE.Vector3()
    const pB = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const mid = new THREE.Vector3()
    const perp = new THREE.Vector3()
    const quat = new THREE.Quaternion()

    for (const bond of model.bonds) {
      const atomA = model.atoms[bond.fromIndex]
      const atomB = model.atoms[bond.toIndex]
      pA.set(atomA.position.x, atomA.position.y, atomA.position.z)
      pB.set(atomB.position.x, atomB.position.y, atomB.position.z)
      dir.subVectors(pB, pA)
      const len = dir.length()
      if (len < 1e-4) continue

      const dirNorm = dir.clone().divideScalar(len)
      quat.setFromUnitVectors(UP_VEC, dirNorm)

      const refAxis =
        Math.abs(dirNorm.z) < 0.85
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0)
      perp.crossVectors(dirNorm, refAxis).normalize()

      const offsets =
        bond.order === 1
          ? [0]
          : bond.order === 2
            ? [-0.105, 0.105]
            : [-0.145, 0, 0.145]
      const stickRadius =
        bond.order === 1 ? 0.095 : bond.order === 2 ? 0.068 : 0.056

      const matA = getMaterial(atomA.symbol, atomA.colorHex)
      const matB = getMaterial(atomB.symbol, atomB.colorHex)
      const halfLen = len / 2
      mid.addVectors(pA, pB).multiplyScalar(0.5)

      for (const off of offsets) {
        const offVec = perp.clone().multiplyScalar(off)

        const halfA = new THREE.Mesh(cylinderGeo, matA)
        halfA.position.copy(pA).lerp(mid, 0.5).add(offVec)
        halfA.quaternion.copy(quat)
        halfA.scale.set(stickRadius, halfLen, stickRadius)
        group.add(halfA)

        const halfB = new THREE.Mesh(cylinderGeo, matB)
        halfB.position.copy(mid).lerp(pB, 0.5).add(offVec)
        halfB.quaternion.copy(quat)
        halfB.scale.set(stickRadius, halfLen, stickRadius)
        group.add(halfB)
      }
    }
  }

  group.userData.materials = [...materials.values()]
  return group
}

function disposeGroupMaterials(group: THREE.Group | null): void {
  if (!group) return
  const mats = group.userData.materials as THREE.Material[] | undefined
  if (mats) {
    for (const m of mats) m.dispose()
  }
}

export interface Molecule3DStageProps {
  model: Molecule3DModel
  style: Molecule3DStyle
  compact: boolean
  autoRotate: boolean
  resetSignal: number
  onScaleBarChange: (pxPerAngstrom: number) => void
  onWebglError: () => void
  ariaLabel: string
}

export function Molecule3DStage({
  model,
  style,
  compact,
  autoRotate,
  resetSignal,
  onScaleBarChange,
  onWebglError,
  ariaLabel,
}: Molecule3DStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const sphereGeoRef = useRef<THREE.SphereGeometry | null>(null)
  const cylGeoRef = useRef<THREE.CylinderGeometry | null>(null)
  const autoRotateRef = useRef(autoRotate)
  const onScaleBarRef = useRef(onScaleBarChange)
  const onWebglErrorRef = useRef(onWebglError)
  const modelRef = useRef(model)
  const styleRef = useRef(style)
  const lastPxPerARef = useRef(0)
  const lastTopoKeyRef = useRef('')

  useEffect(() => {
    autoRotateRef.current = autoRotate
    onScaleBarRef.current = onScaleBarChange
    onWebglErrorRef.current = onWebglError
    modelRef.current = model
    styleRef.current = style
  }, [autoRotate, onScaleBarChange, onWebglError, model, style])

  const computeIdealCameraDistance = useCallback(
    (m: Molecule3DModel, st: Molecule3DStyle, aspect: number, isCompact: boolean) => {
      const fovDeg = 36
      const fovRad = (fovDeg * Math.PI) / 180
      const molRadius =
        st === 'space-filling' ? m.boundingRadiusVdw : m.boundingRadiusBallStick
      const minBaseline = st === 'space-filling' ? 1.85 : 1.45
      const effectiveRadius = Math.max(minBaseline, molRadius * 1.05 + 0.22)

      const safeV = isCompact ? 0.62 : 0.68
      const safeH = isCompact ? 0.68 : 0.74
      const halfTan = Math.tan(fovRad / 2)
      const halfV = halfTan * safeV
      const halfH = halfTan * Math.max(0.5, aspect) * safeH
      const minHalf = Math.min(halfV, halfH)

      return effectiveRadius / minHalf + molRadius * 0.35
    },
    [],
  )

  const computeIdealCameraPos = useCallback(
    (m: Molecule3DModel, st: Molecule3DStyle, aspect: number, isCompact: boolean) => {
      const dist = computeIdealCameraDistance(m, st, aspect, isCompact)
      const dir = new THREE.Vector3(0.36, 0.28, 1.0).normalize()
      return dir.multiplyScalar(dist)
    },
    [computeIdealCameraDistance],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      onWebglErrorRef.current()
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x1c1c22, 0.9)
    scene.add(hemi)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55)
    keyLight.position.set(5, 7, 8)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.55)
    fillLight.position.set(-7, -2, 5)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.72)
    rimLight.position.set(0, 5, -8)
    scene.add(rimLight)

    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    const initialAspect = width / height
    const camera = new THREE.PerspectiveCamera(36, initialAspect, 0.1, 250)
    const initialPos = computeIdealCameraPos(
      modelRef.current,
      styleRef.current,
      initialAspect,
      compact,
    )
    camera.position.copy(initialPos)
    cameraRef.current = camera
    renderer.setSize(width, height, false)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 2.0
    controls.maxDistance = 140
    controls.rotateSpeed = 0.75
    controls.zoomSpeed = 0.85
    controls.target.set(0, 0, 0)
    controls.autoRotate = autoRotateRef.current
    controls.autoRotateSpeed = 1.4
    controls.update()
    controls.saveState()
    controlsRef.current = controls

    const sphereGeo = new THREE.SphereGeometry(1, 32, 24)
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false)
    sphereGeoRef.current = sphereGeo
    cylGeoRef.current = cylGeo

    let lastAspect = width / height
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const rawW = Math.floor(entry.contentRect.width)
      const rawH = Math.floor(entry.contentRect.height)
      if (rawW < 2 || rawH < 2) return
      const nextAspect = rawW / rawH
      camera.aspect = nextAspect
      camera.updateProjectionMatrix()
      renderer.setSize(rawW, rawH, false)

      if (Math.abs(nextAspect - lastAspect) > 0.08) {
        lastAspect = nextAspect
        const targetDist = computeIdealCameraDistance(
          modelRef.current,
          styleRef.current,
          nextAspect,
          compact,
        )
        const dir = camera.position.clone().sub(controls.target)
        if (dir.lengthSq() > 1e-4) {
          dir.normalize().multiplyScalar(targetDist)
          camera.position.copy(controls.target).add(dir)
          controls.update()
        }
      }
    })
    ro.observe(container)

    let rafId = 0
    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const wPx = container.clientWidth
      const hPx = container.clientHeight
      if (wPx < 2 || hPx < 2) return
      controls.autoRotate = autoRotateRef.current
      controls.update()
      renderer.render(scene, camera)

      const dist = camera.position.distanceTo(controls.target)
      const visibleHeightA =
        2 * dist * Math.tan((camera.fov * Math.PI) / 360)
      const pxPerA = visibleHeightA > 1e-4 ? hPx / visibleHeightA : 0
      if (Math.abs(pxPerA - lastPxPerARef.current) > 0.6) {
        lastPxPerARef.current = pxPerA
        onScaleBarRef.current(pxPerA)
      }
    }
    tick()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      controls.dispose()
      if (groupRef.current) {
        scene.remove(groupRef.current)
        disposeGroupMaterials(groupRef.current)
        groupRef.current = null
      }
      sphereGeo.dispose()
      cylGeo.dispose()
      sphereGeoRef.current = null
      cylGeoRef.current = null
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      lastTopoKeyRef.current = ''
    }
  }, [compact, computeIdealCameraDistance, computeIdealCameraPos])

  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    const sphereGeo = sphereGeoRef.current
    const cylGeo = cylGeoRef.current
    if (!scene || !camera || !controls || !sphereGeo || !cylGeo) return

    if (groupRef.current) {
      scene.remove(groupRef.current)
      disposeGroupMaterials(groupRef.current)
      groupRef.current = null
    }

    const nextGroup = buildMoleculeGroup(model, style, sphereGeo, cylGeo)
    scene.add(nextGroup)
    groupRef.current = nextGroup

    const topoKey = `${model.atoms.map((a) => `${a.id}:${a.symbol}:${a.charge}`).join('|')}__${model.bonds.map((b) => `${b.fromIndex}-${b.toIndex}:${b.order}`).join('|')}__${model.geometryLabelFr ?? ''}__${style}`
    if (topoKey !== lastTopoKeyRef.current) {
      lastTopoKeyRef.current = topoKey
      const idealPos = computeIdealCameraPos(model, style, camera.aspect || 1.4, compact)
      camera.position.copy(idealPos)
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [model, style, compact, computeIdealCameraPos])

  useEffect(() => {
    if (resetSignal === 0) return
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const idealPos = computeIdealCameraPos(model, style, camera.aspect || 1.4, compact)
    camera.position.copy(idealPos)
    controls.target.set(0, 0, 0)
    controls.update()
  }, [resetSignal, model, style, compact, computeIdealCameraPos])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
    />
  )
}
