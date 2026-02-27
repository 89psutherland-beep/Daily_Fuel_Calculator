// Daily Fueling Calculator
// Local-only. Saves settings in localStorage.

const $ = (id) => document.getElementById(id);

const fields = [
  "bmr", "kcalPerMile", "surplus",
  "miles", "steps", "stepsIncludeRun",
  "kcalPer10kSteps", "liftCals",
  "bikeMin", "bikeKcalPerHour",
  "saunaMin", "saunaKcalPerHour"
];

function readNumber(id) {
  const el = $(id);
  const v = el.type === "checkbox" ? el.checked : el.value;
  if (el.type === "checkbox") return !!v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(n) {
  return Math.round(n);
}

function saveState() {
  const state = {};
  for (const f of fields) {
    state[f] = readNumber(f);
  }
  localStorage.setItem("fueling_state_v1", JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem("fueling_state_v1");
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    for (const f of fields) {
      const el = $(f);
      if (!el) continue;
      if (el.type === "checkbox") {
        el.checked = !!state[f];
      } else if (state[f] !== undefined && state[f] !== null) {
        el.value = state[f];
      }
    }
  } catch {
    // ignore
  }
}

// Core logic
function calculate() {
  const bmr = readNumber("bmr");
  const kcalPerMile = readNumber("kcalPerMile");
  const surplus = readNumber("surplus");

  const miles = readNumber("miles");
  const steps = readNumber("steps");
  const stepsIncludeRun = readNumber("stepsIncludeRun");
  const kcalPer10kSteps = readNumber("kcalPer10kSteps");
  const liftCals = readNumber("liftCals");

  const bikeMin = readNumber("bikeMin");
  const bikeKcalPerHour = readNumber("bikeKcalPerHour");

  const saunaMin = readNumber("saunaMin");
  const saunaKcalPerHour = readNumber("saunaKcalPerHour");

  // Run calories (simple model)
  const runCals = miles * kcalPerMile;

  // Steps calories:
  // If steps include run, still treat steps as total NEAT — do not subtract run steps by default.
  // This is intentionally simple. If you want to subtract run steps later, we can add a toggle.
  const stepsCals = (steps / 10000) * kcalPer10kSteps;

  // Bike & sauna
  const bikeCals = (bikeMin / 60) * bikeKcalPerHour;
  const saunaCals = (saunaMin / 60) * saunaKcalPerHour;

  const maint = bmr + runCals + stepsCals + liftCals + bikeCals + saunaCals;
  const target = maint + surplus;

  // Output
  $("outBmr").textContent = `${round(bmr)} kcal`;
  $("outRun").textContent = `${round(runCals)} kcal`;
  $("outSteps").textContent = `${round(stepsCals)} kcal`;
  $("outLift").textContent = `${round(liftCals)} kcal`;
  $("outBike").textContent = `${round(bikeCals)} kcal`;
  $("outSauna").textContent = `${round(saunaCals)} kcal`;
  $("outMaint").textContent = `${round(maint)} kcal`;
  $("outTarget").textContent = `${round(target)} kcal`;

  const summary =
`Inputs
- BMR: ${round(bmr)} kcal
- Run: ${miles.toFixed(1)} mi @ ${round(kcalPerMile)} kcal/mi = ${round(runCals)} kcal
- Steps: ${round(steps)} steps @ ${round(kcalPer10kSteps)} kcal/10k = ${round(stepsCals)} kcal
- Lifting: ${round(liftCals)} kcal
- Bike: ${round(bikeMin)} min @ ${round(bikeKcalPerHour)} kcal/hr = ${round(bikeCals)} kcal
- Sauna: ${round(saunaMin)} min @ ${round(saunaKcalPerHour)} kcal/hr = ${round(saunaCals)} kcal

Outputs
- Maintenance estimate: ${round(maint)} kcal
- Target (+${round(surplus)}): ${round(target)} kcal`;

  $("summary").textContent = summary;

  saveState();
}

function resetToday() {
  $("miles").value = 0;
  $("steps").value = 10000;
  $("bikeMin").value = 0;
  $("saunaMin").value = 0;
  calculate();
}

function copySummary() {
  const text = $("summary").textContent || "";
  navigator.clipboard.writeText(text).then(() => {
    $("copyBtn").textContent = "Copied";
    setTimeout(() => ($("copyBtn").textContent = "Copy summary"), 1000);
  });
}

// Bind
for (const f of fields) {
  const el = $(f);
  if (!el) continue;
  el.addEventListener("input", calculate);
  el.addEventListener("change", calculate);
}

$("resetBtn").addEventListener("click", resetToday);
$("copyBtn").addEventListener("click", copySummary);

loadState();
calculate();
