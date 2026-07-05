// src/components/ColorSelectionPanel.jsx
import React from "react"

function ColorSelectionPanel({
  area,
  paletteName,
  colors = [],
  target = "floor", // "floor" or "walls"
  onBack,
  onRegenerate,
  onApply,
}) {
  if (!area) return null

  const targetLabel = target === "walls" ? "Walls" : "Floor"

  return (
    <div className="mt-8 bg-white rounded-3xl shadow-lg p-6 sm:p-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            Color Selection – {targetLabel}
          </h2>
          <p className="text-sm text-slate-500">
            AI-generated palette for{" "}
            <span className="font-semibold text-slate-800">
              {area.name || "Selected Area"}
            </span>{" "}
            ({targetLabel})
          </p>
        </div>

        <button
          type="button"
          onClick={onRegenerate}
          className="px-4 py-2 rounded-2xl bg-orange-500 text-white text-xs sm:text-sm font-semibold shadow hover:bg-orange-600"
        >
          ⟳ Regenerate
        </button>
      </div>

      {/* Palette title */}
      <p className="text-sm font-semibold text-slate-800 mb-3">
        {paletteName || "AI Palette"}
      </p>

      {/* Tone strip – preview only, NOT clickable */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {colors.map((c, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 w-10 h-16 rounded-2xl shadow-sm border border-slate-100"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Info note */}
      <div className="bg-slate-50 rounded-2xl px-4 py-3 mb-6 text-xs sm:text-sm text-slate-600 flex gap-2 items-start">
        <span className="mt-0.5">✨</span>
        <p>
          This AI-generated palette is optimized for the{" "}
          <span className="font-semibold">{targetLabel}</span> of{" "}
          <span className="font-semibold">
            {area.name || "this area"}
          </span>{" "}
          using room type, approximate room size, and modern design tones.
          When you click{" "}
          <span className="font-semibold">Apply Tone</span>, the system
          automatically picks the best shade from this range.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200"
        >
          Back to Areas
        </button>

        <button
          type="button"
          onClick={onApply}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700"
        >
          ✓ Apply Tone for {targetLabel}
        </button>
      </div>
    </div>
  )
}

export default ColorSelectionPanel
