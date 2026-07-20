function calculatePoints({ category, place, grade, isGeneral }, config) {
  // Map textual places to numbers if necessary
  const placeMap = {
    First: 1,
    Second: 2,
    Third: 3,
    "1": 1,
    "2": 2,
    "3": 3
  };

  const numericPlace = placeMap[place] || parseInt(place, 10);
  let categoryPoints = 0;

  if (numericPlace && numericPlace >= 1 && numericPlace <= 3) {
    if (isGeneral) {
      if (config?.general) {
        if (numericPlace === 1) categoryPoints = config.general.first;
        if (numericPlace === 2) categoryPoints = config.general.second;
        if (numericPlace === 3) categoryPoints = config.general.third;
      } else {
        if (numericPlace === 1) categoryPoints = 25;
        if (numericPlace === 2) categoryPoints = 15;
        if (numericPlace === 3) categoryPoints = 10;
      }
    } else {
      if (config) {
        const base = {
          A: { 1: config.catA?.first ?? 12, 2: config.catA?.second ?? 8, 3: config.catA?.third ?? 4 },
          B: { 1: config.catB?.first ?? 10, 2: config.catB?.second ?? 6, 3: config.catB?.third ?? 3 },
          C: { 1: config.catC?.first ?? 25, 2: config.catC?.second ?? 15, 3: config.catC?.third ?? 10 }
        };
        categoryPoints = base[category]?.[numericPlace] || 0;
      } else {
        const base = {
          A: { 1: 12, 2: 8, 3: 4 },
          B: { 1: 10, 2: 6, 3: 3 },
          C: { 1: 25, 2: 15, 3: 10 }
        };
        categoryPoints = base[category]?.[numericPlace] || 0;
      }
    }
  }

  // Calculate Grade Points
  let gradePoints = 0;
  if (config?.grades) {
    if (grade === "A+") gradePoints = config.grades.ap;
    else if (grade === "A") gradePoints = config.grades.a;
    else if (grade === "B") gradePoints = config.grades.b;
    else if (grade === "C") gradePoints = config.grades.c;
  } else {
    if (grade === "A+") gradePoints = 7;
    else if (grade === "A") gradePoints = 5;
    else if (grade === "B") gradePoints = 3;
    else if (grade === "C") gradePoints = 1;
  }

  return categoryPoints + gradePoints;
}


module.exports = { calculatePoints };
