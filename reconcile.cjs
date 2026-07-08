const fs = require('fs');

const teamRoster = {
  "ALIYA SALISA": {
    "TEAM A": [
      "ABDUL SAMAD S",
      "AHMAD MIQDAD K P",
      "HARSHAD P",
      "MUHAMMED NIHAL",
      "MUHAMMAD HABEEB S",
      "MUHAMMED HISHAM",
      "MARUWAN S"
    ],
    "TEAM B": [
      "SALMANUL FARIS UK",
      "AHAMMED ASHFAK K A",
      "MUHAMMED FARIS CA",
      "MAHMOOD FAYIS E",
      "MUJEEB RAHMAN K",
      "MUHAMMAD RAFIH",
      "ALTHAF",
      "ABDUL RASAK. V"
    ],
    "TEAM C": [
      "MUHAMMED SHAHID",
      "MUHAMMED MIRAZ P",
      "MOHAMMED JIRSHAD",
      "DILSHAD MUHAMMED",
      "MUHAMMED MINHAJ",
      "MUHAMMAD AFINAS",
      "MUHAMMED SINAN",
      "MUHAMMED SANAD"
    ]
  },
  "ALIYA SANIYA": {
    "TEAM A": [
      "ASHMIL OMAR MUHAMMED",
      "MOHAMMED AFNAN P",
      "MOHAMMAD RIZWAN P K",
      "MUHAMMAD ALI SHIHAB K P",
      "AFRAD E",
      "MUHAMMED HASHIM P"
    ],
    "TEAM B": [
      "MUHAMMED YAZEEN S",
      "MOHAMMED SANI",
      "MUHAMMED MUJTHABA",
      "MUHAMMED MAHROOF P",
      "MUSFIR",
      "UMER FALAH"
    ],
    "TEAM C": [
      "MUHAMMED ZAHIR P",
      "AJSAL",
      "NISAMUDHEEN",
      "MUHAMMED HASHIR TN",
      "MOHAMMED SINAJ",
      "MUHAMMED MARZOOQUE NP"
    ]
  },
  "ALIYA ULA": {
    "TEAM A": [
      "MOHAMMED AFLAH E",
      "ADIL MUHAMMED TP",
      "MUHAMMED SUFYAN TK",
      "MUAHMMED ARSHAD",
      "MUHAMMED MINSHAD",
      "MOHAMMED SABIQ.N",
      "MUHAMMED SWALIH R",
      "MUHAMMED ANSAR",
      "MUHAMMED SHIFAS",
      "SABITH KT",
      "MUHAMMED SHAMIL VC"
    ],
    "TEAM B": [
      "MOHAMMED HISHAM K",
      "AMEEN TA",
      "AHMAD SHAHEER K",
      "MUHAMMED SHAMIL .M",
      "MUHAMMAD FARHAN",
      "MUHAMMED RIDHAN PP",
      "MUHAMMED NASEEF K",
      "S M JAZEEL",
      "IBRAHIM SHA KAMAL",
      "IBRAHIM ARIF S",
      "KHAJA MUEENUDHEEN"
    ],
    "TEAM C": [
      "AFLAH PP",
      "SANEEN N",
      "MUHAMMED ANSAF C",
      "AJNAD ALI TP",
      "AMAN MUHAMMED",
      "MUHAMMED CKP",
      "MUSTHAEEN",
      "MUHAMMED SABIR",
      "MUHSIN JAVAD",
      "MUHAMMED SHAMIL.KP"
    ]
  },
  "THAMHEEDIYYA SANIYA": {
    "TEAM A": [
      "AMEEN A",
      "MEHTHAB AHMAD P",
      "MUHAMMAD HISHAM KK",
      "RISHAD P",
      "MUHAMMED SABITH . N",
      "MUHAMMED NISHAN OPV",
      "MOHAMMED MURSHID KARADAN",
      "MUHAMMED IRFAD KK",
      "MUHYUDHEEN NISHAN K",
      "SHIBILISHAN TV",
      "MUHAMMED RAZIN K"
    ],
    "TEAM B": [
      "MUHAMMED RAJIL SHAN KP",
      "MUHAMMED SAHNOON PA",
      "MUHAMMED HUSAIN. P",
      "MUHAMMED SHAMIL K",
      "MUHAMMED AFTHAH",
      "MUHAMMAD SIMAK",
      "SALMAN S",
      "MUHAMMED SAVAD KK",
      "HAMRAS FARIS",
      "MUHAMMED SHAFEEQ",
      "FAREED KORADAN"
    ],
    "TEAM C": [
      "ISMAIL S",
      "ARSAL MARJAN K K",
      "FARZIN FILSUF NAVAS",
      "FAYAZ MUJEEB",
      "MOHAMMED SINAN M",
      "MOHAMMED RABIE MK",
      "MUHAMMAD SINAN",
      "MOHAMMED HADHI MM",
      "MUHAMMED ZAYAN A",
      "ABDUL VAHAB KK",
      "MUHAMMED MUSTHAFA N"
    ]
  },
  "THAMHEEDIYYA ULA": {
    "TEAM A": [
      "ISMAYIL ZAIN PM",
      "MUHAMMED IHSAN",
      "FARHAN NM",
      "MUHAMMED FARHAN",
      "HABEEBU RAHMAN",
      "AFZAL AM",
      "NUBHAN AHMAD",
      "MUHAMMED RAZAN"
    ],
    "TEAM B": [
      "MUHAMMED YASEEN. P",
      "ABULLA AHIL",
      "MUHAMMED AMEEN",
      "AMEENU RAHMAN",
      "MUHAMMED SHAMVEEL",
      "MOHAMMAD FASIL. TK",
      "MUHAMMED SWALIH"
    ],
    "TEAM C": [
      "ABUL HASAN A",
      "MOHAMMED MUJTHABA NM",
      "MUHAMMED AJSAL P",
      "MUHAMMED SABAH",
      "ASLAM NAVAS",
      "MUHAMMED SINAN P",
      "SAYYID MIHAL PP",
      "MOHAMMAD KENZ P"
    ]
  }
};

