/**
 * analytics.js — trend charts + forecast chart.
 */
let trendChart, energyChart, forecastChart;

async function loadAnalytics() {
  // Trends
  const tRes = await fetch("/api/analytics/trends?days=30");
  const tData = await tRes.json();
  const agg = tData.aggregates || [];

  const dates = agg.map((a) => a.date);
  const masses = agg.map((a) => a.total_mass_kg);
  const energies = agg.map((a) => a.total_energy_kwh);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("chartTrend"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Mass (kg)",
          data: masses,
          borderColor: "#10B981",
          backgroundColor: "rgba(16,185,129,0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });

  if (energyChart) energyChart.destroy();
  energyChart = new Chart(document.getElementById("chartEnergy"), {
    type: "bar",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Energy (kWh)",
          data: energies,
          backgroundColor: "#F59E0B",
          borderRadius: 4,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });

  // Forecast
  const fRes = await fetch("/api/analytics/forecast?history_days=30&ahead=7");
  const fData = await fRes.json();
  const preds = fData.predictions || [];

  if (forecastChart) forecastChart.destroy();
  const allDates = [...dates, ...preds.map((p) => p.date)];
  const actualPad = [...masses, ...preds.map(() => null)];
  const predPad = [
    ...masses.map(() => null),
    ...preds.map((p) => p.predicted_mass_kg),
  ];

  forecastChart = new Chart(document.getElementById("chartForecast"), {
    type: "line",
    data: {
      labels: allDates,
      datasets: [
        {
          label: "Actual",
          data: actualPad,
          borderColor: "#10B981",
          pointRadius: 2,
          tension: 0.3,
        },
        {
          label: "Forecast",
          data: predPad,
          borderColor: "#EF4444",
          borderDash: [6, 3],
          pointRadius: 3,
          tension: 0.3,
        },
      ],
    },
    options: { scales: { y: { beginAtZero: true } } },
  });
}

loadAnalytics();
