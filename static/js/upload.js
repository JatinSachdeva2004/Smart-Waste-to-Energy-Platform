/**
 * upload.js — handles image upload, preview, analysis request, result rendering.
 * Supports multi-object results, warnings, confidence badges, mass ranges.
 */
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const previewImg = document.getElementById("previewImg");
const dropContent = document.getElementById("dropContent");
const analyzeBtn = document.getElementById("analyzeBtn");
const loader = document.getElementById("loader");
const resultsPanel = document.getElementById("resultsPanel");
const subtypePanel = document.getElementById("subtypePanel");
const subtypeSel = document.getElementById("subtypeSelect");
const reAnalyzeBtn = document.getElementById("reAnalyzeBtn");

let selectedFile = null;
let lastWasteType = "";

/* --- Drag & Drop + Click --- */
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drop-active");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("drop-active"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drop-active");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  selectedFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.classList.remove("hidden");
  dropContent.classList.add("hidden");
  analyzeBtn.disabled = false;
  resultsPanel.classList.add("hidden");
  subtypePanel.classList.add("hidden");
}

/* --- Analyze --- */
analyzeBtn.addEventListener("click", () => runAnalysis());
reAnalyzeBtn?.addEventListener("click", () => runAnalysis(subtypeSel.value));

async function runAnalysis(subtype) {
  if (!selectedFile) return;
  analyzeBtn.disabled = true;
  loader.classList.remove("hidden");
  resultsPanel.classList.add("hidden");

  const fd = new FormData();
  fd.append("file", selectedFile);
  if (subtype) fd.append("user_subtype", subtype);

  // Advanced options
  const mw = document.getElementById("manualWeight")?.value;
  if (mw && parseFloat(mw) > 0) fd.append("manual_weight_kg", mw);

  const ref = document.getElementById("refType")?.value;
  if (ref) fd.append("ref_type", ref);

  const uwt = document.getElementById("userWasteType")?.value;
  if (uwt) fd.append("user_waste_type", uwt);

  const contam = document.getElementById("contamination")?.value;
  if (contam) fd.append("contamination", contam);

  try {
    const res = await fetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showFlash(data.error || "Analysis failed", "error");
      return;
    }
    renderResults(data);
  } catch (err) {
    showFlash("Network error: " + err.message, "error");
  } finally {
    loader.classList.add("hidden");
    analyzeBtn.disabled = false;
  }
}

