function $(id){ return document.getElementById(id); }
function round(n){ return Math.round(n); }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

// --- Helpers ---
function lbToKg(lb){ return lb * 0.45359237; }

// Running calories:
// Very robust rule: ~1.0 kcal / kg / km
// Therefore: kcal = kg * km * runEff
function calcRunCals({ bwLb, miles, runEff }){
  const kg = lbToKg(bwLb);
  const km = miles * 1.609344;
  const eff = clamp(runEff, 0.85, 1.20); // guardrail
  return kg * km * eff;
}

// NEAT calories:
// default (simple): kcalPer10k * steps/10k
// optional (MET): steps→miles→hours, then kcal = MET * kg * hours
function calcNeatCals({ bwLb, neatSteps, neatModel, kcalPer10kSteps, stepsPerMile, walkMph, walkMET }){
  if(neatModel === "met"){
    const kg = lbToKg(bwLb);
    const spm = Math.max(1200, +stepsPerMile || 2000);
    const mph = Math.max(1.5, +walkMph || 3.0);
    const met = clamp(+walkMET || 3.3, 1.8, 6.0);

    const miles = neatSteps / spm;
    const hours = miles / mph;
    return met * kg * hours;
  }

  // Simple model (your original idea)
  const per10k = +kcalPer10kSteps || 420;
  return (neatSteps / 10000) * per10k;
}

// Lifting calories (simple but adjustable):
// default 5.5 kcal/min for moderate-hard hypertrophy sessions
function calcLiftCals({ liftMin, liftKcalPerMin }){
  const kpm = clamp(+liftKcalPerMin || 5.5, 2.0, 10.0);
  const mins = Math.max(0, +liftMin || 0);
  return mins * kpm;
}

// Sauna calories (small, adjustable):
function calcSaunaCals({ saunaMin, saunaKcalPerMin }){
  const kpm = clamp(+saunaKcalPerMin || 2.5, 0.0, 6.0);
  const mins = Math.max(0, +saunaMin || 0);
  return mins * kpm;
}

// Macro logic tuned for YOUR goals:
// - protein: ~0.9 g/lb (floor 170g) with slight bump on lift days
// - fat: 0.30–0.42 g/lb (lower on quality/long run days to leave room for carbs)
// - carbs: fill remaining calories
function calcMacros({ bwLb, targetKcal, dayType }){
  // Protein
  let protein = bwLb * 0.9;
  protein = Math.max(protein, 170);

  // Lift days: small floor bump
  if(dayType !== "rest") protein = Math.max(protein, 180);

  // Cap protein so it doesn’t crowd carbs
  protein = clamp(protein, 170, 220);
  protein = round(protein);

  // Fat per lb depends on day type
  let fatPerLb = 0.40; // default
  if(dayType === "easy") fatPerLb = 0.38;
  if(dayType === "quality") fatPerLb = 0.34;
  if(dayType === "long") fatPerLb = 0.33;
  if(dayType === "rest") fatPerLb = 0.42;

  fatPerLb = clamp(fatPerLb, 0.30, 0.45);
  let fat = round(bwLb * fatPerLb);

  // Guardrails
  fat = clamp(fat, 50, 110);

  const proteinCals = protein * 4;
  const fatCals = fat * 9;

  let carbCals = targetKcal - proteinCals - fatCals;
  if(carbCals < 0){
    // if inputs are weird, keep minimum carbs and reduce fat
    carbCals = 0;
  }
  let carbs = round(carbCals / 4);

  // Minimum carbs depending on training day:
  const minCarbs =
    (dayType === "quality") ? 320 :
    (dayType === "long") ? 350 :
    (dayType === "easy") ? 260 :
    (dayType === "lift") ? 220 :
    180;

  if(carbs < minCarbs){
    const need = minCarbs - carbs;
    carbs += need;
    // reduce fat to compensate if possible
    const fatDrop = Math.ceil((need * 4) / 9);
    fat = Math.max(45, fat - fatDrop);
  }

  return { protein, carbs, fat };
}

