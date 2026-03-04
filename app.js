function $(id){ return document.getElementById(id); }
function round(n){ return Math.round(n); }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

function lbToKg(lb){ return lb * 0.45359237; }
function milesToKm(mi){ return mi * 1.609344; }

function stepsToMiles(steps, strideIn){
  // distance = steps * stride_length
  // strideIn inches -> feet -> miles
  const feet = steps * (strideIn / 12);
  return feet / 5280;
}

function estimateLiftCalories(liftMin, effort, bwKg){
  // Simple MET model:
  // Resistance training commonly falls roughly 3.5–6+ MET depending on density/effort.
  // We'll map effort 1–5 to MET 3.5–6.5.
  const met = 3.5 + (effort - 1) * (3.0/4.0); // 3.5 -> 6.5
  const kcalPerMin = met * 3.5 * bwKg / 200;
  return kcalPerMin * liftMin;
}

// ACSM-style running equation (treadmill):
// VO2 (ml/kg/min) = 0.2*speed + 0.9*speed*grade + 3.5
// speed in m/min; grade as fraction (e.g. 1% = 0.01)
// kcal/min ≈ VO2 * kg / 1000 * 5
// Source used widely in exercise physiology summaries.  [oai_citation:5‡IDEA Health & Fitness Association](https://www.ideafit.com/wp-content/uploads/files/_archive/062005_calculatin.pdf?utm_source=chatgpt.com)
function treadmillRunCalories({ minutes, mph, gradePct, bwKg }){
  const speedMmin = mph * 26.8224; // 1 mph = 26.8224 m/min
  const grade = gradePct / 100;
  const vo2 = (0.2 * speedMmin) + (0.9 * speedMmin * grade) + 3.5; // ml/kg/min
  const kcalPerMin = (vo2 * bwKg / 1000) * 5;
  return kcalPerMin * minutes;
}

function distanceRunCalories({ miles, bwKg, runKcalPerKgKm }){
  // Approximate distance cost (kcal/kg/km). Running is often ~1.0 kcal/kg/km.
  //  [oai_citation:6‡PubMed](https://pubmed.ncbi.nlm.nih.gov/3732253/?utm_source=chatgpt.com)
  const km = milesToKm(miles);
  return runKcalPerKgKm * bwKg * km;
}

function estimateTEF({ proteinG, carbsG, fatG }){
  // TEF rough estimate using typical ranges:
  // protein 20–30%, carbs 5–10%, fat 0–3%.  [oai_citation:7‡PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC524030/?utm_source=chatgpt.com)
  const p = proteinG * 4, c = carbsG * 4, f = fatG * 9;
  const tef = (p * 0.25) + (c * 0.07) + (f * 0.02);
  return tef;
}

function calcSodiumMg({ miles, saunaMin, neatSteps, runType, liftMin }){
  // Practical heuristic (not medical):
  // baseline + run + steps + sauna.
  let sodium = 2300;

  // Run adds sweat + turnover; long/quality tends to add more
  const runMult = (runType === "quality") ? 220 : (runType === "long") ? 200 : (runType === "easy") ? 160 : 0;
  sodium += miles * runMult;

  // Steps add a bit (varies wildly with sweat rate)
  sodium += (neatSteps / 10000) * 200;

  // Sauna meaningful sweat loss
  sodium += saunaMin * 35;

  // Lift adds some
  sodium += (liftMin > 0) ? 150 : 0;

  return round(sodium);
}

