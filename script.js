// ============================================================================
// Mental Health Score Predictor — vanilla JS frontend
// Talks to the existing FastAPI backend's POST /predict endpoint.
// Field names/ranges/options below mirror backend/main.py's `student_data`
// Pydantic model exactly — do not rename fields here without updating main.py.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. API configuration — the ONLY place the backend URL is defined.
//    Change this to match where your FastAPI server is running.
// ---------------------------------------------------------------------------
const API_BASE_URL = "https://mental-health-score-prediction-vefa.onrender.com";
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;

// ---------------------------------------------------------------------------
// 2. Field schema — mirrors backend/main.py
// ---------------------------------------------------------------------------
const TOP_COUNTRIES = ["India", "USA", "Canada", "Australia", "UK", "Germany", "Mexico", "Turkey", "France"];

const ALL_COUNTRIES = [
  ...TOP_COUNTRIES,
  "Argentina", "Bangladesh", "Brazil", "Chile", "China", "Colombia", "Egypt",
  "Indonesia", "Ireland", "Italy", "Japan", "Kenya", "Malaysia", "Netherlands",
  "New Zealand", "Nigeria", "Pakistan", "Philippines", "Poland", "Portugal",
  "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
  "Sweden", "Switzerland", "Thailand", "UAE", "Vietnam", "Other",
];

const FIELD_LIMITS = {
  age: { min: 0, max: 100 },
  avg_daily_usage_hours: { min: 6, max: 24 },
  daily_unlocks: { min: 0, max: null },
  study_hours: { min: 0, max: 24 },
  physical_activity_hours: { min: 0, max: 24 },
  sleep_hours_per_night: { min: 0, max: 24 },
};

const FIELD_LABELS = {
  age: "Age",
  gender: "Gender",
  country: "Country",
  academic_level: "Academic level",
  most_used_platform: "Most used platform",
  purpose_of_use: "Purpose of use",
  avg_daily_usage_hours: "Average daily usage",
  daily_unlocks: "Daily unlocks",
  study_hours: "Study hours",
  physical_activity_hours: "Physical activity hours",
  sleep_hours_per_night: "Sleep per night",
  stress_level: "Stress level",
};

const STEP_FIELDS = {
  1: ["age", "gender", "country", "academic_level"],
  2: ["most_used_platform", "purpose_of_use", "avg_daily_usage_hours", "daily_unlocks"],
  3: ["study_hours", "physical_activity_hours", "sleep_hours_per_night", "stress_level"],
};

const SUMMARY_ROWS = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "country", label: "Country" },
  { key: "academic_level", label: "Academic level" },
  { key: "most_used_platform", label: "Most used platform" },
  { key: "purpose_of_use", label: "Purpose of use" },
  { key: "avg_daily_usage_hours", label: "Daily usage", suffix: "hrs" },
  { key: "daily_unlocks", label: "Daily unlocks" },
  { key: "study_hours", label: "Study hours", suffix: "hrs" },
  { key: "physical_activity_hours", label: "Physical activity", suffix: "hrs" },
  { key: "sleep_hours_per_night", label: "Sleep", suffix: "hrs" },
  { key: "stress_level", label: "Stress level" },
];

// ---------------------------------------------------------------------------
// 3. State
// ---------------------------------------------------------------------------
const state = {
  step: 1,
  phase: "landing", // landing | form | loading | result | error
};

// ---------------------------------------------------------------------------
// 4. DOM references
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const hero = $("hero");
const workspace = $("workspace");
const wizardCard = $("wizardCard");
const loadingPanel = $("loadingPanel");
const wizardForm = $("wizardForm");
const wizardNav = $("wizardNav");
const errorCard = $("errorCard");
const resultStack = $("resultStack");

const startBtn = $("startBtn");
const backBtn = $("backBtn");
const continueBtn = $("continueBtn");
const predictBtn = $("predictBtn");
const retryBtn = $("retryBtn");
const predictAgainBtn = $("predictAgainBtn");

const stepperCount = $("stepperCount");
const stepperLabel = $("stepperLabel");
const stepperFill = $("stepperFill");

const STEP_LABELS = { 1: "Personal information", 2: "Digital usage", 3: "Lifestyle & wellbeing" };

// ---------------------------------------------------------------------------
// 5. Init: populate the country datalist
// ---------------------------------------------------------------------------
function initCountryOptions() {
  const datalist = $("countryOptions");
  datalist.innerHTML = ALL_COUNTRIES.map((c) => `<option value="${c}"></option>`).join("");
}