function calculate(){
  const bw = +$("bw").value || 147;
  const miles = +$("miles").value || 0;
  const neatSteps = +$("neatSteps").value || 0;
  const liftMin = +$("liftMin").value || 0;
  const saunaMin = +$("saunaMin").value || 0;

  const dayType = $("dayType").value;

  const bmr = +$("bmr").value || 1750;
  const surplusBase = +$("surplus").value || 300;
  const aggressiveBulk = $("aggressiveBulk").checked;

  const runEff = +$("runEff").value || 1.0;

  const neatModel = $("neatModel").value;
  const kcalPer10kSteps = +$("kcalPer10kSteps").value || 420;
  const stepsPerMile = +$("stepsPerMile").value || 2000;
  const walkMph = +$("walkMph").value || 3.0;
  const walkMET = +$("walkMET").value || 3.3;

  const liftKcalPerMin = +$("liftKcalPerMin").value || 5.5;
  const saunaKcalPerMin = +$("saunaKcalPerMin").value || 2.5;

  // Activity calories
  const runCals = calcRunCals({ bwLb: bw, miles, runEff });
  const neatCals = calcNeatCals({
    bwLb: bw, neatSteps, neatModel,
    kcalPer10kSteps, stepsPerMile, walkMph, walkMET
  });
  const liftCals = calcLiftCals({ liftMin, liftKcalPerMin });
  const saunaCals = calcSaunaCals({ saunaMin, saunaKcalPerMin });

  // Surplus
  let surplus = surplusBase;
  if(aggressiveBulk) surplus += 150;

  // Maintenance and target
  const maintenance = bmr + runCals + neatCals + liftCals + saunaCals;
  const target = maintenance + surplus;

  const macros = calcMacros({ bwLb: bw, targetKcal: target, dayType });

  $("results").innerHTML = `
    <div class="tile">
      <div class="k">Target calories</div>
      <div class="v">${round(target)} kcal</div>
      <div class="small">Maintenance ${round(maintenance)} + surplus ${round(surplus)}</div>
    </div>

    <div class="tile">
      <div class="k">Macros</div>
      <div class="v">${macros.protein}P / ${macros.carbs}C / ${macros.fat}F</div>
      <div class="small">Protein fixed first, carbs fill, fat adjusted by day type</div>
    </div>

    <div class="tile">
      <div class="k">Run calories</div>
      <div class="v">${round(runCals)} kcal</div>
      <div class="small">~1.0 kcal/kg/km × efficiency (${runEff.toFixed(2)})</div>
    </div>

    <div class="tile">
      <div class="k">NEAT calories</div>
      <div class="v">${round(neatCals)} kcal</div>
      <div class="small">${neatModel === "met" ? "MET model" : "Simple per-10k model"}</div>
    </div>

    <div class="tile">
      <div class="k">Lifting calories</div>
      <div class="v">${round(liftCals)} kcal</div>
      <div class="small">${round(liftMin)} min × ${(+liftKcalPerMin).toFixed(1)} kcal/min</div>
    </div>

    <div class="tile">
      <div class="k">Sauna calories</div>
      <div class="v">${round(saunaCals)} kcal</div>
      <div class="small">${round(saunaMin)} min × ${(+saunaKcalPerMin).toFixed(1)} kcal/min</div>
    </div>
  `;
}

function applyPreset(name){
  // Presets set dayType and typical values. You still enter real data.
  if(name === "rest"){
    $("dayType").value = "rest";
    $("miles").value = 0;
    $("neatSteps").value = 10000;
    $("liftMin").value = 0;
    $("saunaMin").value = 0;
  }
  if(name === "lift"){
    $("dayType").value = "lift";
    $("miles").value = 0;
    $("neatSteps").value = 10000;
    $("liftMin").value = 60;
    $("saunaMin").value = 0;
  }
  if(name === "easy"){
    $("dayType").value = "easy";
    $("miles").value = 6;
    $("neatSteps").value = 10000;
    $("liftMin").value = 60;
    $("saunaMin").value = 0;
  }
  if(name === "quality"){
    $("dayType").value = "quality";
    $("miles").value = 7.5;
    $("neatSteps").value = 9000;
    $("liftMin").value = 60;
    $("saunaMin").value = 0;
  }
  if(name === "long"){
    $("dayType").value = "long";
    $("miles").value = 12.5;
    $("neatSteps").value = 8000;
    $("liftMin").value = 0;
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