function calculate(){
  const bwLb = +$("bwLb").value;
  const bwKg = lbToKg(bwLb);

  const bmr = +$("bmr").value;
  const surplusBase = +$("surplus").value;

  const neatSteps = +$("neatSteps").value;
  const strideIn = +$("strideIn").value;

  const liftMin = +$("liftMin").value;
  const liftEffort = +$("liftEffort").value;

  const saunaMin = +$("saunaMin").value;

  const runType = $("runType").value; // none/easy/quality/long
  const runMethod = $("runMethod").value; // distance/treadmill

  const runMiles = +$("runMiles").value;
  const runMin = +$("runMin").value;
  const tmMph = +$("tmMph").value;
  const tmGrade = +$("tmGrade").value;

  const walkKcalPerKgKm = +$("walkKcalPerKgKm").value;
  const runKcalPerKgKm = +$("runKcalPerKgKm").value;

  const aggressiveBulk = $("aggressiveBulk").checked;

  // NEAT calories: steps -> distance -> kcal/kg/km
  const neatMiles = stepsToMiles(neatSteps, strideIn);
  const neatKm = milesToKm(neatMiles);
  const neatCals = walkKcalPerKgKm * bwKg * neatKm;

  // Lifting calories via MET model
  const liftCals = estimateLiftCalories(liftMin, liftEffort, bwKg);

  // Run calories
  let runCals = 0;
  let milesForSodium = 0;

  if(runType !== "none"){
    if(runMethod === "treadmill"){
      runCals = treadmillRunCalories({ minutes: runMin, mph: tmMph, gradePct: tmGrade, bwKg });
      // estimate miles for sodium display consistency
      milesForSodium = (runMin > 0) ? (tmMph * (runMin/60)) : 0;
    } else {
      runCals = distanceRunCalories({ miles: runMiles, bwKg, runKcalPerKgKm });
      milesForSodium = runMiles;
    }
  }

  // Sauna calories: small; leave as conservative and not a big lever.
  // Dry sauna energy cost isn't huge; you care more about hydration/sodium.
  const saunaCals = saunaMin * 2.0;

  // Surplus
  let surplus = surplusBase + (aggressiveBulk ? 150 : 0);

  const maintenance = bmr + neatCals + liftCals + runCals + saunaCals;
  const target = maintenance + surplus;

  // -------------------
  // Macro targets
  // -------------------
  // Protein: prioritize hypertrophy
  // 0.85–1.0 g/lb typical; keep simple + floors.
  let protein = Math.max(round(bwLb * 0.9), 170);
  if(liftMin >= 30) protein = Math.max(protein, 180);

  // Fat: minimum floor for hormones/satiety; lower on quality/long days to leave room for carbs.
  let fatPerLb = 0.40;
  if(runType === "quality") fatPerLb = 0.34;
  if(runType === "long") fatPerLb = 0.33;
  fatPerLb = clamp(fatPerLb, 0.30, 0.45);
  let fat = round(bwLb * fatPerLb);
  fat = Math.max(fat, 45);

  // Carb floors by day type (supports training + glycogen)
  let carbFloor = 200;
  if(runType === "easy") carbFloor = 280;
  if(runType === "quality") carbFloor = 340;
  if(runType === "long") carbFloor = 380;
  // If no run but lifting: moderate floor
  if(runType === "none" && liftMin >= 30) carbFloor = 240;

  // Fill carbs from remaining calories
  const proteinCals = protein * 4;
  const fatCals = fat * 9;

  let carbCals = target - proteinCals - fatCals;
  let carbs = round(carbCals / 4);

  // Enforce carb floor; adjust fat downward if needed
  if(carbs < carbFloor){
    const need = carbFloor - carbs;
    carbs += need;
    const fatReduction = Math.ceil((need * 4) / 9);
    fat = Math.max(40, fat - fatReduction);
  }

  // TEF estimate (for transparency, not to micromanage)
  const tef = estimateTEF({ proteinG: protein, carbsG: carbs, fatG: fat });

  const sodium = calcSodiumMg({
    miles: milesForSodium,
    saunaMin,
    neatSteps,
    runType,
    liftMin
  });

  const runMilesDisplay = (runType === "none")
    ? 0
    : (runMethod === "treadmill" ? (tmMph * (runMin/60)) : runMiles);

  $("results").innerHTML = `
    <div class="resultsGrid">
      <div class="pill">
        <div class="muted small">Target</div>
        <div class="kpi">${round(target)} kcal</div>
      </div>
      <div class="pill">
        <div class="muted small">Maintenance</div>
        <div class="kpi">${round(maintenance)} kcal</div>
      </div>
      <div class="pill">
        <div class="muted small">Surplus</div>
        <div class="kpi">+${round(surplus)} kcal</div>
      </div>
    </div>

    <hr/>

    <div class="resultsGrid">
      <div class="pill"><div class="muted small">Protein</div><div class="kpi">${protein} g</div></div>
      <div class="pill"><div class="muted small">Carbs</div><div class="kpi">${carbs} g</div></div>
      <div class="pill"><div class="muted small">Fat</div><div class="kpi">${fat} g</div></div>
    </div>

    <div class="divider"></div>

    <div class="resultsGrid">
      <div class="pill"><div class="muted small">Run</div><div class="kpi">${round(runCals)} kcal</div><div class="muted small">${round(runMilesDisplay*10)/10} mi</div></div>
      <div class="pill"><div class="muted small">NEAT</div><div class="kpi">${round(neatCals)} kcal</div><div class="muted small">${round(neatMiles*10)/10} mi walk</div></div>
      <div class="pill"><div class="muted small">Lift</div><div class="kpi">${round(liftCals)} kcal</div><div class="muted small">${liftMin} min • effort ${liftEffort}/5</div></div>
    </div>

    <div class="divider"></div>

    <div class="resultsGrid">
      <div class="pill"><div class="muted small">Sodium (rough)</div><div class="kpi">~${sodium} mg</div></div>
      <div class="pill"><div class="muted small">TEF estimate</div><div class="kpi">~${round(tef)} kcal</div><div class="muted small">Explains why “usable” can feel lower.  [oai_citation:8‡PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC524030/?utm_source=chatgpt.com)</div></div>
      <div class="pill"><div class="muted small">Method</div><div class="kpi">${runMethod === "distance" ? "Distance" : "Treadmill"}</div></div>
    </div>

    <p class="muted small" style="margin-top:10px;">
      Notes: Running calories scale mainly with body mass × distance; treadmill equation uses speed+grade+time.  [oai_citation:9‡PubMed](https://pubmed.ncbi.nlm.nih.gov/3732253/?utm_source=chatgpt.com)
    </p>
  `;
}

