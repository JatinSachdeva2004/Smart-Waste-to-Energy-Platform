/**
 * dashboard.js — KPI cards + charts + report generation.
 */
let typeChart, methodChart;

async function loadDashboard() {
  const res = await fetch("/api/dashboard/stats");
  const d = await res.json();

  // KPI
  document.getElementById("kpiRecords").textContent = d.total_records;
  document.getElementById("kpiMass").textContent =
    d.total_mass_kg.toFixed(3) + " kg";
  document.getElementById("kpiEnergy").textContent =
    d.total_energy_kwh.toFixed(4) + " kWh";
  document.getElementById("kpiCO2").textContent =
    d.total_co2_saved_kg.toFixed(4) + " kg";
  document.getElementById("kpiWater").textContent =
    d.total_water_saved_liters.toFixed(2) + " L";
  document.getElementById("kpiMethane").textContent =
    d.total_methane_saved_kg.toFixed(4) + " kg";

  // Type distribution pie
  const typeLabels = Object.keys(d.waste_type_distribution);
  const typeValues = Object.values(d.waste_type_distribution);
  if (typeChart) typeChart.destroy();
  typeChart = new Chart(document.getElementById("chartType"), {
    type: "doughnut",
    data: {
      labels: typeLabels,
      datasets: [
        {
          data: typeValues,
          backgroundColor: palette(typeLabels.length),
        },
      ],
    },
    options: {
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
    },
  });

  // Method distribution bar
  const mLabels = Object.keys(d.method_distribution);
  const mValues = Object.values(d.method_distribution);
  if (methodChart) methodChart.destroy();
  methodChart = new Chart(document.getElementById("chartMethod"), {
    type: "bar",
    data: {
      labels: mLabels,
      datasets: [
        {
          label: "Count",
          data: mValues,
          backgroundColor: "#3B82F6",
          borderRadius: 6,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: false } },
    },
  });
}

function palette(n) {
  const base = [
    "#10B981",
    "#3B82F6",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#6366F1",
    "#84CC16",
    "#06B6D4",
    "#E11D48",
    "#A855F7",
    "#22D3EE",
    "#D946EF",
  ];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

// Report generation
document.getElementById("genReportBtn")?.addEventListener("click", async () => {
  const st = document.getElementById("reportStatus");
  st.textContent = "Generating…";
  st.classList.remove("hidden");
  try {
    const res = await fetch("/api/reports/generate", { method: "POST" });
    const data = await res.json();
    if (data.report_id) {
      st.innerHTML = `✅ Report ready! <a href="/api/reports/${data.report_id}/download" class="text-secondary underline" target="_blank">Download PDF</a>`;
    } else {
      st.textContent = "❌ " + (data.error || "Failed");
    }
  } catch (e) {
    st.textContent = "❌ Network error";
  }
});

loadDashboard();

// WebSocket auto-refresh
try {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = () => loadDashboard();
  window._ws = ws;
} catch (e) {}
