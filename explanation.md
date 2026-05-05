# Detailed Explanation of the "wasted" Project

This document provides a comprehensive explanation of the "Smart Waste to Energy Platform" project contained within the `wasted` folder.

## 1. Project Overview

The "Smart Waste to Energy Platform" is an advanced, AI-driven application designed to analyze waste materials from images, estimate their potential for energy recovery, and quantify the associated environmental benefits.

The core philosophy is to treat waste not as a problem but as a valuable resource.

### Key Goals:

*   **Automated Waste Analysis:** To automatically identify and classify different types of waste from an uploaded image.
*   **Energy Potential Estimation:** To calculate the amount of energy that can be generated from the detected waste through various conversion technologies.
*   **Environmental Impact Assessment:** To measure the positive environmental effects of waste-to-energy conversion, such as reduced greenhouse gas emissions.
*   **Data-Driven Insights:** To provide users with actionable data through a real-time dashboard, historical records, and downloadable reports.
*   **Intelligent Recommendations:** To suggest the most suitable energy conversion pathway for different types of waste.

## 2. System Architecture

The project is a full-stack web application with a clear separation between the backend processing and the frontend user interface.

*   **Frontend (Client-Side):** A modern web application built with **Next.js (React)**. This is what the user interacts with in their browser. It's responsible for the user interface, including the upload zone, dashboard, charts, and reports.
*   **Backend (Server-Side):** A powerful **Python** application that acts as the brain of the system. It exposes a REST API for the frontend to consume. Its responsibilities include:
    *   Handling file uploads.
    *   Running the AI model for waste detection.
    *   Performing calculations for mass, energy, and environmental impact.
    *   Managing the database.
    *   Serving data to the frontend.
*   **AI Model:** A **YOLOv11** object detection model, optimized with **Intel's OpenVINO** toolkit. This allows for high-speed, CPU-based inference, making the AI accessible without expensive GPU hardware.
*   **Database:** A **SQLite** database file (`waste_energy.db`) stores all persistent data, making the application self-contained and easy to set up.

## 3. Directory Structure Explained

Below is a detailed breakdown of each directory and its purpose.

---

### `app/`

This is the heart of the Python backend application.

*   **`main.py`**: The main entry point for the backend server. It likely initializes the web server (e.g., Flask or FastAPI) and wires up all the different parts of the application.
*   **`config.py`**: Contains configuration settings for the application, such as database paths, model locations, and other constants.

*   **`routes/`**: This directory defines all the API endpoints that the frontend can call.
    *   `upload.py`: Handles the logic for image uploads.
    *   `records.py`: Manages fetching and creating waste analysis records.
    *   `dashboard.py`: Provides data specifically for the main dashboard view.
    *   `analytics.py`: Serves data for the analytics page, likely for trends and forecasts.
    *   `reports.py`: Logic for generating and downloading PDF reports.
    *   `websocket.py`: Manages the real-time WebSocket connection to push live updates to the frontend.

*   **`services/`**: This is where the core business logic resides. The routes call these services to perform the actual work.
    *   `ai_classifier.py`: Contains the logic to load and run the YOLO AI model on an image.
    *   `depth_estimator.py`, `size_estimator.py`: These services estimate the physical size and mass of the detected waste objects.
    *   `energy_calculator.py`: Calculates the potential energy output based on the waste type and mass.
    *   `environmental.py`: Calculates the environmental impact metrics.
    *   `report_generator.py`: The service responsible for creating the PDF reports.
    *   `forecasting.py`, `recommendation.py`: Advanced services for predicting future waste trends and recommending optimal processing methods.

*   **`models/`**: Defines the structure of the database tables.
    *   `database.py`: Contains the setup code for connecting to the SQLite database.
    *   `waste_record.py`, `energy_report.py`: These files define the schema for the main database tables, likely using an ORM like SQLAlchemy.

*   **`utils/`**: A place for helper functions and utility code that is used across different parts of the backend.

---

### `frontend/`

This directory contains the entire Next.js frontend application.

*   **`app/`**: The main source code for the frontend pages, following the Next.js App Router structure.
    *   `page.tsx`: The main landing/upload page.
    *   `layout.tsx`: The main layout component that wraps all pages, likely including the header and sidebar.
    *   `dashboard/page.tsx`, `analytics/page.tsx`, etc.: Each of these folders represents a different page/route in the application.

*   **`components/`**: Contains reusable React components that are used to build the pages.
    *   `layout/`: Components for the overall page structure, like `Header.tsx` and `Sidebar.tsx`.
    *   `dashboard/`, `analyze/`, `analytics/`: Components specific to each page, such as charts, cards, and data displays.
    *   `ui/`: Generic, reusable UI components like `Button.tsx`, `Card.tsx`, `Input.tsx`.

*   **`lib/`**: Frontend library code.
    *   `api.ts`: Functions for making API calls to the Python backend.
    *   `types.ts`: TypeScript type definitions for the data objects used in the application (e.g., `WasteRecord`, `EnergyReport`).
    *   `utils.ts`: General utility functions for the frontend.

*   **`package.json`**: Defines the frontend project's dependencies (like React, Next.js, Chart.js, Tailwind CSS) and scripts for running, building, and testing the frontend.

---

### `models/` (Root)

This directory stores the trained AI model files.

*   **`yolo11n.pt`**: The original PyTorch-trained YOLO model file.
*   **`yolo11n_openvino_model/`**: The converted and optimized OpenVINO model. This is what the application uses for inference to achieve high performance on CPUs. It consists of an `.xml` file (the model architecture) and a `.bin` file (the model weights, not listed but implied).

---

### Other Key Files & Directories

*   **`run.py`**: A simple script to start the backend server. It likely just calls the `main.py` file.
*   **`requirements.txt`**: Lists all the Python libraries that the backend depends on (e.g., Flask, OpenCV, OpenVINO, SQLAlchemy). This file is used to set up the Python environment.
*   **`convert_model.py`**: A utility script used by the developers to convert the original PyTorch model (`.pt`) into the OpenVINO format.
*   **`data/`**: Contains sample or required data files. `waste_energy_data.json` likely holds the base values for energy content and density for different waste materials.
*   **`uploads/`**: The directory where user-uploaded images are temporarily stored for processing.
*   **`reports/`**: The directory where generated PDF reports are saved.
*   **`templates/`, `static/`**: These directories contain HTML templates and static assets (CSS, JS, images) for a simpler, non-React version of the application, or for parts of the backend that might render HTML directly (like for report previews).
*   **`README.md`**: The file you are reading now, providing an overview of the project.
*   **`waste_energy.db`**: The SQLite database file. This file is created when the application runs for the first time and stores all the application's data.
*   **`kernel.errors.txt`**: A log file that likely captures any errors that occur during the execution of the backend processes.

This detailed structure shows a well-thought-out application that separates concerns effectively, making it scalable, maintainable, and highly functional.
