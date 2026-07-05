// src/components/Room3DPreview.jsx
import React, { useEffect, useRef } from "react"
import * as THREE from "three"

/* ---------- color helpers ---------- */

function hexToRgb(hex) {
  let h = (hex || "#888888").replace("#", "")
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("")
  }
  const num = parseInt(h, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function rgbToHex(r, g, b) {
  const toHex = (v) => {
    const c = Math.max(0, Math.min(255, Math.round(v)))
    return c.toString(16).padStart(2, "0")
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// lighten (>0) or darken (<0) a hex color
function adjustColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  const f = Math.abs(amount)
  const adj = (v) =>
    amount >= 0 ? v + (255 - v) * f : v * (1 - f)
  return rgbToHex(adj(r), adj(g), adj(b))
}

/* ---------- component ---------- */

function Room3DPreview({ area, color, surfaces, onClose }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !area) return

    // your chosen tones
    const floorColor = surfaces?.floor || color || "#888888"
    const wallColor = surfaces?.walls || floorColor

    // contrast colors derived from wall tone
    const accentWallColor = adjustColor(wallColor, -0.25)   // darker
    const ceilingColor = adjustColor(wallColor, 0.2)       // lighter
    const baseColor = adjustColor(floorColor, -0.5)        // dark base

    // room proportions from blueprint bbox
    const w = area?.bbox?.width || 1
    const h = area?.bbox?.height || 1
    const maxDim = Math.max(w, h)
    const normW = w / maxDim
    const normH = h / maxDim

    // scene + renderer
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#020617")

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding
    }

    const width = canvasRef.current.clientWidth || 800
    const height = canvasRef.current.clientHeight || 300
    renderer.setSize(width, height, false)

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(1.8, 1.4, 1.9) // slightly top-down so floor is visible
    camera.lookAt(0, 0.25, 0)

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambient)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0)
    keyLight.position.set(3, 4, 2)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
    fillLight.position.set(-2, 3, -3)
    scene.add(fillLight)

    // rotating group
    const group = new THREE.Group()
    scene.add(group)

    // base platform
    const baseGeom = new THREE.BoxGeometry(normW + 0.4, 0.04, normH + 0.4)
    const baseMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(baseColor),
      shininess: 5,
    })
    const base = new THREE.Mesh(baseGeom, baseMat)
    base.position.y = -0.06
    group.add(base)

    // floor (exact floor tone)
    const floorGeom = new THREE.PlaneGeometry(normW, normH)
    const floorMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(floorColor),
      shininess: 25,
    })
    const floorMesh = new THREE.Mesh(floorGeom, floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.y = 0
    group.add(floorMesh)

    const wallHeight = 0.65
    const wallThickness = 0.03

    // main walls (your walls tone)
    const mainWallMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(wallColor),
      shininess: 10,
    })

    // accent walls (darker contrast)
    const accentWallMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(accentWallColor),
      shininess: 10,
    })

    // back wall = main wall
    const wallGeomX = new THREE.BoxGeometry(normW, wallHeight, wallThickness)
    const backWall = new THREE.Mesh(wallGeomX, mainWallMat)
    backWall.position.set(0, wallHeight / 2, -normH / 2)

    // left & right = accent
    const wallGeomZ = new THREE.BoxGeometry(wallThickness, wallHeight, normH)
    const leftWall = new THREE.Mesh(wallGeomZ, accentWallMat)
    leftWall.position.set(-normW / 2, wallHeight / 2, 0)

    const rightWall = new THREE.Mesh(wallGeomZ, accentWallMat)
    rightWall.position.set(normW / 2, wallHeight / 2, 0)

    // front is open like a "cut" so floor is clearly visible
    group.add(backWall, leftWall, rightWall)

    // ceiling (lighter walls tone)
    const ceilGeom = new THREE.PlaneGeometry(normW, normH)
    const ceilMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(ceilingColor),
      shininess: 5,
    })
    const ceiling = new THREE.Mesh(ceilGeom, ceilMat)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = wallHeight + 0.03
    group.add(ceiling)

    // animation
    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      group.rotation.y += 0.01
      renderer.render(scene, camera)
    }
    animate()

    // resize
    const handleResize = () => {
      if (!canvasRef.current) return
      const wNew = canvasRef.current.clientWidth || width
      const hNew = canvasRef.current.clientHeight || height
      camera.aspect = wNew / hNew
      camera.updateProjectionMatrix()
      renderer.setSize(wNew, hNew, false)
    }
    window.addEventListener("resize", handleResize)

    // cleanup
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleResize)

      renderer.dispose()
      baseGeom.dispose()
      floorGeom.dispose()
      wallGeomX.dispose()
      wallGeomZ.dispose()
      ceilGeom.dispose()
      baseMat.dispose()
      floorMat.dispose()
      mainWallMat.dispose()
      accentWallMat.dispose()
      ceilMat.dispose()
    }
  }, [area, color, surfaces])

  if (!area) return null

  const chipColor = surfaces?.floor || color || "#888888"

  return (
    <div className="mt-8 bg-[#020617] rounded-3xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full border border-white/60"
            style={{ backgroundColor: chipColor }}
          />
          <div>
            <p className="text-sm font-semibold text-white">
              3D Preview – {area.name || "Selected Area"}
            </p>
            <p className="text-xs text-slate-300">
              Floor uses your floor tone. Back wall uses your wall tone. Side
              walls and base use darker contrast; ceiling is a lighter contrast.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-2xl bg-white/90 text-slate-800 text-xs font-semibold hover:bg-white"
        >
          Close
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-[#020617]">
          <canvas
  id="room-3d-canvas"
  ref={canvasRef}
  className="w-full h-full block"
/>

        </div>
      </div>
    </div>
  )
}

export default Room3DPreview