const rawStudents = [
  // ALIYA SALISA
  { cic: "20194", name: "ABDUL SAMAD S", cls: "ALIYA SALISA" },
  { cic: "20195", name: "AHMAD MIQDAD K P", cls: "ALIYA SALISA" },
  { cic: "20198", name: "HARSHAD P", cls: "ALIYA SALISA" },
  { cic: "20204", name: "MUHAMMED SHAHID", cls: "ALIYA SALISA" },
  { cic: "20206", name: "MUHAMMED NIHAL", cls: "ALIYA SALISA" },
  { cic: "20210", name: "SALMANUL FARIS UK", cls: "ALIYA SALISA" },
  { cic: "20213", name: "MUHAMMED MIRAZ P", cls: "ALIYA SALISA" },
  { cic: "20214", name: "AHAMMED ASHFAK K A", cls: "ALIYA SALISA" },
  { cic: "20497", name: "MUHAMMAD HABEEB S", cls: "ALIYA SALISA" },
  { cic: "20498", name: "MUHAMMED FARIS CA", cls: "ALIYA SALISA" },
  { cic: "20511", name: "MOHAMMED JIRSHAD", cls: "ALIYA SALISA" },
  { cic: "20525", name: "MAHMOOD FAYIS E", cls: "ALIYA SALISA" },
  { cic: "20527", name: "MUJEEB RAHMAN K", cls: "ALIYA SALISA" },
  { cic: "20529", name: "DILSHAD MUHAMMED", cls: "ALIYA SALISA" },
  { cic: "20532", name: "MUHAMMED SABIR.C", cls: "ALIYA SALISA" },
  { cic: "20533", name: "MUHAMMED HISHAM", cls: "ALIYA SALISA" },
  { cic: "20891", name: "MUHAMMAD RAFIH", cls: "ALIYA SALISA" },
  { cic: "20899", name: "MARUWAN S", cls: "ALIYA SALISA" },
  { cic: "20901", name: "ALTHAF", cls: "ALIYA SALISA" },
  { cic: "20905", name: "ABDUL RASAK. V", cls: "ALIYA SALISA" },
  { cic: "20909", name: "MUHAMMED MINHAJ", cls: "ALIYA SALISA" },
  { cic: "20911", name: "MUHAMMAD AFINAS", cls: "ALIYA SALISA" },
  { cic: "20915", name: "MUHAMMED SINAN", cls: "ALIYA SALISA" },
  { cic: "20916", name: "MUHAMMED SANAD", cls: "ALIYA SALISA" },

  // ALIYA SANIYA
  { cic: "20962", name: "MUHAMMED ZAHIR P", cls: "ALIYA SANIYA" },
  { cic: "20964", name: "MUHAMMED YAZEEN S", cls: "ALIYA SANIYA" },
  { cic: "21015", name: "AJSAL", cls: "ALIYA SANIYA" },
  { cic: "21016", name: "ASHMIL OMAR MUHAMMED", cls: "ALIYA SANIYA" },
  { cic: "21017", name: "MUHAMMED FASEEH C", cls: "ALIYA SANIYA" },
  { cic: "21018", name: "HASHIM MV", cls: "ALIYA SANIYA" },
  { cic: "21022", name: "MOHAMMED SANI", cls: "ALIYA SANIYA" },
  { cic: "21024", name: "MUHAMMED MUJTHABA", cls: "ALIYA SANIYA" },
  { cic: "21031", name: "MUHAMMED MAHROOF P", cls: "ALIYA SANIYA" },
  { cic: "21035", name: "MOHAMMED AFNAN P", cls: "ALIYA SANIYA" },
  { cic: "21036", name: "MOHAMMAD RIZWAN P K", cls: "ALIYA SANIYA" },
  { cic: "21044", name: "MUHAMMAD ALI SHIHAB K P", cls: "ALIYA SANIYA" },
  { cic: "21049", name: "NISAMUDHEEN", cls: "ALIYA SANIYA" },
  { cic: "21067", name: "MUHAMMED HASHIR TN", cls: "ALIYA SANIYA" },
  { cic: "21177", name: "MUSFIR", cls: "ALIYA SANIYA" },
  { cic: "21219", name: "MOHAMMED SINAJ", cls: "ALIYA SANIYA" },
  { cic: "21229", name: "MUHAMMED NAZIH", cls: "ALIYA SANIYA" },
  { cic: "21234", name: "AFRAD E", cls: "ALIYA SANIYA" },
  { cic: "21582", name: "MUHAMMED MARZOOQUE NP", cls: "ALIYA SANIYA" },
  { cic: "21626", name: "UMER FALAH", cls: "ALIYA SANIYA" },
  { cic: "23711", name: "MUHAMMED HASHIM P", cls: "ALIYA SANIYA" },

  // ALIYA ULA
  { cic: "21759", name: "MOHAMMED HISHAM K", cls: "ALIYA ULA" },
  { cic: "21724", name: "MOHAMMED AFLAH E", cls: "ALIYA ULA" },
  { cic: "21760", name: "AFLAH PP", cls: "ALIYA ULA" },
  { cic: "21762", name: "ADIL MUHAMMED TP", cls: "ALIYA ULA" },
  { cic: "21763", name: "AMEEN TA", cls: "ALIYA ULA" },
  { cic: "21765", name: "MUHAMMED SUFYAN TK", cls: "ALIYA ULA" },
  { cic: "21778", name: "AHMAD SHAHEER K", cls: "ALIYA ULA" },
  { cic: "21779", name: "SANEEN N", cls: "ALIYA ULA" },
  { cic: "21780", name: "MUAHMMED ARSHAD", cls: "ALIYA ULA" },
  { cic: "21782", name: "MUHAMMED SHAMIL .M", cls: "ALIYA ULA" },
  { cic: "21785", name: "MUHAMMED MINSHAD", cls: "ALIYA ULA" },
  { cic: "21824", name: "MUHAMMAD FARHAN", cls: "ALIYA ULA" },
  { cic: "21822", name: "MOHAMMED SABIQ.N", cls: "ALIYA ULA" },
  { cic: "22518", name: "MUHAMMED ANSAF C", cls: "ALIYA ULA" },
  { cic: "21886", name: "AJNAD ALI TP", cls: "ALIYA ULA" },
  { cic: "21887", name: "AMAN MUHAMMED", cls: "ALIYA ULA" },
  { cic: "21856", name: "MUHAMMED CKP", cls: "ALIYA ULA" },
  { cic: "22498", name: "MUHAMMED RIDHAN PP", cls: "ALIYA ULA" },
  { cic: "21813", name: "MUHAMMED SWALIH R", cls: "ALIYA ULA" },
  { cic: "21189", name: "MUHAMMED ANSAR", cls: "ALIYA ULA" },
  { cic: "21825", name: "MUHAMMED SHIFAS", cls: "ALIYA ULA" },
  { cic: "21816", name: "MUSTHAEEN", cls: "ALIYA ULA" },
  { cic: "", name: "SABITH KT", cls: "ALIYA ULA" },
  { cic: "", name: "MUHAMMED NASEEF K", cls: "ALIYA ULA" },
  { cic: "", name: "S M JAZEEL", cls: "ALIYA ULA" },
  { cic: "", name: "MUHAMMED SHAMIL VC", cls: "ALIYA ULA" },
  { cic: "", name: "MUHAMMED SABIR", cls: "ALIYA ULA" },
  { cic: "", name: "IBRAHIM SHA KAMAL", cls: "ALIYA ULA" },
  { cic: "21862", name: "IBRAHIM ARIF S", cls: "ALIYA ULA" },
  { cic: "22020", name: "MUHAMMED FAHIS", cls: "ALIYA ULA" },
  { cic: "21889", name: "MUHSIN JAVAD", cls: "ALIYA ULA" },
  { cic: "21832", name: "KHAJA MUEENUDHEEN", cls: "ALIYA ULA" },
  { cic: "21818", name: "MUHAMMED SHIBLY", cls: "ALIYA ULA" },
  { cic: "21784", name: "MUHAMMED SHAMIL.KP", cls: "ALIYA ULA" },

  // THAMHEEDIYYA SANIYA
  { cic: "22934", name: "MUHAMMED RAJIL SHAN KP", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22935", name: "MUHAMMED SAHNOON PA", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22936", name: "MUHAMMED HUSAIN. P", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22937", name: "ISMAIL S", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22938", name: "MUHAMMED SHAMIL K", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22940", name: "ARSAL MARJAN K K", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22941", name: "MUHAMMED AFTHAH", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22942", name: "AMEEN A", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22943", name: "MEHTHAB AHMAD P", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22945", name: "FARZIN FILSUF NAVAS", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22947", name: "MUHAMMAD HISHAM KK", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22948", name: "FAYAZ MUJEEB", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22949", name: "MOHAMMED SINAN M", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22951", name: "MUHAMMAD SIMAK", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22953", name: "RISHAD P", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22954", name: "MUHAMMED SABITH . N", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22955", name: "MOHAMMED RABIE MK", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22956", name: "SALMAN S", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22957", name: "MUHAMMED NISHAN OPV", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22958", name: "MOHAMMED MURSHID KARADAN", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22959", name: "MUHAMMED IRFAD KK", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22960", name: "MUHAMMED SAVAD KK", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22961", name: "MUHAMMAD SINAN", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22962", name: "MUHYUDHEEN NISHAN K", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22963", name: "MOHAMMED HADHI MM", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22964", name: "SHIBILISHAN TV", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22965", name: "MUHAMMED ZAYAN A", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22966", name: "ABDUL VAHAB KK", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22967", name: "HAMRAS FARIS", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22968", name: "MUHAMMED MUSTHAFA N", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22969", name: "MUHAMMED RAZIN K", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "22970", name: "MUHAMMED SHAFEEQ", cls: "THAMHEEDIYYA SANIYA" },
  { cic: "23622", name: "FAREED KORADAN", cls: "THAMHEEDIYYA SANIYA" },

  // THAMHEEDIYYA ULA
  { cic: "23977", name: "ISMAYIL ZAIN PM", cls: "THAMHEEDIYYA ULA" },
  { cic: "23978", name: "MUHAMMED IHSAN", cls: "THAMHEEDIYYA ULA" },
  { cic: "23979", name: "MUHAMMED YASEEN. P", cls: "THAMHEEDIYYA ULA" },
  { cic: "23980", name: "ABULLA AHIL", cls: "THAMHEEDIYYA ULA" },
  { cic: "23981", name: "ABUL HASAN A", cls: "THAMHEEDIYYA ULA" },
  { cic: "23983", name: "MUHAMMED AMEEN", cls: "THAMHEEDIYYA ULA" },
  { cic: "23984", name: "AMEENU RAHMAN", cls: "THAMHEEDIYYA ULA" },
  { cic: "23986", name: "FARHAN NM", cls: "THAMHEEDIYYA ULA" },
  { cic: "23988", name: "MUHAMMED FARHAN", cls: "THAMHEEDIYYA ULA" },
  { cic: "23990", name: "MOHAMMED MUJTHABA NM", cls: "THAMHEEDIYYA ULA" },
  { cic: "23992", name: "HABEEBU RAHMAN", cls: "THAMHEEDIYYA ULA" },
  { cic: "23993", name: "AFZAL AM", cls: "THAMHEEDIYYA ULA" },
  { cic: "23995", name: "MUHAMMED SHAMVEEL", cls: "THAMHEEDIYYA ULA" },
  { cic: "23996", name: "MOHAMMAD FASIL. TK", cls: "THAMHEEDIYYA ULA" },
  { cic: "23998", name: "MUHAMMED AJSAL P", cls: "THAMHEEDIYYA ULA" },
  { cic: "24000", name: "MUHAMMED SABAH", cls: "THAMHEEDIYYA ULA" },
  { cic: "24001", name: "ASLAM NAVAS", cls: "THAMHEEDIYYA ULA" },
  { cic: "24003", name: "MUHAMMED SINAN P", cls: "THAMHEEDIYYA ULA" },
  { cic: "24005", name: "SAYYID MIHAL PP", cls: "THAMHEEDIYYA ULA" },
  { cic: "24007", name: "MOHAMMAD KENZ P", cls: "THAMHEEDIYYA ULA" },
  { cic: "24008", name: "MUHAMMED SWALIH", cls: "THAMHEEDIYYA ULA" },
  { cic: "24009", name: "NUBHAN AHMAD", cls: "THAMHEEDIYYA ULA" },
  { cic: "22828", name: "MUHAMMED RAZAN", cls: "THAMHEEDIYYA ULA" },
  { cic: "", name: "SHAFIN NASEEM C", cls: "THAMHEEDIYYA ULA" },
  { cic: "24875", name: "HADI BIN NOOR K", cls: "THAMHEEDIYYA ULA" }
];

let nextUniqueCic = 90001;
const unassigned = [];
const reconciled = [];

for (const student of rawStudents) {
  let cic = student.cic;
  if (!cic) {
    cic = String(nextUniqueCic);
    nextUniqueCic++;
  }

  let matchedTeam = "";
  const clsData = teamRoster[student.cls];
  if (clsData) {
    for (const [teamName, members] of Object.entries(clsData)) {
      if (members.includes(student.name)) {
        matchedTeam = teamName;
        break;
      }
    }
  }

  if (!matchedTeam) {
    unassigned.push(student);
    matchedTeam = "";
  }

  reconciled.push({
    name: student.name,
    cic: cic,
    team: matchedTeam,
    cls: student.cls
  });
}

console.log("=== UNASSIGNED STUDENTS ===");
unassigned.forEach(s => {
  console.log(`- ${s.name} (${s.cls})`);
});

// Write to CSV
const csvLines = ["name,cicnumber,team,class"];
reconciled.forEach(r => {
  csvLines.push(`${r.name},${r.cic},${r.team},${r.cls}`);
});
fs.writeFileSync('public/students_import.csv', csvLines.join('\n'));
console.log("Successfully wrote reconciled database to public/students_import.csv");
