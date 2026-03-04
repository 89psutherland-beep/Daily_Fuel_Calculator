// app.js
function $(id){ return document.getElementById(id); }
function round(n){ return Math.round(n); }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

const STRIDE_IN = 30;            // fixed stride length per your request
const IN_PER_MILE = 63360;
const WALK_MPH = 3.0;            // used to convert distance -> time for ACSM equation
const SAUNA_KCAL_PER_MIN = 2.0;  // conservative
const RUN_KCAL_PER_KG_PER_KM = 1.036; // validated running cost constant

// Lift intensity mapping (kcal/min)
// Range grounded in typical resistance training estimates (~3–9 kcal/min)
const LIFT_KCAL_MIN = {
  1: 3.0,   // very easy / long rests
  2: 4.0,   // easy-moderate
  3: 5.5,   // typical hypertrophy session
  4: 7.0,   // dense session / shorter rests
  5: 8.5    // very hard / high density
};

let selectedIntensity = 3;

function setIntensity(n){
  selectedIntensity = n;
  document.querySelectorAll(".segBtn").forEach(b=>{
    b.classList.toggle("active", +b.dataset.intensity === n);
  });
  const rate = LIFT_KCAL_MIN[n];
  $("liftKcalHint").textContent = `Using ~${rate.toFixed(1)} kcal/min`;
  calculate();
}

function runCalories({ bwLb, runMiles }){
  // kcal ≈ 1.036 kcal/kg/km
  const kg = bwLb * 0.45359237;
  const km = runMiles * 1.609344;
  return RUN_KCAL_PER_KG_PER_KM * kg * km;
}

function neatCaloriesFromSteps({ bwLb, steps }){
  // steps -> distance with fixed stride
  const miles = (steps * STRIDE_IN) / IN_PER_MILE;

  // distance -> time with assumed walk speed (mph)
  const hours = miles / WALK_MPH;
  const minutes = hours * 60;

  // ACSM walking equation (flat):
  // VO2 (mL/kg/min) = 0.1 * speed(m/min) + 3.5
  // speed(m/min) = mph * 26.8224
  const speed_m_min = WALK_MPH * 26.8224;
  const vo2 = (0.1 * speed_m_min) + 3.5;

  // kcal/min = VO2 * kg / 200
  const kg = bwLb * 0.45359237;
  const kcalPerMin = (vo2 * kg) / 200;

  return kcalPerMin * minutes;
}

function liftCalories({ liftMin }){
  const rate = LIFT_KCAL_MIN[selectedIntensity] ?? LIFT_KCAL_MIN[3];
  return liftMin * rate;
}

function saunaCalories({ saunaMin }){
  return saunaMin * SAUNA_KCAL_PER_MIN;
}

function calcSodiumMg({ runMiles, saunaMin, steps, hardDay }){
  // Practical heuristic (not medical):
  // baseline + run + steps + sauna + hard day bump
  let sodium = 2500;
  sodium += runMiles * 150;
  sodium += (steps / 10000) * 250;
  sodium += saunaMin * 30;
  if (hardDay) sodium += 300;
  return round(sodium);
}