/* --- Confidence badge colors --- */
const CONF_STYLES = {
  high: { bg: "bg-green-100", text: "text-green-800", label: "HIGH" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-800", label: "MEDIUM" },
  low: { bg: "bg-orange-100", text: "text-orange-800", label: "LOW" },
  very_low: { bg: "bg-red-100", text: "text-red-800", label: "VERY LOW" },
  unknown: { bg: "bg-gray-100", text: "text-gray-600", label: "?" },
};

function confBadgeHTML(level) {
  const s = CONF_STYLES[level] || CONF_STYLES.unknown;
  return `<span class="${s.bg} ${s.text} text-xs px-2 py-0.5 rounded-full font-bold">${s.label}</span>`;
}

/* --- Render Results --- */
function renderResults(d) {
  resultsPanel.classList.remove("hidden");

  // --- Warnings banner ---
  const warns = d.warnings || [];
  const banner = document.getElementById("warningsBanner");
  const wList = document.getElementById("warningsList");
  if (warns.length > 0) {
    wList.innerHTML = warns.map((w) => `<li>⚠ ${w}</li>`).join("");
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }

  // --- Multi-object bar ---
  const multiBar = document.getElementById("multiObjBar");
  if (d.objects_count > 1) {
    document.getElementById("objCount").textContent = d.objects_count;
    document.getElementById("totalMass").textContent =
      d.totals.mass_kg.toFixed(4);
    document.getElementById("totalEnergy").textContent =
      d.totals.energy_kwh.toFixed(4);
    multiBar.classList.remove("hidden");
  } else {
    multiBar.classList.add("hidden");
  }

  // --- Dense Pile Analysis Panel ---
  const dpPanel = document.getElementById("densePilePanel");
  const dp = d.density;
  if (dp && dp.is_dense_pile) {
    document.getElementById("dpDetected").textContent = dp.detected_count;
    document.getElementById("dpEstimated").textContent =
      "~" + dp.estimated_total_count;
    document.getElementById("dpMass").textContent =
      "~" + dp.estimated_mass_kg.toFixed(1);
    document.getElementById("dpCoverage").textContent =
      dp.coverage_pct.toFixed(0) + "%";

    // Composition bars (percentage-based from CLIP patch analysis)
    const comp = dp.composition || {};
    const estCounts = dp.estimated_counts || {};
    const TYPE_COLORS = {
      plastic: "#22d3ee",
      paper: "#fb923c",
      metal: "#a1a1aa",
      glass: "#facc15",
      organic: "#4ade80",
      ewaste: "#ef4444",
      textile: "#c4b5fd",
      wood: "#92400e",
      rubber: "#404040",
      general_waste: "#9ca3af",
      composite: "#b45309",
      ceramic: "#d4d4d8",
    };

    const hasComp = Object.keys(comp).length > 0;
    const dataEntries = hasComp
      ? Object.entries(comp).sort((a, b) => b[1] - a[1])
      : Object.entries(estCounts).sort((a, b) => b[1] - a[1]);

    document.getElementById("dpBreakdown").innerHTML = dataEntries
      .map(([wtype, val]) => {
        const color = TYPE_COLORS[wtype] || "#9ca3af";
        if (hasComp) {
          // Composition mode: show percentage bars
          const pct = (val * 100).toFixed(1);
          const estCnt = estCounts[wtype] || 0;
          return `<div class="flex items-center gap-2 text-xs">
                    <span class="w-24 font-medium">${wtype}</span>
                    <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div style="width:${pct}%;background:${color}" class="h-full rounded-full flex items-center pl-1">
                            <span class="text-[10px] text-white font-bold drop-shadow">${pct}%</span>
                        </div>
                    </div>
                    <span class="w-20 text-right font-mono">~${estCnt} items</span>
                </div>`;
        } else {
          // Count mode: show count bars
          const maxCnt = Math.max(...Object.values(estCounts), 1);
          const pct = ((val / maxCnt) * 100).toFixed(0);
          const detected = (dp.instance_counts || {})[wtype] || 0;
          return `<div class="flex items-center gap-2 text-xs">
                    <span class="w-24 font-medium">${wtype}</span>
                    <div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div style="width:${pct}%;background:${color}" class="h-full rounded-full"></div>
                    </div>
                    <span class="w-20 text-right font-mono">~${val} <span class="text-gray-400">(${detected} det)</span></span>
                </div>`;
        }
      })
      .join("");

    document.getElementById("dpMethod").textContent =
      `Method: ${dp.estimation_method.replace(/_/g, " ")} | Density: ${dp.density_objects_per_m2} obj/m²`;
    dpPanel.classList.remove("hidden");
  } else {
    dpPanel.classList.add("hidden");
  }

  // --- Primary detection info ---
  document.getElementById("resultImg").src = d.images.annotated;
  document.getElementById("lightboxImg").src = d.images.annotated;

  const isPile = dp && dp.is_dense_pile && dp.composition && Object.keys(dp.composition).length > 0;
  if (isPile) {
    // Show dominant material from composition
    const dominant = Object.entries(dp.composition).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("resType").textContent =
      `${dominant[0].replace(/_/g, " ").toUpperCase()} (${(dominant[1] * 100).toFixed(0)}% dominant)`;
    document.getElementById("resSubtype").textContent = "Dense waste pile — material composition analysis";
    document.getElementById("resConf").textContent =
      (d.confidence * 100).toFixed(1) + "%";
    document.getElementById("resConfBadge").innerHTML = confBadgeHTML(d.confidence_level);
    document.getElementById("resMass").textContent =
      dp.estimated_mass_kg.toFixed(2) + " kg (pile total)";
  } else {
    document.getElementById("resType").textContent = d.waste_type
      .replace(/_/g, " ")
      .toUpperCase();
    document.getElementById("resSubtype").textContent = d.waste_subtype
      ? `Sub-type: ${d.waste_subtype}`
      : "";
    document.getElementById("resConf").textContent =
      (d.confidence * 100).toFixed(1) + "%";
    document.getElementById("resConfBadge").innerHTML = confBadgeHTML(
      d.confidence_level,
    );
    document.getElementById("resMass").textContent = d.mass_kg.toFixed(4) + " kg";
  }

  // Mass range
  const mr = d.size?.mass_range;
  const mrEl = document.getElementById("resMassRange");
  if (mr && mr.low != null) {
    mrEl.textContent = `(range: ${mr.low.toFixed(4)}–${mr.high.toFixed(4)} kg)`;
  } else {
    mrEl.textContent = "";
  }
  const methodEl = document.getElementById("resMethod");
  methodEl.textContent = `Method: ${(d.size?.estimation_method || "vision").replace(/_/g, " ")} | Confidence: ${d.size?.confidence_pct || 0}%`;

  // --- Per-object cards (multi-object) ---
  const cardsDiv = document.getElementById("objectCards");
  if (d.objects_count > 1) {
    cardsDiv.innerHTML = d.objects
      .map(
        (obj, i) => `
            <div class="bg-white rounded-lg shadow p-3 border-l-4" style="border-color:rgb(${(obj.confidence_color || [128, 128, 128]).join(",")})">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-sm">#${i + 1} ${obj.waste_type.replace(/_/g, " ")}</span>
                    <span class="text-xs">${(obj.confidence * 100).toFixed(1)}% ${confBadgeHTML(obj.confidence_level)}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    Mass: ${obj.mass_kg.toFixed(4)} kg | Energy: ${obj.energy.best_realistic_kwh.toFixed(4)} kWh
                </div>
                ${obj.warnings.length ? '<p class="text-xs text-yellow-600 mt-1">⚠ ' + obj.warnings[0] + "</p>" : ""}
            </div>
        `,
      )
      .join("");
  } else {
    cardsDiv.innerHTML = "";
  }

  // --- Pathway bars (use realistic_kwh when available) ---
  const barsDiv = document.getElementById("pathwayBars");
  const maxE = Math.max(
    ...Object.values(d.energy.pathways).map(
      (p) => p.realistic_kwh || p.energy_kwh,
    ),
    0.0001,
  );
  barsDiv.innerHTML = Object.entries(d.energy.pathways)
    .map(([k, p]) => {
      const val = p.realistic_kwh ?? p.energy_kwh;
      const pct = ((val / maxE) * 100).toFixed(1);
      const moistNote =
        p.moisture_penalty > 0
          ? ` <span class="text-yellow-600">(−${p.moisture_penalty}% moisture)</span>`
          : "";
      return `<div class="mb-2">
            <div class="flex justify-between text-xs mb-0.5">
                <span>${p.name}${moistNote}</span>
                <span class="font-mono">${val.toFixed(4)} kWh</span>
            </div>
            <div class="bg-gray-100 rounded-full h-5 overflow-hidden">
                <div class="pathway-bar" style="width:${p.applicable ? pct : 0}%"></div>
            </div>
        </div>`;
    })
    .join("");
  document.getElementById("resBestMethod").textContent =
    d.energy.best_method_name;
  document.getElementById("resBestEnergy").textContent = (
    d.energy.best_realistic_kwh ?? d.energy.best_energy_kwh
  ).toFixed(4);

  // Realistic vs theoretical note
  const realNote = document.getElementById("resRealisticEnergy");
  if (
    d.energy.best_realistic_kwh != null &&
    d.energy.best_realistic_kwh !== d.energy.best_energy_kwh
  ) {
    realNote.textContent = `(theoretical: ${d.energy.best_energy_kwh.toFixed(4)} kWh)`;
  } else {
    realNote.textContent = "";
  }

  // Energy modifiers info
  const modDiv = document.getElementById("energyModifiers");
  const mod = d.energy.modifiers;
  if (mod) {
    modDiv.innerHTML = `Moisture: ${mod.moisture_pct}% | Contamination: ${mod.contamination} (−${mod.contamination_loss_pct}%)`;
  }

  // Environmental grid
  const envGrid = document.getElementById("envGrid");
  const metrics = [
    {
      label: "CO₂ Saved",
      val: d.environmental.co2_saved_kg,
      unit: "kg",
      icon: "🌿",
    },
    {
      label: "Methane",
      val: d.environmental.methane_saved_kg,
      unit: "kg",
      icon: "💨",
    },
    {
      label: "Water",
      val: d.environmental.water_saved_liters,
      unit: "L",
      icon: "💧",
    },
    {
      label: "Landfill",
      val: d.environmental.landfill_diverted_m3,
      unit: "m³",
      icon: "🏗️",
    },
    {
      label: "Trees",
      val: d.environmental.trees_equivalent,
      unit: "",
      icon: "🌳",
    },
    {
      label: "Homes",
      val: d.environmental.homes_powered_days,
      unit: "days",
      icon: "🏠",
    },
    {
      label: "Leachate",
      val: d.environmental.toxic_leachate_liters,
      unit: "L",
      icon: "☠️",
    },
    {
      label: "Soil",
      val: d.environmental.soil_saved_m2,
      unit: "m²",
      icon: "🌱",
    },
  ];
  envGrid.innerHTML = metrics
    .map(
      (m) => `
        <div class="bg-gray-50 rounded-lg p-3 text-center">
            <p class="text-2xl">${m.icon}</p>
            <p class="font-bold text-sm">${m.val.toFixed(4)} ${m.unit}</p>
            <p class="text-xs text-gray-500">${m.label}</p>
        </div>
    `,
    )
    .join("");

  // Recommendation
  document.getElementById("recText").textContent = d.recommendation.text;
  document.getElementById("recSteps").innerHTML = (
    d.recommendation.action_steps || []
  )
    .map(
      (s) =>
        `<li class="flex gap-2"><span class="text-primary">→</span> ${s}</li>`,
    )
    .join("");

  // Populate subtypes
  lastWasteType = d.waste_type;
  if (d.subtypes_available && d.subtypes_available.length) {
    subtypeSel.innerHTML =
      '<option value="">— Auto —</option>' +
      d.subtypes_available
        .map((s) => `<option value="${s}">${s}</option>`)
        .join("");
    subtypePanel.classList.remove("hidden");
    reAnalyzeBtn?.classList.remove("hidden");
  }

  // Broadcast via WS if connected
  if (window._ws && window._ws.readyState === 1) {
    window._ws.send(JSON.stringify({ type: "new_analysis", id: d.record_id }));
  }
}
