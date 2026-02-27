
function $(id){ return document.getElementById(id); }

function calculate(){

  const bmr = +$("bmr").value;
  const kcalPerMile = +$("kcalPerMile").value;
  const surplus = +$("surplus").value;

  const bw = +$("bw").value;
  const miles = +$("miles").value;
  const neatSteps = +$("neatSteps").value;
  const liftCals = +$("liftCals").value;

  const runCals = miles * kcalPerMile;
  const neatCals = (neatSteps / 10000) * 420;

  const maintenance = bmr + runCals + neatCals + liftCals;
  const target = maintenance + surplus;

  // --- Macro Logic ---

  // Protein
  let protein = bw * 0.9;
  if(liftCals > 0) protein = Math.max(protein, 180);
  protein = Math.round(protein);

  // Fat
  let fat = bw * 0.4;
  fat = Math.round(fat);

  // Carbs fill remainder
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbCals = target - proteinCals - fatCals;
  const carbs = Math.round(carbCals / 4);

  $("results").innerHTML = `
    <p><strong>Maintenance:</strong> ${Math.round(maintenance)} kcal</p>
    <p><strong>Target:</strong> ${Math.round(target)} kcal</p>
    <hr>
    <p><strong>Protein:</strong> ${protein} g</p>
    <p><strong>Fat:</strong> ${fat} g</p>
    <p><strong>Carbs:</strong> ${carbs} g</p>
  `;
}

document.querySelectorAll("input").forEach(input=>{
  input.addEventListener("input", calculate);
});

calculate();


