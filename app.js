function $(id){ return document.getElementById(id); }

function round(n){ return Math.round(n); }

function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

function calcSodiumMg({ miles, saunaMin, neatSteps, hardDay }) {
  // Very practical heuristic ranges (not medical advice):
  // baseline 2000–3000 mg, plus extra for sweat and long/hard work.
  let sodium = 2500;

  // Running sweat + fluid turnover
  sodium += miles * 150;              // ~150 mg per mile as a conservative add-on

  // Steps/NEAT contributes some sweat + turnover
  sodium += (neatSteps / 10000) * 250;

  // Sauna adds meaningful sweat loss
  sodium += saunaMin * 30;            // ~30 mg per minute conservative estimate

  // Hard day bump
  if(hardDay) sodium += 300;

  return round(sodium);
}

function calculate(){
  const bmr = +$("bmr").value;
  const kcalPerMile = +$("kcalPerMile").value;
  const surplusBase = +$("surplus").value;
  const kcalPer10kSteps = +$("kcalPer10kSteps").value;

  const bw = +$("bw").value;
  const miles = +$("miles").value;
  const neatSteps = +$("neatSteps").value;
  const liftCals = +$("liftCals").value;
  const saunaMin = +$("saunaMin").value;

  const hardDay = $("hardDay").checked;
  const aggressiveBulk = $("aggressiveBulk").checked;

  const runCals = miles * kcalPerMile;
  const neatCals = (neatSteps / 10000) * kcalPer10kSteps;

  // Surplus logic
  let surplus = surplusBase;
  if (aggressiveBulk) surplus += 150;
  // If hard day, bias toward more carbs rather than just adding calories.
  // Calories stay the same; macro partition changes below.

  const maintenance = bmr + runCals + neatCals + liftCals;
  const target = maintenance + surplus;

  // -------------------
  // Macro logic
  // -------------------

  // Protein:
  // Base: 0.9 g/lb, floor 170g; if lifting, floor 180g.
  let protein = bw * 0.9;
  protein = Math.max(protein, 170);
  if (liftCals > 0) protein = Math.max(protein, 180);
  protein = round(protein);

  // Fat:
  // Base 0.35–0.45 g/lb depending on run volume.
  // More running → slightly lower fat target so carbs can rise.
  let fatPerLb = 0.42;
  if (miles >= 8) fatPerLb = 0.38;
  if (miles >= 12) fatPerLb = 0.35;

  // Hard day: bias slightly lower fat to leave room for carbs
  if (hardDay) fatPerLb -= 0.03;

  fatPerLb = clamp(fatPerLb, 0.30, 0.45);
  let fat = round(bw * fatPerLb);

  // Carbs fill remainder
  const proteinCals = protein * 4;
  const fatCals = fat * 9;

  let carbCals = target - proteinCals - fatCals;
  let carbs = round(carbCals / 4);

  // If hard day and carbs are oddly low, bump carbs and reduce fat slightly.
  // This is just to keep the output sane.
  if (hardDay && carbs < 300) {
    const needed = 300 - carbs;
    carbs += needed;
    // remove equivalent calories from fat if possible
    const fatReduction = Math.ceil((needed * 4) / 9);
    fat = Math.max(40, fat - fatReduction);
  }

  const sodium = calcSodiumMg({ miles, saunaMin, neatSteps, hardDay });

  $("results").innerHTML = `
    <div class="resultsGrid">
      <div><strong>Maintenance</strong><div>${round(maintenance)} kcal</div></div>
      <div><strong>Target</strong><div>${round(target)} kcal</div></div>
      <div><strong>Run</strong><div>${round(runCals)} kcal</div></div>
      <div><strong>NEAT</strong><div>${round(neatCals)} kcal</div></div>
      <div><strong>Lifting</strong><div>${round(liftCals)} kcal</div></div>
      <div><strong>Surplus</strong><div>${round(surplus)} kcal</div></div>
    </div>

    <hr/>

    <div class="resultsGrid">
      <div><strong>Protein</strong><div>${protein} g</div></div>
      <div><strong>Carbs</strong><div>${carbs} g</div></div>
      <div><strong>Fat</strong><div>${fat} g</div></div>
      <div><strong>Sodium</strong><div>~${sodium} mg</div></div>
    </div>

    <p class="muted">
      Priority order: calories → protein → carbs → fats.
    </p>
  `;
}

function applyPreset(name){
  // Presets are just starting points.
  // Adjust miles/steps/lift/sauna to match reality.
  if(name === "rest"){
    $("miles").value = 0;
    $("neatSteps").value = 10000;
    $("liftCals").value = 0;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
  }
  if(name === "lift"){
    $("miles").value = 0;
    $("neatSteps").value = 10000;
    $("liftCals").value = 350;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
  }
  if(name === "easy"){
    $("miles").value = 6;
    $("neatSteps").value = 10000;
    $("liftCals").value = 350;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
  }
  if(name === "speed"){
    $("miles").value = 7.5;
    $("neatSteps").value = 10000;
    $("liftCals").value = 350;
    $("saunaMin").value = 0;
    $("hardDay").checked = true;
  }
  if(name === "long"){
    $("miles").value = 12.5;
    $("neatSteps").value = 8000;
    $("liftCals").value = 0;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
  }
  calculate();
}

document.querySelectorAll("input").forEach(input=>{
  input.addEventListener("input", calculate);
});

document.querySelectorAll("button[data-preset]").forEach(btn=>{
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

calculate();