// ---------------------------------------------------------------------------
// 6. Form helpers
// ---------------------------------------------------------------------------
function readFormData() {
  const data = {};
  Object.keys(FIELD_LABELS).forEach((field) => {
    const el = $(field);
    data[field] = el.value;
  });
  return data;
}

function validateField(field, value) {
  const limits = FIELD_LIMITS[field];

  if (value === "" || value === null || value === undefined) {
    return `${FIELD_LABELS[field]} is required.`;
  }

  if (limits) {
    const num = Number(value);
    if (Number.isNaN(num)) return `${FIELD_LABELS[field]} must be a number.`;
    if (num < limits.min || (limits.max !== null && num > limits.max)) {
      return limits.max === null
        ? `Please enter ${FIELD_LABELS[field].toLowerCase()} of ${limits.min} or more.`
        : `Please enter ${FIELD_LABELS[field].toLowerCase()} between ${limits.min} and ${limits.max}.`;
    }
  }

  return null;
}

function showFieldError(field, message) {
  const errorEl = $(`${field}-error`);
  const controlEl = $(field)?.closest(".field__control");
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    controlEl?.classList.add("field__control--error");
  } else {
    errorEl.hidden = true;
    controlEl?.classList.remove("field__control--error");
  }
}

function validateStep(step) {
  const data = readFormData();
  let valid = true;
  STEP_FIELDS[step].forEach((field) => {
    const message = validateField(field, data[field]);
    showFieldError(field, message);
    if (message) valid = false;
  });
  return valid;
}

function buildPayload() {
  const data = readFormData();
  return {
    age: Number(data.age),
    gender: data.gender,
    country: data.country,
    academic_level: data.academic_level,
    most_used_platform: data.most_used_platform,
    purpose_of_use: data.purpose_of_use,
    avg_daily_usage_hours: Number(data.avg_daily_usage_hours),
    daily_unlocks: Number(data.daily_unlocks),
    study_hours: Number(data.study_hours),
    physical_activity_hours: Number(data.physical_activity_hours),
    sleep_hours_per_night: Number(data.sleep_hours_per_night),
    stress_level: data.stress_level,
  };
}

// ---------------------------------------------------------------------------
// 7. Step / wizard navigation
// ---------------------------------------------------------------------------
function renderStepper() {
  stepperCount.textContent = `Step ${state.step} of 3`;
  stepperLabel.textContent = STEP_LABELS[state.step];
  stepperFill.style.width = `${((state.step - 1) / 2) * 100}%`;
  [1, 2, 3].forEach((n) => {
    const node = $(`node${n}`);
    node.classList.toggle("stepper__node--done", n <= state.step);
    node.classList.toggle("stepper__node--current", n === state.step);
  });
}

function showStep(step) {
  [1, 2, 3].forEach((n) => {
    $(`step${n}`).hidden = n !== step;
  });
  backBtn.disabled = step === 1;
  continueBtn.hidden = step === 3;
  predictBtn.hidden = step !== 3;
  renderStepper();
}

function goNext() {
  if (!validateStep(state.step)) return;
  state.step = Math.min(state.step + 1, 3);
  showStep(state.step);
  scrollToWorkspace();
}

function goBack() {
  state.step = Math.max(state.step - 1, 1);
  showStep(state.step);
  scrollToWorkspace();
}

