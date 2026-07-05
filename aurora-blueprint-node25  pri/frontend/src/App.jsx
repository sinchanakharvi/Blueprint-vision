// src/App.jsx
import React, { useState } from "react"
import axios from "axios"

import BlueprintCanvas from "./components/BlueprintCanvas"
import RoomList from "./components/RoomList"
import UploadPanel from "./components/UploadPanel"
import Room3DPreview from "./components/Room3DPreview"
import Building3DPreview from "./components/Building3DPreview"
import ColorSelectionPanel from "./components/ColorSelectionPanel"
import DownloadOptions from "./components/DownloadOptions"
import TotalBudget from "./components/TotalBudget"

/* ---------------- Color helpers ---------------- */

function getBaseColorForArea(name = "") {
  const n = name.toLowerCase()
  if (n.includes("kitchen")) return "#FFB65C"
  if (n.includes("bath") || n.includes("ensuite")) return "#7FD3FF"
  if (n.includes("bed")) return "#B794F4"
  if (n.includes("living")) return "#F6E05E"
  return "#A0AEC0"
}

function hexToRgb(hex) {
  let h = (hex || "#888888").replace("#", "")
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
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

// generate N shades between two hex colors (light → dark)
function generateShades(lightHex, darkHex, count) {
  const start = hexToRgb(lightHex)
  const end = hexToRgb(darkHex)
  const shades = []

  if (count <= 1) {
    shades.push(lightHex)
    return shades
  }

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const r = start.r + (end.r - start.r) * t
    const g = start.g + (end.g - start.g) * t
    const b = start.b + (end.b - start.b) * t
    shades.push(rgbToHex(r, g, b))
  }

  return shades
}

/* ---------------- AI palettes (50 shades each) ---------------- */

const SHADES_PER_PALETTE = 50

function getPalettesForArea(name = "") {
  const n = name.toLowerCase()

  const warm = {
    title: "Warm Embrace",
    colors: generateShades("#FFF8EC", "#AD3900", SHADES_PER_PALETTE),
  }

  const cozyNeutrals = {
    title: "Cozy Neutrals",
    colors: generateShades("#F7F4ED", "#281D12", SHADES_PER_PALETTE),
  }

  const coolBreeze = {
    title: "Cool Breeze",
    colors: generateShades("#F3FAFF", "#0F3868", SHADES_PER_PALETTE),
  }

  const sereneNight = {
    title: "Serene Night",
    colors: generateShades("#F6F4FF", "#351F77", SHADES_PER_PALETTE),
  }

  const spaFresh = {
    title: "Spa Fresh",
    colors: generateShades("#F2FBF7", "#0F4637", SHADES_PER_PALETTE),
  }

  const cleanWhite = {
    title: "Clean Minimal",
    colors: generateShades("#FFFFFF", "#111827", SHADES_PER_PALETTE),
  }

  if (n.includes("living")) return [warm, cozyNeutrals, cleanWhite]
  if (n.includes("bed")) return [sereneNight, cozyNeutrals, coolBreeze]
  if (n.includes("kitchen")) return [warm, spaFresh, cleanWhite]
  if (n.includes("bath") || n.includes("ensuite"))
    return [spaFresh, coolBreeze, cleanWhite]
  return [cozyNeutrals, cleanWhite, warm]
}

function pickPaletteForArea(areaName, variantIndex) {
  const options = getPalettesForArea(areaName)
  const idx = ((variantIndex % options.length) + options.length) % options.length
  return options[idx]
}

/**
 * AI chooses ONE color from the palette.
 * Uses relative room size to decide lighter/darker shade.
 */
function chooseShadeByRoomSize(area, colors, imageWidth, imageHeight) {
  if (!area || !area.bbox || !colors.length || !imageWidth || !imageHeight) {
    return (
      colors[Math.floor(colors.length / 2)] ||
      getBaseColorForArea(area?.name || "")
    )
  }

  const boxArea = (area.bbox.width || 0) * (area.bbox.height || 0)
  const imgArea = imageWidth * imageHeight || 1
  const rawRatio = boxArea / imgArea

  // most rooms are within ~35% of total blueprint area
  const normalized = Math.max(0, Math.min(rawRatio / 0.35, 1))

  const maxIndex = colors.length - 1
  const index = Math.round(normalized * maxIndex)

  return colors[index] ?? colors[maxIndex]
}

/* ---------------- Main App ---------------- */

function App() {
  const [hasStarted, setHasStarted] = useState(false)
  const [userName, setUserName] = useState("")

  const [imageUrl, setImageUrl] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedAreaId, setSelectedAreaId] = useState(null)

  // main room color (used for building preview + budget) = floor color
  const [colorsById, setColorsById] = useState({})
  const [previewArea, setPreviewArea] = useState(null)

  // per-room surface colors: { [id]: { floor: '#', walls: '#'} }
  const [surfaceColorsById, setSurfaceColorsById] = useState({})

  const [paletteArea, setPaletteArea] = useState(null)
  const [paletteName, setPaletteName] = useState("")
  const [paletteColors, setPaletteColors] = useState([])
  const [paletteVariant, setPaletteVariant] = useState(0)

  // which surface are we currently picking tone for? 'floor' | 'walls'
  const [paletteTarget, setPaletteTarget] = useState("floor")

  const [showBuilding3D, setShowBuilding3D] = useState(false)
  const [showBudget, setShowBudget] = useState(false)

  const handleExit = () => {
    setHasStarted(false)
    setUserName("")
    setImageUrl(null)
    setAnalysis(null)
    setLoading(false)
    setError("")
    setSelectedAreaId(null)
    setColorsById({})
    setSurfaceColorsById({})
    setPreviewArea(null)
    setPaletteArea(null)
    setPaletteName("")
    setPaletteColors([])
    setPaletteVariant(0)
    setPaletteTarget("floor")
    setShowBuilding3D(false)
    setShowBudget(false)
    window.scrollTo(0, 0)
  }

  /* -------- upload + analysis -------- */

  const handleUpload = async (file) => {
    if (!file) return
    setError("")
    setLoading(true)
    setSelectedAreaId(null)
    setPreviewArea(null)
    setColorsById({})
    setSurfaceColorsById({})
    setPaletteArea(null)
    setShowBuilding3D(false)
    setShowBudget(false)

    try {
      const form = new FormData()
      form.append("blueprint", file)

      const uploadRes = await axios.post("/api/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const url = uploadRes.data.url
      setImageUrl(url)

      const analyzeRes = await axios.post("/api/analyze", { url })
      setAnalysis(analyzeRes.data)

      const detectedAreas = analyzeRes.data.areas || []

      // After first analysis, auto-open tones for first room (floor)
      if (detectedAreas.length > 0) {
        const first = detectedAreas[0]
        setSelectedAreaId(first.id)

        const palette = pickPaletteForArea(first.name, 0)
        setPaletteVariant(0)
        setPaletteArea(first)
        setPaletteTarget("floor")
        setPaletteName(palette.title)
        setPaletteColors(palette.colors)
      }
    } catch (e) {
      console.error(e)
      setError(
        "Failed to analyze blueprint. Please check that backend & python are running."
      )
      setAnalysis(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectArea = (id) => {
    setSelectedAreaId(id)
  }

  // open tones for a specific room: start with floor
  const handleOpenColorSelection = (area) => {
    if (!area) return
    const palette = pickPaletteForArea(area.name, 0)
    setPaletteVariant(0)
    setPaletteArea(area)
    setPaletteTarget("floor")
    setPaletteName(palette.title)
    setPaletteColors(palette.colors)
  }

  const handleRegeneratePalette = () => {
    if (!paletteArea) return
    setPaletteVariant((prev) => {
      const next = prev + 1
      const palette = pickPaletteForArea(paletteArea.name, next)
      setPaletteName(palette.title)
      setPaletteColors(palette.colors)
      return next
    })
  }

  // user clicks Apply Color for current surface (floor or walls)
  const handleApplyPaletteColor = () => {
    if (!paletteArea || !paletteColors.length) return
    const imgW = analysis?.width || 1
    const imgH = analysis?.height || 1
    const chosen = chooseShadeByRoomSize(paletteArea, paletteColors, imgW, imgH)

    // update per-surface colors
    setSurfaceColorsById((prev) => {
      const prevEntry = prev[paletteArea.id] || {}
      const updatedEntry = { ...prevEntry, [paletteTarget]: chosen }
      return { ...prev, [paletteArea.id]: updatedEntry }
    })

    // room-level color (for building + budget) uses floor shade
    if (paletteTarget === "floor") {
      setColorsById((prev) => ({
        ...prev,
        [paletteArea.id]: chosen,
      }))

      // next step: ask user for walls tone
      setPaletteTarget("walls")
      const nextVariant = paletteVariant + 1
      const nextPalette = pickPaletteForArea(paletteArea.name, nextVariant)
      setPaletteVariant(nextVariant)
      setPaletteName(nextPalette.title)
      setPaletteColors(nextPalette.colors)
      return
    }

    // if we just set walls, we are done with this room: show 3D preview
    if (paletteTarget === "walls") {
      setPreviewArea(paletteArea)
      setSelectedAreaId(paletteArea.id)
      setPaletteArea(null)
      setPaletteTarget("floor")
    }
  }

  const areas = analysis?.areas || []

  const currentColor =
    previewArea && colorsById[previewArea.id]
      ? colorsById[previewArea.id]
      : previewArea
      ? getBaseColorForArea(previewArea.name || "")
      : "#A0AEC0"

  const currentSurfaces =
    previewArea && surfaceColorsById[previewArea.id]
      ? surfaceColorsById[previewArea.id]
      : null

  /* -------- 0. Welcome / homepage -------- */

  if (!hasStarted) {
    const canStart = userName.trim().length > 0

    return (
      <div className="w-full max-w-xl mx-auto py-12 px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-md mb-4">
            🏢
          </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1 text-center">
            Blueprint Vision
          </h1>
          <p className="text-sm text-slate-500 text-center">
            ✨ AI-Powered Color Visualization
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            Welcome! What should we call you?
          </p>
          <div className="mb-5">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-2xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <button
            type="button"
            disabled={!canStart}
            onClick={() => setHasStarted(true)}
            className={`w-full py-3 rounded-2xl text-sm font-semibold text-white shadow 
            ${
              canStart
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-300 cursor-not-allowed"
            }`}
          >
            Begin Analysis
          </button>

          <div className="mt-8 border-t border-slate-100 pt-5 flex justify-around text-center">
            <div>
              <p className="text-sm font-semibold text-blue-700">AI</p>
              <p className="text-[11px] text-slate-500">Powered</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-500">3D</p>
              <p className="text-[11px] text-slate-500">Models</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700">Smart</p>
              <p className="text-[11px] text-slate-500">Analysis</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* -------- 1. Main analysis UI -------- */

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-900">
            Hi {userName || "Guest"},
          </h1>
          <p className="text-xs text-slate-500">
            Blueprint Vision · AI-Based Blueprint Analysis for Intelligent House
            Color Visualization
          </p>
        </div>
      </div>

      {/* Step 1: upload only */}
      <UploadPanel onUpload={handleUpload} loading={loading} />

      {error && (
        <div className="mt-4 px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* After choosing file + analysis → everything opens */}
      {analysis && (
        <>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6 items-start">
            <BlueprintCanvas
              imageUrl={imageUrl}
              analysis={analysis}
              selectedAreaId={selectedAreaId}
              onSelectArea={handleSelectArea}
              colors={colorsById}
            />

            <RoomList
              areas={areas}
              selectedAreaId={selectedAreaId}
              onSelectArea={handleSelectArea}
              onColorizeArea={handleOpenColorSelection}
              colors={colorsById}
            />
          </div>

          {paletteArea && (
            <ColorSelectionPanel
              area={paletteArea}
              paletteName={paletteName}
              colors={paletteColors}
              target={paletteTarget} // "floor" or "walls"
              onBack={() => setPaletteArea(null)}
              onRegenerate={handleRegeneratePalette}
              onApply={handleApplyPaletteColor}
            />
          )}

          {/* 3D room preview (uses floor + walls colors) */}
          {previewArea && (
            <Room3DPreview
              area={previewArea}
              color={currentColor}
              surfaces={currentSurfaces}
              onClose={() => setPreviewArea(null)}
            />
          )}

          {/* Controls + optional panels (3D building + budget) */}
          {areas.length > 0 && (
            <>
              <div className="mt-6 flex flex-wrap gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setShowBuilding3D((prev) => !prev)}
                  className="px-6 py-2 rounded-2xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 shadow"
                >
                  {showBuilding3D ? "Hide 3D Preview" : "View 3D Preview"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowBudget((prev) => !prev)}
                  className="px-6 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 shadow"
                >
                  {showBudget ? "Hide Budget" : "Show Budget"}
                </button>
              </div>

              {showBuilding3D && (
                <Building3DPreview
                  areas={areas}
                  colorsById={colorsById}
                  imageWidth={analysis?.width}
                  imageHeight={analysis?.height}
                />
              )}

              {showBudget && (
                <TotalBudget areas={areas} colorsById={colorsById} />
              )}
            </>
          )}

          <DownloadOptions analysis={analysis} colorsById={colorsById} />
        </>
      )}

      {/* sticky Exit */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <button
          type="button"
          onClick={handleExit}
          className="px-6 py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 shadow-lg"
        >
          Exit
        </button>
      </div>
    </div>
  )
}

export default App
