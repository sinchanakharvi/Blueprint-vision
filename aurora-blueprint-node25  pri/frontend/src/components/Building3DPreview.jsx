// src/components/Building3DPreview.jsx
import React, { useEffect, useRef, useState } from "react"
import * as THREE from "three"

/**
 * 3D building that approximates the blueprint:
 * - One outer "building" block based on the union of all room bboxes
 * - Inner colored blocks for each room at their positions
 */
function Building3DPreview({
  areas = [],
  colorsById = {},
  imageWidth,
  imageHeight,
}) {
  const canvasRef = useRef(null)
  const [mode, setMode] = useState("ai") // "ai" | "original"

  useEffect(() => {
    if (!canvasRef.current || !areas.length) return

    // --- 1. Compute overall blueprint bounds from room bboxes ---
    const imgW = imageWidth || 1000
    const imgH = imageHeight || 1000

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    areas.forEach((area) => {
      const b = area.bbox || {}
      if (b.width && b.height) {
        minX = Math.min(minX, b.x || 0)
        minY = Math.min(minY, b.y || 0)
        maxX = Math.max(maxX, (b.x || 0) + b.width)
        maxY = Math.max(maxY, (b.y || 0) + b.height)
      }
    })

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return
    }

    const planWidth = maxX - minX
    const planHeight = maxY - minY
    const maxDim = Math.max(planWidth, planHeight)

    // how many blueprint pixels become 1 world unit
    const scale = maxDim / 4 // adjust to change overall size

    // --- 2. Three.js setup ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#f3f4f6")

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
    const height = canvasRef.current.clientHeight || 360
    renderer.setSize(width, height, false)

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(4, 4, 4)
    camera.lookAt(0, 0.7, 0)

    const ambient = new THREE.AmbientLight(0xffffff, 0.9)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(5, 6, 4)
    scene.add(ambient, dir)

    const group = new THREE.Group()
    scene.add(group)

    // --- 3. Ground slab (slightly bigger than building) ---
    const slabWidth = planWidth / scale + 0.8
    const slabDepth = planHeight / scale + 0.8
    const slabGeom = new THREE.BoxGeometry(slabWidth, 0.05, slabDepth)
    const slabMat = new THREE.MeshPhongMaterial({
      color: "#e5e7eb",
      shininess: 5,
    })
    const slab = new THREE.Mesh(slabGeom, slabMat)
    slab.position.y = -0.03
    group.add(slab)

    // --- 4. Outer building shell (looks like full building) ---
    const buildingWidth = planWidth / scale
    const buildingDepth = planHeight / scale
    const buildingHeight = 1.2 // height of the “house”

    const buildingGeom = new THREE.BoxGeometry(
      buildingWidth,
      buildingHeight,
      buildingDepth
    )
    const buildingMat = new THREE.MeshPhongMaterial({
      color: "#d4d4d8",
      shininess: 10,
      transparent: true,
      opacity: 0.85, // a bit see-through so we can see colored rooms
    })
    const building = new THREE.Mesh(buildingGeom, buildingMat)
    building.position.set(0, buildingHeight / 2, 0)
    group.add(building)

    // --- 5. Rooms inside the building, placed by blueprint position ---
    const floorHeight = 0.05      // how high above slab the floor is
    const roomExtrudeHeight = 0.55 // height of each room block inside

    areas.forEach((area) => {
      const b = area.bbox || {}
      if (!b.width || !b.height) return

      const roomW = b.width / scale
      const roomD = b.height / scale

      // center position of room in blueprint coordinates
      const cx = (b.x || 0) + b.width / 2
      const cy = (b.y || 0) + b.height / 2

      // convert blueprint coords to world (centered on building)
      const relX = cx - (minX + planWidth / 2)
      const relY = cy - (minY + planHeight / 2)

      const worldX = relX / scale
      const worldZ = -relY / scale

      const aiColor = colorsById[area.id]
      const wallColor =
        mode === "ai" && aiColor ? aiColor : "#cbd5e1"

      const geom = new THREE.BoxGeometry(roomW, roomExtrudeHeight, roomD)
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(wallColor),
        shininess: 20,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(worldX, floorHeight + roomExtrudeHeight / 2, worldZ)
      group.add(mesh)
    })

    // --- 6. Simple rotation animation ---
    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      group.rotation.y += 0.004
      renderer.render(scene, camera)
    }
    animate()

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
      slabGeom.dispose()
      buildingGeom.dispose()
      slabMat.dispose()
      buildingMat.dispose()
    }
  }, [areas, colorsById, imageWidth, imageHeight, mode])

  if (!areas.length) return null

  return (
    <div className="mt-10 bg-white rounded-3xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            3D Building Preview
          </h2>
          <p className="text-[11px] text-slate-500">
            Drag to rotate · Scroll to zoom · Rooms are placed inside a single
            building volume based on the blueprint layout.
          </p>
        </div>

        <div className="flex text-xs bg-slate-100 rounded-full p-1">
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`px-3 py-1 rounded-full font-semibold ${
              mode === "ai"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            3D Model
          </button>
          <button
            type="button"
            onClick={() => setMode("original")}
            className={`px-3 py-1 rounded-full font-semibold ${
              mode === "original"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Compare
          </button>
        </div>
      </div>

      <div className="w-full h-72 bg-slate-100 rounded-2xl overflow-hidden">
        <canvas
          id="building-3d-canvas"
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        The grey shell is the full building footprint from your blueprint.
        Colored blocks inside show each detected room using your AI-selected
        tones.{" "}
        <span className="font-semibold">3D Model</span> shows AI colors,{" "}
        <span className="font-semibold">Compare</span> uses a neutral scheme.
      </p>
    </div>
  )
}

export default Building3DPreview
