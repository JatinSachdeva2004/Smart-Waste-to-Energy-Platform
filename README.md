---
title: Smart Waste to Energy Platform
emoji: ♻️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# ♻️ Smart Waste to Energy Platform

### AI-Powered Waste Detection, Energy Estimation & Environmental Impact Analysis

> **Waste ko resource ke tarah treat karo, disposal problem ke tarah nahi.**

An advanced intelligent system that analyzes waste images using **YOLO11 + OpenVINO** (CPU-optimized), identifies waste types, estimates mass, calculates recoverable energy potential through multiple conversion pathways, and shows environmental benefits — all in a beautiful real-time dashboard.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Problem Statement](#-problem-statement)
3. [Key Features](#-key-features)
4. [System Architecture](#-system-architecture)
5. [Complete Data Pipeline](#-complete-data-pipeline)
6. [AI Detection System](#-ai-detection-system)
7. [Waste Categories (15 Types, 51 Sub-types)](#-waste-categories)
8. [Energy Conversion Pathways (6 Methods)](#-energy-conversion-pathways)
9. [Environmental Impact Metrics (8 Metrics)](#-environmental-impact-metrics)
10. [Tech Stack](#-tech-stack)
11. [Project Structure](#-project-structure)
12. [Step-by-Step Build Roadmap](#-step-by-step-build-roadmap)
13. [API Endpoints](#-api-endpoints)
14. [Database Schema](#-database-schema)
15. [Frontend Pages](#-frontend-pages)
16. [Installation & Setup](#-installation--setup)
17. [Usage Guide](#-usage-guide)
18. [Future Enhancements](#-future-enhancements)

---

## 🎯 Project Overview

**Smart Waste to Energy Platform** ek AI-based intelligent system hai jo:

| Step | Kya karta hai                        | Kaise karta hai                                       |
| ---- | ------------------------------------ | ----------------------------------------------------- |
| 1    | Waste image accept karta hai         | Drag & drop upload / camera                           |
| 2    | Waste type detect karta hai          | YOLO11s + OpenVINO (CPU optimized)                    |
| 3    | Multiple objects identify karta hai  | Object detection with bounding boxes                  |
| 4    | Size & mass estimate karta hai       | OpenCV contour detection + density tables             |
| 5    | Energy potential calculate karta hai | 6 conversion pathways (Incineration, Pyrolysis, etc.) |
| 6    | Environmental impact show karta hai  | CO₂, Methane, Water, Trees, Homes powered             |
| 7    | Best method recommend karta hai      | AI recommendation engine                              |
| 8    | Data store karta hai                 | SQLite database with full history                     |
| 9    | Dashboard mein display karta hai     | Real-time charts, graphs, tables                      |
| 10   | PDF reports generate karta hai       | Professional downloadable reports                     |

**Main Goal:** Waste ko resource ke tarah treat karna — har waste item se kitni energy nikal sakti hai, environment ko kitna benefit hoga, yeh sab data-driven approach se batana.

---

## ❗ Problem Statement

Urban areas mein waste generation rapidly increase ho raha hai. Current problems:

| Problem                        | Impact                                                 |
| ------------------------------ | ------------------------------------------------------ |
| Manual waste inspection        | Slow, inaccurate, labor-intensive                      |
| No energy potential estimation | Waste ka energy value waste ho raha hai                |
| Landfill pollution             | Soil & water contamination                             |
| Greenhouse gas emissions       | CO₂ + Methane from decomposing waste                   |
| Poor data tracking             | No historical data, no predictions                     |
| No smart recommendations       | Kaunsa method best hai waste ke liye — koi nahi batata |

**Core Question:**

> _Waste materials ko intelligent system ke through analyze karke unka recoverable energy potential aur environmental impact kaise estimate kiya ja sakta hai?_

---

## ✨ Key Features

### Core Features

- 🔍 **Multi-Object Waste Detection** — Ek image mein multiple waste items detect karo
- 🧠 **YOLO11s + OpenVINO INT8** — CPU pe 15-25ms inference (super fast, no GPU needed)
- ⚡ **6 Energy Conversion Pathways** — Incineration, Pyrolysis, Biogas, Gasification, Plasma Arc, Recycling
- 🌍 **8 Environmental Metrics** — CO₂, Methane, Water, Trees, Homes powered, etc.
- 📊 **Real-time Dashboard** — Interactive Chart.js charts with WebSocket live updates
- 🤖 **AI Recommendations** — Best conversion method per waste type

### Advanced Features

- 📈 **Predictive Forecasting** — Waste generation & energy production predictions
- 📄 **PDF Report Generation** — Professional reports with charts & analysis
- 🔄 **WebSocket Real-time** — Dashboard auto-updates without page refresh
- 📱 **Responsive Design** — Mobile + Desktop friendly
- 🌙 **Dark/Light Mode** — User preference based theme
- 🗄️ **Full History Tracking** — Every analysis stored with audit trail
- 🔎 **Search & Filter** — Historical records searchable by type, date, energy

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Upload   │  │ Dashboard │  │ History  │  │ Analytics │  │
│  │  Page     │  │  Charts   │  │  Table   │  │ Forecast  │  │
│  └─────┬────┘  └─────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│        │             │              │               │         │
│        └─────────────┴──────────────┴───────────────┘         │
│                          │ HTTP + WebSocket                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    BACKEND (FastAPI)                          │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────────┐       │
│  │              API Routes Layer                      │       │
│  │  /api/upload  /api/records  /api/analytics  /ws   │       │
│  └───────────────────────┬───────────────────────────┘       │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────────┐       │
│  │              Services Layer                        │       │
│  │                                                    │       │
│  │  ┌──────────────┐  ┌──────────────┐               │       │
│  │  │ AI Classifier │  │ Size         │               │       │
│  │  │ YOLO11s +    │  │ Estimator    │               │       │
│  │  │ OpenVINO     │  │ OpenCV       │               │       │
│  │  └──────┬───────┘  └──────┬───────┘               │       │
│  │         │                  │                        │       │
│  │  ┌──────┴──────────────────┴──────┐               │       │
│  │  │     Energy Calculator          │               │       │
│  │  │  6 Pathways × Mass = kWh       │               │       │
│  │  └──────────────┬─────────────────┘               │       │
│  │                 │                                  │       │
│  │  ┌──────────────┴─────────────────┐               │       │
│  │  │   Environmental Analyzer       │               │       │
│  │  │  CO₂, CH₄, Water, Trees       │               │       │
│  │  └──────────────┬─────────────────┘               │       │
│  │                 │                                  │       │
│  │  ┌──────────────┴──────┐  ┌────────────────┐      │       │
│  │  │ Recommendation      │  │ Forecasting    │      │       │
│  │  │ Engine              │  │ Engine         │      │       │
│  │  └─────────────────────┘  └────────────────┘      │       │
│  └───────────────────────────────────────────────────┘       │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────────┐       │
│  │              Database Layer (SQLite + SQLAlchemy)   │       │
│  │  waste_records table  │  energy_reports table      │       │
│  └───────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Data Pipeline

Jab user ek image upload karta hai, yeh PURA pipeline chalta hai:

```
STEP 1: IMAGE UPLOAD
━━━━━━━━━━━━━━━━━━━
User drags & drops image → POST /api/upload
Image saved to /uploads/ folder with unique filename

        ↓

STEP 2: AI WASTE DETECTION (YOLO11s + OpenVINO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  waste_image.jpg (any size)
Model:  YOLO11s exported to OpenVINO IR format (INT8 quantized)
Process:
  - Image resize to 640×640
  - Run through YOLO detection model
  - NMS (Non-Max Suppression) to filter overlapping boxes
Output: List of detected objects
  [
    { class: "plastic", confidence: 0.92, bbox: [x1,y1,x2,y2] },
    { class: "metal",   confidence: 0.87, bbox: [x1,y1,x2,y2] },
    { class: "organic", confidence: 0.78, bbox: [x1,y1,x2,y2] }
  ]
Speed:  ~15-25ms on CPU (Intel i5/i7)

        ↓

STEP 3: SUB-TYPE REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━
AI detected "plastic" → User sees dropdown:
  - PET (Bottles) → 46 MJ/kg
  - HDPE (Jugs)   → 43 MJ/kg
  - LDPE (Bags)   → 40 MJ/kg
  - PP (Caps)     → 42 MJ/kg
  - PS/Styrofoam  → 38 MJ/kg
  - Mixed Plastic → 35 MJ/kg

User selects exact sub-type OR keeps default.
If user skips → system uses average values for that category.

        ↓

STEP 4: SIZE & MASS ESTIMATION (OpenCV)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH detected object:
  a) Crop image using bounding box coordinates
  b) Convert to grayscale → Apply Gaussian blur
  c) Edge detection (Canny) → Find contours
  d) Calculate contour area in pixels
  e) Convert pixel area to real-world area (cm²)
     - Using reference scale factor (pixels per cm)
  f) Estimate volume (cm³) using shape heuristics
     - Flat objects: area × estimated_thickness
     - Round objects: sphere/cylinder formulas
  g) Calculate mass:
     mass_kg = volume_m3 × density_kg_m3

Example:
  PET bottle detected → contour area = 15,000 px²
  → real area ≈ 180 cm² → volume ≈ 500 cm³
  → density (PET) = 1,380 kg/m³
  → mass ≈ 0.025 kg (25 grams) ✓ realistic

        ↓

STEP 5: ENERGY POTENTIAL CALCULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH detected waste item, calculate energy via ALL applicable pathways:

┌─────────────────┬──────────────────────────────────────────────┐
│ Pathway         │ Formula                                       │
├─────────────────┼──────────────────────────────────────────────┤
│ Incineration    │ energy = mass × calorific_value × 0.28 (eff) │
│ Pyrolysis       │ energy = mass × calorific_value × 0.42 (eff) │
│ Biogas          │ energy = mass × biogas_yield × 6.0 (kWh/m³)  │
│ Gasification    │ energy = mass × calorific_value × 0.35 (eff) │
│ Plasma Arc      │ energy = mass × calorific_value × 0.45 (eff) │
│ Recycling       │ energy_saved = mass × virgin_energy × 0.80   │
└─────────────────┴──────────────────────────────────────────────┘

Convert MJ to kWh: kWh = MJ / 3.6

Output per item:
  {
    best_method: "Pyrolysis",
    energy_kwh: 0.32,
    all_pathways: {
      incineration: 0.21 kWh,
      pyrolysis: 0.32 kWh,
      biogas: 0.00 kWh (not applicable for plastic),
      gasification: 0.26 kWh,
      plasma_arc: 0.34 kWh,
      recycling_saved: 0.28 kWh
    }
  }

        ↓

STEP 6: ENVIRONMENTAL IMPACT CALCULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH detected waste item:

┌───────────────────────┬────────────────────────────────────────────┐
│ Metric                │ Formula                                     │
├───────────────────────┼────────────────────────────────────────────┤
│ CO₂ Saved (kg)        │ mass × co2_landfill_factor - mass × co2_  │
│                       │ conversion_factor                           │
│ Methane Prevented (kg)│ mass × methane_factor (organic only)       │
│ Water Saved (liters)  │ mass × water_per_kg (if recycled)          │
│ Landfill Diverted (m³)│ volume_m3 (direct)                         │
│ Trees Equivalent      │ co2_saved / 22.0 (kg CO₂/tree/year)       │
│ Homes Powered (days)  │ energy_kwh / 30.0 (avg daily use)          │
│ Toxic Leachate (L)    │ mass × leachate_factor (e-waste/hazardous) │
│ Soil Saved (m²)       │ landfill_volume / avg_depth                 │
└───────────────────────┴────────────────────────────────────────────┘

        ↓

STEP 7: AI RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━
System scores each conversion method:
  score = (energy_yield × 0.4) + (environmental_benefit × 0.35) + (cost_efficiency × 0.25)

Generates:
  - Best conversion method (ranked)
  - Action steps (e.g., "Separate PET bottles → Send to pyrolysis plant")
  - Recycling priority (Recycle > Energy Recovery > Landfill)
  - Hazard warnings (if applicable)

        ↓

STEP 8: DATABASE STORAGE
━━━━━━━━━━━━━━━━━━━━━━━
Save complete analysis to SQLite:
  - waste_records table: per-object data
  - Linked to original image path
  - Timestamp for historical tracking

        ↓

STEP 9: REAL-TIME DASHBOARD UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WebSocket pushes new data to connected dashboard clients:
  - Pie chart updates (waste distribution)
  - Bar chart updates (energy by method)
  - Counter animations (total CO₂ saved, etc.)
  - Recent records table auto-refreshes

        ↓

STEP 10: RESPONSE TO USER
━━━━━━━━━━━━━━━━━━━━━━━━
Return complete analysis as:
  - JSON (API response)
  - Rendered HTML page (analysis.html) with:
    - Annotated image (bounding boxes drawn)
    - Per-object breakdown cards
    - Energy comparison chart
    - Environmental impact gauges
    - Recommendations list
```

---

## 🧠 AI Detection System

### Two-Level Hybrid Approach

**Level 1: YOLO11s Object Detection (AI does this)**

| Config     | Detail                                     |
| ---------- | ------------------------------------------ |
| Model      | YOLO11s (9.4M parameters)                  |
| Format     | OpenVINO IR (INT8 quantized)               |
| Input      | 640×640 RGB image                          |
| Output     | Bounding boxes + class labels + confidence |
| Speed      | ~15-25ms on Intel CPU                      |
| Categories | 10 broad types                             |

Detectable categories:

1. Plastic
2. Paper/Cardboard
3. Metal
4. Glass
5. Organic/Food
6. E-Waste
7. Textile/Fabric
8. Wood
9. Rubber
10. Medical/Hazardous

**Level 2: User Refinement + Lookup Table (Data does this)**

After AI detects broad type → User optionally selects sub-type from filtered dropdown → System looks up exact energy/density values from master data file.

Why this approach?

- AI **cannot** visually distinguish PET from HDPE plastic
- AI **cannot** tell cotton from polyester by image alone
- But AI **CAN** tell plastic from metal from organic
- The sub-type data is where the **real science** happens (energy values, density, etc.)

### Fallback Models Available

| Priority | Model                              | Source       | When to Use                     |
| -------- | ---------------------------------- | ------------ | ------------------------------- |
| 1st      | Custom YOLO11s (trained on waste)  | Self-trained | Primary detection               |
| 2nd      | Pre-trained waste-detection-yolov8 | HuggingFace  | Quick start / fallback          |
| 3rd      | MobileNetV2 classifier             | TensorFlow   | Lightweight classification only |

---

## 🗂️ Waste Categories

### 15 Primary Categories with 51 Sub-types

#### 1. PLASTIC (6 sub-types)

| Sub-type     | Examples                       | Energy (MJ/kg) | Density (kg/m³) |
| ------------ | ------------------------------ | -------------- | --------------- |
| PET          | Water bottles, food containers | 46.2           | 1,380           |
| HDPE         | Milk jugs, detergent bottles   | 43.0           | 970             |
| PVC          | Pipes, window frames           | 18.0           | 1,400           |
| LDPE         | Plastic bags, wraps, films     | 40.0           | 925             |
| PP           | Bottle caps, food containers   | 42.0           | 946             |
| PS/Styrofoam | Cups, packaging foam           | 38.0           | 1,050           |

#### 2. PAPER & CARDBOARD (5 sub-types)

| Sub-type             | Examples                 | Energy (MJ/kg) | Density (kg/m³) |
| -------------------- | ------------------------ | -------------- | --------------- |
| Newspaper            | Daily papers, flyers     | 17.0           | 750             |
| Corrugated Cardboard | Shipping boxes           | 16.0           | 200             |
| Office Paper         | Printer paper, documents | 15.0           | 800             |
| Magazines            | Glossy printed material  | 12.0           | 900             |
| Tissue               | Napkins, toilet paper    | 14.0           | 100             |

#### 3. METAL (5 sub-types)

| Sub-type | Examples              | Recycling Energy Saved |
| -------- | --------------------- | ---------------------- |
| Aluminum | Cans, foil            | 95% vs virgin          |
| Steel    | Food cans, appliances | 74% vs virgin          |
| Copper   | Wires, pipes          | 85% vs virgin          |
| Iron     | Tools, structures     | 72% vs virgin          |
| Tin      | Tin cans, coatings    | 68% vs virgin          |

#### 4. GLASS (4 sub-types)

| Sub-type           | Examples            | Recyclable    |
| ------------------ | ------------------- | ------------- |
| Clear/Flint        | Bottles, jars       | 100% ♻️       |
| Green              | Wine bottles        | 100% ♻️       |
| Brown/Amber        | Beer bottles        | 100% ♻️       |
| Mixed/Contaminated | Broken, mixed color | Aggregate use |

#### 5. ORGANIC / FOOD (5 sub-types)

| Sub-type          | Examples              | Biogas Yield (m³/kg) | Energy (MJ/kg) |
| ----------------- | --------------------- | -------------------- | -------------- |
| Fruit & Vegetable | Peels, rotten produce | 0.45                 | 5.0            |
| Cooked Food       | Leftovers, scraps     | 0.50                 | 6.0            |
| Dairy             | Expired milk, cheese  | 0.55                 | 8.0            |
| Meat & Fish       | Bones, trimmings      | 0.48                 | 7.0            |
| Grain & Bakery    | Stale bread, rice     | 0.42                 | 4.0            |

#### 6. E-WASTE (5 sub-types)

| Sub-type              | Examples               | Recovery                  |
| --------------------- | ---------------------- | ------------------------- |
| Mobile Phones/Tablets | Smartphones, iPads     | Gold, Silver, Palladium   |
| Laptops/Desktops      | Computers, monitors    | Precious metals           |
| Batteries             | Li-ion, NiMH, Alkaline | ⚠️ Hazardous, specialized |
| Cables & Wires        | USB, power cords       | Copper recovery           |
| Circuit Boards (PCBs) | Motherboards, chips    | Gold, Silver, Platinum    |

#### 7. TEXTILE / FABRIC (4 sub-types)

| Sub-type            | Examples            | Energy (MJ/kg) |
| ------------------- | ------------------- | -------------- |
| Cotton/Natural      | T-shirts, jeans     | 15.0           |
| Polyester/Synthetic | Jackets, sportswear | 32.0           |
| Leather             | Bags, shoes, belts  | 18.0           |
| Wool/Silk           | Sweaters, scarves   | 20.0           |

#### 8. WOOD (4 sub-types)

| Sub-type            | Examples         | Energy (MJ/kg) |
| ------------------- | ---------------- | -------------- |
| Construction Timber | Beams, planks    | 19.0           |
| Furniture Wood      | Tables, chairs   | 17.0           |
| Pallets/Crates      | Shipping pallets | 18.0           |
| MDF/Plywood         | Processed boards | 15.0           |

#### 9. RUBBER (3 sub-types)

| Sub-type          | Examples              | Energy (MJ/kg) |
| ----------------- | --------------------- | -------------- |
| Vehicle Tires     | Car/truck tires       | 37.0           |
| Industrial Rubber | Gaskets, seals        | 33.0           |
| Footwear          | Rubber soles, sandals | 32.0           |

#### 10. MEDICAL / HAZARDOUS (4 sub-types)

| Sub-type            | Examples             | Treatment              |
| ------------------- | -------------------- | ---------------------- |
| Syringes/Sharps     | Needles, lancets     | High-temp incineration |
| PPE                 | Masks, gloves, gowns | 25 MJ/kg, incineration |
| Pharmaceutical      | Expired medicines    | Chemical treatment     |
| Chemical Containers | Reagent bottles      | Specialized disposal   |

#### 11. CONSTRUCTION & DEMOLITION (4 sub-types)

| Sub-type        | Examples            | Reuse             |
| --------------- | ------------------- | ----------------- |
| Concrete/Cement | Blocks, slabs       | Crush → Aggregate |
| Bricks          | Clay bricks         | Crush → Road base |
| Roof Tiles      | Clay/concrete tiles | Reuse / Crush     |
| Insulation      | Foam, fiberglass    | Limited recycling |

#### 12. CERAMIC & POTTERY (3 sub-types)

| Sub-type         | Examples             | Reuse                 |
| ---------------- | -------------------- | --------------------- |
| Clay Pots        | Flower pots, matka   | Crush → fill material |
| Porcelain        | Toilets, sinks, cups | Crush → aggregate     |
| Decorative Tiles | Mosaic, floor tiles  | Reuse                 |

#### 13. COMPOSITE / MULTI-MATERIAL (3 sub-types)

| Sub-type          | Examples                         | Energy (MJ/kg) |
| ----------------- | -------------------------------- | -------------- |
| Tetra Pak         | Juice boxes (paper+plastic+foil) | 22.0           |
| Laminated Pouches | Chip bags, sauce packets         | 26.0           |
| Diapers/Sanitary  | Disposable diapers, pads         | 20.0           |

#### 14. GARDEN / AGRICULTURAL (4 sub-types)

| Sub-type         | Examples           | Energy (MJ/kg) |
| ---------------- | ------------------ | -------------- |
| Dry Leaves/Straw | Fallen leaves, hay | 14.0           |
| Crop Residue     | Stubble, husks     | 13.0           |
| Grass Clippings  | Lawn cuttings      | 10.0           |
| Tree Branches    | Pruning, twigs     | 15.0           |

#### 15. ASH & RESIDUE (2 sub-types)

| Sub-type             | Examples          | Reuse                 |
| -------------------- | ----------------- | --------------------- |
| Coal/Incinerator Ash | Bottom ash, char  | Brick/cement additive |
| Fly Ash / Slag       | Power plant waste | Construction material |

---

## ⚡ Energy Conversion Pathways

### 6 Conversion Methods

#### 1. Incineration (Direct Combustion)

```
Input:   Mixed waste, Paper, Textile, Medical waste
Process: Burn at 850-1100°C → Heat → Steam → Turbine → Electricity
Output:  Electricity + Heat (CHP)
Efficiency: 25-30%
Byproducts: Bottom ash (construction use), Fly ash (hazardous)
Formula: energy_kwh = mass_kg × calorific_value_mj × efficiency / 3.6
Pros:    Handles mixed waste, volume reduction 90%
Cons:    Emissions (with scrubbers), ash disposal
```

#### 2. Pyrolysis (Thermal Decomposition)

```
Input:   Plastic, Rubber, Textile, Composite
Process: Heat at 300-700°C WITHOUT oxygen → Breakdown into simpler molecules
Output:  Syngas (30%) + Bio-oil (40%) + Char (30%)
Efficiency: 35-45%
Formula: energy_kwh = mass_kg × calorific_value_mj × efficiency / 3.6
Pros:    High energy recovery from plastics, produces fuel oil
Cons:    Needs sorted input, complex equipment
```

#### 3. Anaerobic Digestion (Biogas)

```
Input:   Organic/Food waste, Garden/Agricultural waste
Process: Microorganisms decompose waste WITHOUT oxygen → Biogas (CH₄ + CO₂)
Output:  Biogas (60% methane) + Digestate (fertilizer)
Efficiency: 60-70%
Formula: energy_kwh = mass_kg × biogas_yield_m3_per_kg × 6.0 (kWh per m³ biogas)
Pros:    Best for organic, produces fertilizer, low emissions
Cons:    Only organic input, slow process (15-30 days)
```

#### 4. Gasification

```
Input:   Wood, Agricultural waste, Mixed dry waste
Process: Partial combustion at 700-1200°C with limited oxygen → Syngas
Output:  Syngas (CO + H₂) → Electricity or Liquid fuels
Efficiency: 30-40%
Formula: energy_kwh = mass_kg × calorific_value_mj × efficiency / 3.6
Pros:    Cleaner than incineration, flexible input
Cons:    Needs dry waste, moderate complexity
```

#### 5. Plasma Arc Gasification

```
Input:   E-Waste, Hazardous waste, Medical waste
Process: Ultra-high temperature plasma (3000-8000°C) breaks ALL bonds
Output:  Syngas + Vitrified slag (inert glass-like solid)
Efficiency: 40-50%
Formula: energy_kwh = mass_kg × calorific_value_mj × efficiency / 3.6
Pros:    Handles ANY waste including hazardous, slag is inert
Cons:    Very high energy input, expensive, complex
```

#### 6. Recycling (Energy Saved vs Virgin Production)

```
Input:   Metal, Glass, some Plastic, Paper
Process: Melt/reprocess into new material
Output:  Recycled material (saves energy vs making from raw)
Efficiency: 68-95% energy saved
Formula: energy_saved_kwh = mass_kg × virgin_production_energy × saving_percentage / 3.6
Pros:    Highest environmental benefit, preserves material
Cons:    Needs sorting, contamination issues
```

### Pathway Selection Logic

```
IF waste is Organic/Food/Garden:
    → Best: Anaerobic Digestion (Biogas)

ELIF waste is Plastic/Rubber/Composite:
    → Best: Pyrolysis

ELIF waste is Wood/Agricultural (dry):
    → Best: Gasification

ELIF waste is Metal/Glass:
    → Best: Recycling

ELIF waste is E-Waste/Hazardous/Medical:
    → Best: Plasma Arc Gasification

ELIF waste is Paper/Textile/Mixed:
    → Best: Incineration (with energy recovery)

ELSE:
    → Rank all applicable methods by energy yield
```

---

## 🌍 Environmental Impact Metrics

### 8 Metrics Calculated Per Analysis

| #   | Metric                         | Unit   | Formula                                                | Example                          |
| --- | ------------------------------ | ------ | ------------------------------------------------------ | -------------------------------- |
| 1   | **CO₂ Reduction**              | kg     | `mass × (landfill_co2_factor - conversion_co2_factor)` | 1kg plastic → 1.8 kg CO₂ saved   |
| 2   | **Methane Prevention**         | kg     | `mass × methane_factor` (organic only)                 | 1kg food → 0.06 kg CH₄ prevented |
| 3   | **Water Saved**                | liters | `mass × water_per_kg_recycled`                         | 1kg paper → 26 liters saved      |
| 4   | **Landfill Diverted**          | m³     | `volume_m3` (direct)                                   | 1kg plastic → 0.001 m³           |
| 5   | **Trees Equivalent**           | count  | `co2_saved / 22.0` (kg/tree/year)                      | 22kg CO₂ = 1 tree/year           |
| 6   | **Homes Powered**              | days   | `energy_kwh / 30.0` (avg daily use)                    | 30 kWh = 1 home-day              |
| 7   | **Toxic Leachate Prevented**   | liters | `mass × leachate_factor`                               | E-waste: high                    |
| 8   | **Soil Contamination Avoided** | m²     | `landfill_volume / avg_depth`                          | Direct area calc                 |

---

## 🛠️ Tech Stack

| Layer                  | Technology          | Why                                       |
| ---------------------- | ------------------- | ----------------------------------------- |
| **Language**           | Python 3.10+        | Best for AI/ML ecosystem                  |
| **Backend Framework**  | FastAPI             | Async, fast, auto-docs, WebSocket support |
| **AI Detection**       | Ultralytics YOLO11s | Best accuracy/speed for object detection  |
| **CPU Optimization**   | OpenVINO INT8       | 3-5x speedup on Intel CPUs                |
| **Image Processing**   | OpenCV (cv2)        | Contour detection, image manipulation     |
| **Database**           | SQLite + SQLAlchemy | Zero setup, upgradeable to PostgreSQL     |
| **Frontend Templates** | Jinja2              | Server-side rendering, fast               |
| **CSS Framework**      | TailwindCSS (CDN)   | Modern, responsive, utility-first         |
| **Charts**             | Chart.js            | Interactive, beautiful, lightweight       |
| **Real-time**          | WebSocket (FastAPI) | Live dashboard updates                    |
| **PDF Reports**        | ReportLab           | Professional PDF generation               |
| **Image Storage**      | Local filesystem    | /uploads/ folder                          |

---

## 📁 Project Structure

```
smart_waste_energy/
│
├── app/
│   ├── __init__.py                     # App package init
│   ├── main.py                         # FastAPI app — entry point, middleware, startup
│   ├── config.py                       # All settings — paths, model config, constants
│   │
│   ├── models/                         # Database models (SQLAlchemy)
│   │   ├── __init__.py
│   │   ├── database.py                 # Engine, SessionLocal, Base, create_tables()
│   │   ├── waste_record.py             # WasteRecord table — per-object analysis data
│   │   └── energy_report.py            # EnergyReport table — generated reports
│   │
│   ├── services/                       # Business logic — ALL calculations happen here
│   │   ├── __init__.py
│   │   ├── ai_classifier.py            # YOLO11s + OpenVINO model loading & inference
│   │   ├── size_estimator.py           # OpenCV contour → area → volume → mass
│   │   ├── energy_calculator.py        # 6 pathway energy calculations
│   │   ├── environmental.py            # 8 environmental impact metrics
│   │   ├── recommendation.py           # Best method scoring & action steps
│   │   ├── forecasting.py              # Trend analysis & predictions
│   │   └── report_generator.py         # PDF report creation (ReportLab)
│   │
│   ├── routes/                         # API endpoints — thin layer, calls services
│   │   ├── __init__.py
│   │   ├── upload.py                   # POST /api/upload — full analysis pipeline
│   │   ├── dashboard.py                # GET / , /dashboard, /history — page routes
│   │   ├── analytics.py                # GET /api/analytics/* — stats & forecast data
│   │   ├── records.py                  # GET /api/records — CRUD for waste records
│   │   ├── reports.py                  # POST/GET /api/reports — generate & download PDF
│   │   └── websocket.py                # WS /ws/live — real-time broadcast
│   │
│   └── utils/                          # Shared utilities
│       ├── __init__.py
│       └── helpers.py                  # File handling, image utils, formatters
│
├── templates/                          # Jinja2 HTML templates
│   ├── base.html                       # Base layout — navbar, sidebar, footer
│   ├── index.html                      # Landing page — upload area
│   ├── dashboard.html                  # Main dashboard — all charts
│   ├── analysis.html                   # Single analysis result view
│   ├── history.html                    # Historical records table
│   └── analytics.html                  # Forecasting & predictions page
│
├── static/                             # Static assets
│   ├── css/
│   │   └── style.css                   # Custom styles + TailwindCSS overrides
│   ├── js/
│   │   ├── upload.js                   # Drag & drop + progress bar
│   │   ├── dashboard.js                # Chart.js init + WebSocket listener
│   │   ├── analytics.js                # Forecast charts
│   │   └── websocket.js                # WebSocket connection manager
│   └── images/
│       └── logo.png                    # App logo
│
├── data/
│   └── waste_energy_data.json          # Master lookup — ALL waste properties
│
├── uploads/                            # User uploaded images (gitignored)
├── reports/                            # Generated PDF reports (gitignored)
│
├── requirements.txt                    # Python dependencies
├── run.py                              # Server startup script
└── README.md                           # This file
```

---

## 🗺️ Step-by-Step Build Roadmap

### Phase 1: Foundation (Steps 1-2)

```
Step 1: Project Setup
  ├── Create folder structure
  ├── requirements.txt (all dependencies)
  ├── config.py (settings, paths, constants)
  ├── run.py (server launcher)
  └── waste_energy_data.json (master data file with ALL 51 sub-types)

Step 2: Database Layer
  ├── database.py (SQLAlchemy engine + session)
  ├── waste_record.py (WasteRecord model — 20+ columns)
  └── energy_report.py (EnergyReport model)
```

### Phase 2: AI & Core Services (Steps 3-5)

```
Step 3: AI Classification Service
  ├── ai_classifier.py
  ├── Load YOLO model (with OpenVINO fallback to standard PyTorch)
  ├── detect_waste(image_path) → list of detections
  ├── Draw bounding boxes on image
  └── Return: [{waste_type, confidence, bbox, cropped_image}]

Step 4: Size & Mass Estimation
  ├── size_estimator.py
  ├── OpenCV contour detection per object
  ├── Pixel area → real area (cm²)
  ├── Volume estimation (shape heuristics)
  └── Mass = volume × density (from lookup table)

Step 5: Energy & Environmental Calculators
  ├── energy_calculator.py (6 pathways)
  ├── environmental.py (8 metrics)
  └── recommendation.py (scoring + action steps)
```

### Phase 3: API Layer (Step 6)

```
Step 6: FastAPI Routes
  ├── upload.py — POST /api/upload (orchestrates full pipeline)
  ├── dashboard.py — page rendering routes
  ├── analytics.py — aggregated stats + forecast API
  ├── records.py — CRUD for waste records
  ├── reports.py — PDF generation + download
  └── websocket.py — real-time broadcast
```

### Phase 4: Frontend (Steps 7-8)

```
Step 7: HTML Templates
  ├── base.html (layout with TailwindCSS + navbar)
  ├── index.html (upload page with drag & drop)
  ├── dashboard.html (charts: pie, bar, line, gauges)
  ├── analysis.html (single result with annotated image)
  ├── history.html (searchable/sortable table)
  └── analytics.html (forecast charts)

Step 8: JavaScript & CSS
  ├── upload.js (drag & drop, preview, progress bar)
  ├── dashboard.js (Chart.js initialization)
  ├── websocket.js (real-time connection)
  ├── analytics.js (forecast charts)
  └── style.css (custom styles, animations, dark mode)
```

### Phase 5: Advanced Features (Steps 9-10)

```
Step 9: Forecasting Engine
  ├── forecasting.py
  ├── Moving average + linear regression
  ├── Waste generation prediction
  └── Energy production forecast

Step 10: PDF Report Generator
  ├── report_generator.py
  ├── Professional layout with logo
  ├── Summary tables + charts
  ├── Environmental impact section
  └── Recommendations
```

---

## 🌐 API Endpoints

### Page Routes (HTML)

| Method | URL              | Description                |
| ------ | ---------------- | -------------------------- |
| GET    | `/`              | Landing page — upload area |
| GET    | `/dashboard`     | Main dashboard with charts |
| GET    | `/history`       | Historical records table   |
| GET    | `/analytics`     | Forecasting & predictions  |
| GET    | `/analysis/{id}` | Single analysis result     |

### API Routes (JSON)

| Method | URL                           | Description                  | Input                                             | Output             |
| ------ | ----------------------------- | ---------------------------- | ------------------------------------------------- | ------------------ |
| POST   | `/api/upload`                 | Upload image → full analysis | `multipart/form-data` (image + optional sub_type) | Full analysis JSON |
| GET    | `/api/records`                | List all waste records       | `?page=1&limit=20&type=plastic`                   | Paginated records  |
| GET    | `/api/records/{id}`           | Single record detail         | —                                                 | Full record JSON   |
| DELETE | `/api/records/{id}`           | Delete a record              | —                                                 | Success/Fail       |
| GET    | `/api/analytics/summary`      | Aggregated statistics        | `?period=week\|month\|year`                       | Totals JSON        |
| GET    | `/api/analytics/forecast`     | Prediction data              | `?days=30`                                        | Forecast JSON      |
| GET    | `/api/analytics/distribution` | Waste type distribution      | —                                                 | Pie chart data     |
| GET    | `/api/analytics/trends`       | Historical trends            | `?period=month`                                   | Time-series JSON   |
| POST   | `/api/reports/generate`       | Generate PDF report          | `?period=week\|month\|all`                        | Report ID          |
| GET    | `/api/reports/{id}/download`  | Download PDF                 | —                                                 | PDF file           |
| WS     | `/ws/live`                    | Real-time updates            | —                                                 | Push events        |

---

## 🗄️ Database Schema

### Table: `waste_records`

| Column                  | Type         | Description                       |
| ----------------------- | ------------ | --------------------------------- |
| id                      | INTEGER PK   | Auto-increment ID                 |
| image_path              | VARCHAR(500) | Path to uploaded image            |
| annotated_image_path    | VARCHAR(500) | Path to image with bounding boxes |
| waste_type              | VARCHAR(50)  | Broad category (e.g., "plastic")  |
| waste_subtype           | VARCHAR(50)  | Sub-type (e.g., "pet")            |
| confidence              | FLOAT        | AI detection confidence (0.0-1.0) |
| bbox_x1                 | FLOAT        | Bounding box coordinates          |
| bbox_y1                 | FLOAT        |                                   |
| bbox_x2                 | FLOAT        |                                   |
| bbox_y2                 | FLOAT        |                                   |
| estimated_area_cm2      | FLOAT        | Estimated surface area            |
| estimated_volume_m3     | FLOAT        | Estimated volume                  |
| estimated_mass_kg       | FLOAT        | Estimated mass                    |
| energy_incineration_kwh | FLOAT        | Energy via incineration           |
| energy_pyrolysis_kwh    | FLOAT        | Energy via pyrolysis              |
| energy_biogas_kwh       | FLOAT        | Energy via biogas                 |
| energy_gasification_kwh | FLOAT        | Energy via gasification           |
| energy_plasma_kwh       | FLOAT        | Energy via plasma arc             |
| energy_recycling_kwh    | FLOAT        | Energy saved via recycling        |
| best_method             | VARCHAR(50)  | Recommended conversion method     |
| best_energy_kwh         | FLOAT        | Highest energy value              |
| co2_saved_kg            | FLOAT        | CO₂ reduction                     |
| methane_saved_kg        | FLOAT        | Methane prevention                |
| water_saved_liters      | FLOAT        | Water saved                       |
| landfill_diverted_m3    | FLOAT        | Landfill volume saved             |
| trees_equivalent        | FLOAT        | Equivalent trees planted          |
| homes_powered_days      | FLOAT        | Homes powered in days             |
| recommendation_text     | TEXT         | AI recommendation text            |
| created_at              | DATETIME     | Timestamp                         |

### Table: `energy_reports`

| Column             | Type         | Description                   |
| ------------------ | ------------ | ----------------------------- |
| id                 | INTEGER PK   | Auto-increment ID             |
| report_type        | VARCHAR(20)  | "weekly", "monthly", "custom" |
| period_start       | DATETIME     | Report period start           |
| period_end         | DATETIME     | Report period end             |
| total_records      | INTEGER      | Number of analyses in period  |
| total_waste_kg     | FLOAT        | Total waste mass              |
| total_energy_kwh   | FLOAT        | Total energy potential        |
| total_co2_saved_kg | FLOAT        | Total CO₂ saved               |
| file_path          | VARCHAR(500) | Path to generated PDF         |
| created_at         | DATETIME     | Timestamp                     |

---

## 🖥️ Frontend Pages

### Page 1: Landing / Upload (`index.html`)

```
┌─────────────────────────────────────────────────┐
│  🟢 Smart Waste to Energy Platform    [Dashboard]│
├─────────────────────────────────────────────────┤
│                                                  │
│     ┌───────────────────────────────────┐        │
│     │                                   │        │
│     │     📸 Drag & Drop Image Here     │        │
│     │                                   │        │
│     │     or click to browse            │        │
│     │                                   │        │
│     │     Supports: JPG, PNG, WEBP      │        │
│     │     Max size: 10MB                │        │
│     └───────────────────────────────────┘        │
│                                                  │
│     [============================] 100%           │
│                                                  │
│     ┌─ Preview ─────────────────────┐            │
│     │  [uploaded image thumbnail]    │            │
│     └───────────────────────────────┘            │
│                                                  │
│              [ 🔍 Analyze Waste ]                │
│                                                  │
│  ── Quick Stats ──────────────────────────────   │
│  │ 📊 1,234 Items │ ⚡ 5,678 kWh │ 🌍 890 kg │ │
│  │   Analyzed     │   Generated   │  CO₂ Saved │ │
│  ──────────────────────────────────────────────  │
└─────────────────────────────────────────────────┘
```

### Page 2: Analysis Result (`analysis.html`)

```
┌─────────────────────────────────────────────────┐
│  ← Back                Analysis Result           │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Detected Objects ──────────────────────────┐ │
│  │  [Image with bounding boxes drawn]           │ │
│  │  🟢 Plastic (PET) — 92%                     │ │
│  │  🔵 Metal (Aluminum) — 87%                  │ │
│  │  🟤 Organic (Fruit) — 78%                   │ │
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Object 1: PET Plastic ─────────────────────┐│
│  │  Mass: 0.025 kg │ Volume: 500 cm³           ││
│  │                                              ││
│  │  ⚡ Energy Potential:                        ││
│  │  ┌─ Bar Chart ────────────────────┐          ││
│  │  │ Pyrolysis    ████████████ 0.32 │          ││
│  │  │ Plasma Arc   ███████████  0.28 │          ││
│  │  │ Gasification ████████    0.22  │          ││
│  │  │ Incineration ██████      0.18  │          ││
│  │  └────────────────────────────────┘          ││
│  │                                              ││
│  │  🌍 Environmental Impact:                    ││
│  │  CO₂: 0.045 kg │ Water: 0.4L │ 🌳 0.002    ││
│  │                                              ││
│  │  🤖 Recommendation: PYROLYSIS                ││
│  │  "Send to pyrolysis plant for bio-oil"       ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  [ 📄 Download PDF Report ] [ 🔄 Analyze More ] │
└─────────────────────────────────────────────────┘
```

### Page 3: Dashboard (`dashboard.html`)

```
┌─────────────────────────────────────────────────┐
│  📊 Dashboard                      [Live 🟢]    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │  1,234  │ │ 5,678   │ │  890    │ │  456   ││
│  │  Items  │ │  kWh    │ │ kg CO₂  │ │ Trees  ││
│  │Analyzed │ │ Energy  │ │  Saved  │ │ Equiv  ││
│  └─────────┘ └─────────┘ └─────────┘ └────────┘│
│                                                  │
│  ┌─ Waste Distribution ──┐ ┌─ Energy by Method ┐│
│  │     [PIE CHART]       │ │   [BAR CHART]      ││
│  │  Plastic 35%          │ │  Pyrolysis  ████   ││
│  │  Organic 25%          │ │  Biogas     ███    ││
│  │  Paper   15%          │ │  Gasify     ██     ││
│  │  Metal   10%          │ │  Incinerate █      ││
│  │  Other   15%          │ │                    ││
│  └───────────────────────┘ └────────────────────┘│
│                                                  │
│  ┌─ Monthly Trends ─────────────────────────────┐│
│  │           [LINE CHART]                        ││
│  │  ____/‾‾‾\___/‾‾‾‾‾‾\___  Waste (kg)        ││
│  │  ___/‾‾‾‾‾\__/‾‾‾‾‾‾‾\__  Energy (kWh)      ││
│  │  Jan  Feb  Mar  Apr  May                      ││
│  └───────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Recent Analyses ────────────────────────────┐│
│  │  # │ Type    │ Mass  │ Energy │ CO₂   │ Time ││
│  │  1 │ Plastic │ 0.5kg │ 2.1kWh│ 0.9kg │ 2m   ││
│  │  2 │ Organic │ 1.2kg │ 1.8kWh│ 0.4kg │ 5m   ││
│  │  3 │ Metal   │ 0.3kg │ saved │ 0.7kg │ 12m  ││
│  └───────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

---

## 🚀 Installation & Setup

```bash
# 1. Clone / Navigate to project
cd smart_waste_energy

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the server
python run.py

# 5. Open browser
# → http://localhost:8000
```

### Requirements

- Python 3.10+
- Intel CPU (for OpenVINO optimization) — AMD/ARM works too (falls back to ONNX)
- 4GB+ RAM recommended
- Webcam optional (for live capture)

---

## 📖 Usage Guide

### Analyze Waste Image

1. Open `http://localhost:8000`
2. Drag & drop a waste image (or click to browse)
3. Click "Analyze Waste"
4. View results — detected objects, energy potential, environmental impact
5. Optionally refine sub-types from dropdown
6. Download PDF report

### View Dashboard

1. Go to `http://localhost:8000/dashboard`
2. See real-time charts and statistics
3. Dashboard auto-updates via WebSocket when new analyses happen

### View History

1. Go to `http://localhost:8000/history`
2. Search by waste type, date range
3. Sort by any column
4. Click any record for full detail

### Generate Reports

1. Go to dashboard → Click "Generate Report"
2. Select period (week/month/all)
3. Download PDF with full analysis

---

## 🔮 Future Enhancements

- [ ] IoT Smart Bin integration (sensors → automatic analysis)
- [ ] Mobile app (React Native / Flutter)
- [ ] Multi-language support (Hindi, English, Regional)
- [ ] GPS location tracking (waste hotspot mapping)
- [ ] Community leaderboard (gamification)
- [ ] Municipal body integration (government reporting)
- [ ] Drone-based waste detection
- [ ] Blockchain-based waste tracking
- [ ] Carbon credit calculation
- [ ] Real-time camera feed analysis

---

## 👨‍💻 Author

**Jatin Sachdeva** — 229310366

---

## 📜 License

This project is for educational/academic purposes.

---

> _"Every piece of waste is energy waiting to be recovered."_
