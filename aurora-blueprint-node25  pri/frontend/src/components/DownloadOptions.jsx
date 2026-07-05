// src/components/DownloadOptions.jsx
import React from "react"

function downloadCanvasById(canvasId, filename) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) {
    alert("View not ready – open the 3D view first.")
    return
  }
  try {
    const dataUrl = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error("Download failed:", err)
    alert("Could not download image. Please try again.")
  }
}

function DownloadOptions({ analysis, colorsById }) {
  const handleDownloadRoom = () => {
    downloadCanvasById("room-3d-canvas", "room-preview.png")
  }

  const handleDownloadBuilding = () => {
    downloadCanvasById("building-3d-canvas", "building-preview.png")
  }

  const handleDownloadSummary = () => {
    const areas = analysis?.areas || []
    let text = "AI Color Summary\n\n"

    areas.forEach((area) => {
      const c = colorsById[area.id]
      text += `${area.name || "Area"}: ${c || "no color selected"}\n`
    })

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "color-summary.txt"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-8 bg-white rounded-3xl shadow-lg p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-1">
        Download Options
      </h2>
      <p className="text-[11px] text-slate-500 mb-4">
        Save your previews as images or summary text.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownloadRoom}
          className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
        >
          Download 3D Room (PNG)
        </button>

        <button
          type="button"
          onClick={handleDownloadBuilding}
          className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900"
        >
          Download 3D Building (PNG)
        </button>

        <button
          type="button"
          onClick={handleDownloadSummary}
          className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200"
        >
          Download Color Summary (TXT)
        </button>
      </div>
    </div>
  )
}

export default DownloadOptions