function calculate(){
  const bwLb = +$("bwLb").value || 0;
  const bmr = +$("bmr").value || 0;
  const surplusBase = +$("surplus").value || 0;
  const tefFactor = +$("tefFactor").value || 0.90;

  const runMilesVal = +$("runMiles").value || 0;
  const stepsVal = +$("steps").value || 0;
  const liftMinVal = +$("liftMin").value || 0;
  const saunaMinVal = +$("saunaMin").value || 0;

  const hardDay = $("hardDay").checked;
  const aggressiveBulk = $("aggressiveBulk").checked;

  const runCals = runCalories({ bwLb, runMiles: runMilesVal });
  const neatCals = neatCaloriesFromSteps({ bwLb, steps: stepsVal });
  const liftCals = liftCalories({ liftMin: liftMinVal });
  const saunaCals = saunaCalories({ saunaMin: saunaMinVal });

  let surplus = surplusBase + (aggressiveBulk ? 150 : 0);

  const maintenance = bmr + runCals + neatCals + liftCals + saunaCals;

  // TEF adjustment: intake target = (maintenance + surplus) / tefFactor
  const target = (maintenance + surplus) / clamp(tefFactor, 0.80, 0.95);

  // -------------------
  // Macro targets
  // -------------------
  // Protein: 0.9 g/lb, floors
  let protein = bwLb * 0.90;
  protein = Math.max(protein, 170);
  if (liftMinVal > 0) protein = Math.max(protein, 180);
  protein = round(protein);

  // Fat: vary with run volume; keep sane bounds
  let fatPerLb = 0.42;
  if (runMilesVal >= 6) fatPerLb = 0.40;
  if (runMilesVal >= 10) fatPerLb = 0.37;
  if (runMilesVal >= 13) fatPerLb = 0.35;
  if (hardDay) fatPerLb -= 0.03;

  fatPerLb = clamp(fatPerLb, 0.30, 0.45);
  let fat = round(bwLb * fatPerLb);

  // Carbs fill remainder
  let carbs = round((target - (protein * 4) - (fat * 9)) / 4);

  // Guardrails: ensure carbs not absurdly low
  // (hybrid + bulking tends to need carbs)
  const minCarbs = hardDay ? 280 : 220;
  if (carbs < minCarbs){
    const needed = minCarbs - carbs;
    carbs += needed;
    // pull calories from fat first if possible
    const fatReduction = Math.ceil((needed * 4) / 9);
    fat = Math.max(45, fat - fatReduction);
  }

  const sodium = calcSodiumMg({ runMiles: runMilesVal, saunaMin: saunaMinVal, steps: stepsVal, hardDay });

  $("results").innerHTML = `
    <div class="boxGrid">
      <div class="box"><div class="k">Maintenance</div><div class="v">${round(maintenance)} kcal</div></div>
      <div class="box"><div class="k">Target (TEF-adjusted)</div><div class="v">${round(target)} kcal</div></div>
      <div class="box"><div class="k">Surplus (input)</div><div class="v">${round(surplus)} kcal</div></div>
    </div>

    <hr/>

    <div class="boxGrid">
      <div class="box"><div class="k">Run</div><div class="v">${round(runCals)} kcal</div></div>
      <div class="box"><div class="k">Steps (NEAT)</div><div class="v">${round(neatCals)} kcal</div></div>
      <div class="box"><div class="k">Lift</div><div class="v">${round(liftCals)} kcal</div></div>
      <div class="box"><div class="k">Sauna</div><div class="v">${round(saunaCals)} kcal</div></div>
      <div class="box"><div class="k">Sodium</div><div class="v">~${sodium} mg</div></div>
      <div class="box"><div class="k">TEF factor</div><div class="v">${clamp(tefFactor,0.80,0.95).toFixed(2)}</div></div>
    </div>

    <hr/>

    <div class="boxGrid">
      <div class="box"><div class="k">Protein</div><div class="v">${protein} g</div></div>
      <div class="box"><div class="k">Carbs</div><div class="v">${carbs} g</div></div>
      <div class="box"><div class="k">Fat</div><div class="v">${fat} g</div></div>
    </div>
  `;
}

function applyPreset(name){
  if(name === "rest"){
    $("runMiles").value = 0;
    $("steps").value = 10000;
    $("liftMin").value = 0;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
    setIntensity(1);
  }
  if(name === "lift"){
    $("runMiles").value = 0;
    $("steps").value = 10000;
    $("liftMin").value = 55;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
    setIntensity(3);
  }
  if(name === "easy"){
    $("runMiles").value = 6;
    $("steps").value = 10000;
    $("liftMin").value = 55;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
    setIntensity(3);
  }
  if(name === "hard"){
    $("runMiles").value = 7.5;
    $("steps").value = 10000;
    $("liftMin").value = 55;
    $("saunaMin").value = 0;
    $("hardDay").checked = true;
    setIntensity(3);
  }
  if(name === "long"){
    $("runMiles").value = 12.5;
    $("steps").value = 8000;
    $("liftMin").value = 0;
    $("saunaMin").value = 0;
    $("hardDay").checked = false;
    setIntensity(1);
  }
  calculate();
}

document.querySelectorAll("input").forEach(input=>{
  input.addEventListener("input", calculate);
});

document.querySelectorAll("button[data-preset]").forEach(btn=>{
  btn.addEventListener("click", ()=>applyPreset(btn.dataset.preset));
});

document.querySelectorAll(".segBtn").forEach(btn=>{
  btn.addEventListener("click", ()=>setIntensity(+btn.dataset.intensity));
});

// init
setIntensity(3);
calculate();