function applyPreset(name){
  // Minimal presets (you override reality).
  if(name === "rest"){
    $("runType").value = "none";
    $("runMiles").value = 0;
    $("runMin").value = 0;
    $("neatSteps").value = 10000;
    $("liftMin").value = 0;
    $("liftEffort").value = 1;
    $("saunaMin").value = 0;
  }
  if(name === "lift"){
    $("runType").value = "none";
    $("runMiles").value = 0;
    $("runMin").value = 0;
    $("neatSteps").value = 10000;
    $("liftMin").value = 45;
    $("liftEffort").value = 3;
    $("saunaMin").value = 0;
  }
  if(name === "easy"){
    $("runType").value = "easy";
    $("runMiles").value = 6.0;
    $("runMin").value = 45;
    $("neatSteps").value = 10000;
    $("liftMin").value = 45;
    $("liftEffort").value = 3;
    $("saunaMin").value = 0;
  }
  if(name === "quality"){
    $("runType").value = "quality";
    $("runMiles").value = 7.5;
    $("runMin").value = 55;
    $("neatSteps").value = 10000;
    $("liftMin").value = 45;
    $("liftEffort").value = 3;
    $("saunaMin").value = 0;
  }
  if(name === "long"){
    $("runType").value = "long";
    $("runMiles").value = 12.5;
    $("runMin").value = 95;
    $("neatSteps").value = 8000;
    $("liftMin").value = 0;
    $("liftEffort").value = 1;
    $("saunaMin").value = 0;
  }
  calculate();
}

document.querySelectorAll("input, select").forEach(el=>{
  el.addEventListener("input", calculate);
  el.addEventListener("change", calculate);
});

document.querySelectorAll("button[data-preset]").forEach(btn=>{
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

calculate();