function scrollToWorkspace() {
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// 8. Phase transitions
// ---------------------------------------------------------------------------
function setPhase(phase) {
  state.phase = phase;

  hero.hidden = phase !== "landing";
  workspace.hidden = phase === "landing";

  wizardCard.hidden = !(phase === "form" || phase === "loading");
  wizardForm.hidden = phase === "loading";
  loadingPanel.hidden = phase !== "loading";

  errorCard.hidden = phase !== "error";
  resultStack.hidden = phase !== "result";
}

function resetForm() {
  wizardForm.reset();
  Object.keys(FIELD_LABELS).forEach((field) => showFieldError(field, null));
  $("avg_daily_usage_hours").value = 6;
  updateUsageLabel();
  state.step = 1;
  showStep(1);
}

// ---------------------------------------------------------------------------
// 9. Slider label
// ---------------------------------------------------------------------------
function updateUsageLabel() {
  $("usageValue").textContent = `${$("avg_daily_usage_hours").value} hrs / day`;
}

// ---------------------------------------------------------------------------
// 10. API call + error handling
// ---------------------------------------------------------------------------
async function submitPrediction(payload) {
  let response;
  try {
    response = await fetch(PREDICT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw {
      title: "Unable to connect to the prediction server.",
      subtext: "Please make sure the FastAPI backend is running and try again.",
    };
  }

  if (response.status === 422) {
    const body = await safeJson(response);
    throw {
      title: "We couldn't validate your responses.",
      subtext: formatValidationErrors(body),
    };
  }

  if (!response.ok) {
    throw {
      title: "Something went wrong while generating the prediction.",
      subtext: "Please try again.",
    };
  }

  const data = await safeJson(response);
  if (!data || typeof data.predicted_mental_health_score !== "number") {
    throw {
      title: "Something went wrong while generating the prediction.",
      subtext: "The server response was not in the expected format. Please try again.",
    };
  }

  return data;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatValidationErrors(body) {
  if (!body || !Array.isArray(body.detail) || body.detail.length === 0) {
    return "Please check your answers and try again.";
  }
  return body.detail
    .map((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "field";
      return `${String(field).replace(/_/g, " ")}: ${err.msg}`;
    })
    .join(" · ");
}

// ---------------------------------------------------------------------------
// 11. Result rendering
// ---------------------------------------------------------------------------
function renderResult(score, submittedData) {
  $("gaugeScore").textContent = score;

  // The backend doesn't publish a documented min/max range for the score,
  // so the ring is a decorative reveal animation (not a literal fraction
  // of an invented scale) — the raw number is always shown as-is.
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const progress = $("gaugeProgress");
  progress.style.strokeDasharray = circumference;
  progress.style.strokeDashoffset = circumference;
  requestAnimationFrame(() => {
    progress.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)";
    progress.style.strokeDashoffset = circumference * (1 - 0.82);
  });

  const grid = $("summaryGrid");
  grid.innerHTML = SUMMARY_ROWS.filter((r) => submittedData[r.key] !== "" && submittedData[r.key] != null)
    .map(
      (r) => `
      <div class="summary-card__row">
        <dt>${r.label}</dt>
        <dd>${submittedData[r.key]}${r.suffix ? ` ${r.suffix}` : ""}</dd>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// 12. Ambient neural-field canvas (decorative, same effect as the React build)
// ---------------------------------------------------------------------------
function initNeuralField(canvas, density = 46) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width, height, dpr, nodes = [], raf;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const count = Math.round((width * height) / 22000) + 8;
    nodes = Array.from({ length: Math.min(count, density) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.6 + 1,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 150;
        if (dist < maxDist) {
          ctx.strokeStyle = `rgba(106, 99, 224, ${0.14 * (1 - dist / maxDist)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15, 139, 141, 0.38)";
      ctx.fill();
    });

    if (!prefersReducedMotion) raf = requestAnimationFrame(step);
  }

  resize();
  step();
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    resize();
    step();
  });
}

// ---------------------------------------------------------------------------
// 13. Event wiring
// ---------------------------------------------------------------------------
startBtn.addEventListener("click", () => {
  setPhase("form");
  requestAnimationFrame(scrollToWorkspace);
});

continueBtn.addEventListener("click", goNext);
backBtn.addEventListener("click", goBack);

$("avg_daily_usage_hours").addEventListener("input", updateUsageLabel);

predictBtn.addEventListener("click", async () => {
  const allValid = [1, 2, 3].map(validateStep).every(Boolean);
  if (!allValid) {
    // jump to the first invalid step
    const firstInvalidStep = [1, 2, 3].find((s) => !validateStep(s));
    if (firstInvalidStep) {
      state.step = firstInvalidStep;
      showStep(firstInvalidStep);
    }
    return;
  }

  setPhase("loading");

  try {
    const submitted = readFormData();
    const payload = buildPayload();
    const data = await submitPrediction(payload);
    renderResult(data.predicted_mental_health_score, submitted);
    setPhase("result");
  } catch (err) {
    $("errorTitle").textContent = err.title || "Something went wrong while generating the prediction.";
    $("errorSubtitle").textContent = err.subtext || "Please try again.";
    setPhase("error");
  }
  requestAnimationFrame(scrollToWorkspace);
});

retryBtn.addEventListener("click", () => setPhase("form"));

predictAgainBtn.addEventListener("click", () => {
  resetForm();
  setPhase("form");
  requestAnimationFrame(scrollToWorkspace);
});

// ---------------------------------------------------------------------------
// 14. Boot
// ---------------------------------------------------------------------------
initCountryOptions();
initNeuralField($("heroField"), 54);
initNeuralField($("resultField"), 30);
showStep(1);
setPhase("landing");
