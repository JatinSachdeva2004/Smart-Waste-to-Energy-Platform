"""
PDF Report Generator using ReportLab + Matplotlib charts.
"""
from __future__ import annotations
import os, io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from app.config import REPORT_DIR


def generate_pdf_report(
    records: list[dict],
    period_label: str = "All Time",
) -> str:
    """
    Build a PDF summarising waste-to-energy analysis.
    Returns the file path of the generated PDF.
    """
    os.makedirs(REPORT_DIR, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(REPORT_DIR, f"report_{ts}.pdf")

    doc = SimpleDocTemplate(filepath, pagesize=A4,
                            topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=20, spaceAfter=12)
    elements: list = []

    # --- Title ---
    elements.append(Paragraph("Smart Waste-to-Energy Report", title_style))
    elements.append(Paragraph(f"Period: {period_label}  |  Generated: {datetime.utcnow():%Y-%m-%d %H:%M}", styles["Normal"]))
    elements.append(Spacer(1, 0.5 * cm))

    if not records:
        elements.append(Paragraph("No records found for this period.", styles["Normal"]))
        doc.build(elements)
        return filepath

    # --- Summary Stats ---
    total_mass = sum(r.get("estimated_mass_kg", 0) for r in records)
    total_energy = sum(r.get("best_energy_kwh", 0) for r in records)
    total_co2 = sum(r.get("co2_saved_kg", 0) for r in records)

    summary_data = [
        ["Metric", "Value"],
        ["Total Records", str(len(records))],
        ["Total Waste Processed", f"{total_mass:.3f} kg"],
        ["Total Energy Potential", f"{total_energy:.4f} kWh"],
        ["Total CO₂ Saved", f"{total_co2:.4f} kg"],
    ]
    t = Table(summary_data, colWidths=[8 * cm, 6 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10B981")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.8 * cm))

    # --- Waste Type Distribution Chart ---
    type_counts: dict[str, int] = {}
    for r in records:
        wt = r.get("waste_type", "Unknown")
        type_counts[wt] = type_counts.get(wt, 0) + 1

    if type_counts:
        chart_buf = _pie_chart(type_counts, "Waste Type Distribution")
        elements.append(RLImage(chart_buf, width=14 * cm, height=10 * cm))
        elements.append(Spacer(1, 0.5 * cm))

    # --- Records Table (last 50) ---
    elements.append(Paragraph("Recent Analysis Records", styles["Heading2"]))
    rec_header = ["#", "Type", "Mass (kg)", "Energy (kWh)", "CO₂ (kg)", "Method"]
    rec_rows = [rec_header]
    for i, r in enumerate(records[:50], 1):
        rec_rows.append([
            str(i),
            r.get("waste_type", "?"),
            f"{r.get('estimated_mass_kg', 0):.3f}",
            f"{r.get('best_energy_kwh', 0):.4f}",
            f"{r.get('co2_saved_kg', 0):.4f}",
            r.get("best_method", ""),
        ])
    rt = Table(rec_rows, colWidths=[1.2 * cm, 3 * cm, 2.5 * cm, 3 * cm, 2.5 * cm, 3.5 * cm])
    rt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    elements.append(rt)

    doc.build(elements)
    return filepath


def _pie_chart(data: dict[str, int], title: str) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(7, 5))
    labels = list(data.keys())
    sizes = list(data.values())
    ax.pie(sizes, labels=labels, autopct="%1.1f%%", startangle=90)
    ax.set_title(title)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf
