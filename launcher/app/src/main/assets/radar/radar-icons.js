/*
 * The plane radar's aircraft: nose-up silhouettes, one per class, and which ICAO type is which class.
 *
 * The silhouettes and the type lists come from God's Eye View (MIT, (c) 2026 Bilawal Sidhu,
 * https://github.com/bilawalsidhu/gods-eye-view: src/data/aircraftIcons.js, src/data/aircraftClass.js), whose
 * silhouette language follows skylight (MIT, https://github.com/cpaczek/skylight). 96x96 box, centre 0,0, nose
 * towards -Y, drawn white: the radar recolours them (@S and @B are the outline, set when a sprite is made).
 * ES5. MIT.
 */
(function (root) {
  "use strict";
  var BODIES = {
    airliner: '<path d="M0,-42 C 3.8,-40 4.6,-34 4.6,-26 L 4.6,-14 L 32,4 L 34,6 L 34,10 L 31.4,9.2 L 4.6,2.4 L 4.2,20 L 14,28 L 14,32 L 0,28.6 L -14,32 L -14,28 L -4.2,20 L -4.6,2.4 L -31.4,9.2 L -34,10 L -34,6 L -32,4 L -4.6,-14 L -4.6,-26 C -4.6,-34 -3.8,-40 0,-42 Z" fill="white" @S/><path d="M-15.5,-1.5 l3,7.6 4,-1.4 -1.5,-8.4 Z" fill="white"/><path d="M15.5,-1.5 l-3,7.6 -4,-1.4 1.5,-8.4 Z" fill="white"/><path d="M-1.6,33.5 L 1.6,33.5 L 1.6,40 L -1.6,40 Z" fill="white"/>',
    widebody: '<path d="M0,-45 C 5.6,-43 6.8,-36 6.8,-27 L 6.8,-12 L 38,9 L 41.5,12.4 L 41.5,16.6 L 37.6,15 L 6.8,6 L 6.3,21 L 17,30 L 17,34.6 L 0,30.4 L -17,34.6 L -17,30 L -6.3,21 L -6.8,6 L -37.6,15 L -41.5,16.6 L -41.5,12.4 L -38,9 L -6.8,-12 L -6.8,-27 C -6.8,-36 -5.6,-43 0,-45 Z" fill="white" @S/><path d="M-19,2 l3.6,9 4.8,-1.7 -1.8,-10 Z" fill="white"/><path d="M19,2 l-3.6,9 -4.8,-1.7 1.8,-10 Z" fill="white"/><path d="M-2,35.5 L 2,35.5 L 2,42.5 L -2,42.5 Z" fill="white"/>',
    quadjet: '<path d="M0,-45 C 7,-42 9,-34 9,-25 L 9,-11 L 46,12 L 46,21 L 9,11.5 L 8.4,21 L 20,31 L 20,37.5 L 0,32 L -20,37.5 L -20,31 L -8.4,21 L -9,11.5 L -46,21 L -46,12 L -9,-11 L -9,-25 C -9,-34 -7,-42 0,-45 Z" fill="white" @B/><rect x="-31" y="9" width="7" height="12" rx="2" fill="white"/><rect x="-17" y="4.5" width="7" height="12" rx="2" fill="white"/><rect x="10" y="4.5" width="7" height="12" rx="2" fill="white"/><rect x="24" y="9" width="7" height="12" rx="2" fill="white"/>',
    turboprop: '<path d="M0,-40 C 3.4,-38.5 4.2,-33 4.2,-26 L 4.2,-18 L 36,-15.5 L 36,-7.5 L 4.2,-8 L 3.8,22 L 13,27.5 L 13,31.5 L 0,28.6 L -13,31.5 L -13,27.5 L -3.8,22 L -4.2,-8 L -36,-7.5 L -36,-15.5 L -4.2,-18 L -4.2,-26 C -4.2,-33 -3.4,-38.5 0,-40 Z" fill="white" @S/><circle cx="-17.5" cy="-16.5" r="7.5" fill="white" fill-opacity="0.5"/><circle cx="17.5" cy="-16.5" r="7.5" fill="white" fill-opacity="0.5"/><path d="M-19.5,-19 h4 v5 h-4 Z" fill="white"/><path d="M15.5,-19 h4 v5 h-4 Z" fill="white"/><path d="M-1.7,31.5 L 1.7,31.5 L 1.7,38.5 L -1.7,38.5 Z" fill="white"/>',
    light: '<path d="M0,-27 C 4,-25 5.2,-20 5.2,-13 L 5.2,-9 L 27,-9 L 27,6 L 5.2,6 L 5.2,16 L 11.5,23 L 11.5,27 L 0,23.5 L -11.5,27 L -11.5,23 L -5.2,16 L -5.2,6 L -27,6 L -27,-9 L -5.2,-9 L -5.2,-13 C -5.2,-20 -4,-25 0,-27 Z" fill="white" @S/><ellipse cx="0" cy="-29" rx="12" ry="3.8" fill="white" fill-opacity="0.5"/>',
    glider: '<path d="M0,-35 C 2.4,-33 3,-29 3,-25 L 3,-14 L 45,-10.5 L 45,-3.5 L 2.9,-6 L 2.2,32 L -2.2,32 L -2.9,-6 L -45,-3.5 L -45,-10.5 L -3,-14 L -3,-25 C -3,-29 -2.4,-33 0,-35 Z" fill="white" @B/><rect x="-10.5" y="32.5" width="21" height="5" rx="1.5" fill="white" @B/>',
    helicopter: '<circle cx="0" cy="-6" r="31" fill="white" fill-opacity="0.22"/><g transform="rotate(45 0 -6)"><rect x="-30.5" y="-8.2" width="61" height="4.4" rx="2.2" fill="white" fill-opacity="0.9"/><rect x="-30.5" y="-8.2" width="61" height="4.4" rx="2.2" fill="white" fill-opacity="0.9" transform="rotate(90 0 -6)"/></g><path d="M0,-22 C 8,-20 10.5,-13 10.5,-6 C 10.5,2 7.5,7 0,8.5 C -7.5,7 -10.5,2 -10.5,-6 C -10.5,-13 -8,-20 0,-22 Z" fill="white" @S/><path d="M-2.6,8 L 2.6,8 L 1.8,32 L -1.8,32 Z" fill="white" @S/><path d="M-8,27 L 8,27 L 8,30.6 L -8,30.6 Z" fill="white"/><circle cx="5.6" cy="35" r="6" fill="white" fill-opacity="0.6"/><circle cx="5.6" cy="35" r="2.1" fill="white"/>',
    fastjet: '<path d="M0,-43 L 3.5,-30 C 4,-24 4.6,-16 5,-8 L 27,20 L 27,26 L 6,16 L 8,30 L 8,34 L 3,31 L 3,38 L 6.5,42 L 6.5,44 L 0,41.5 L -6.5,44 L -6.5,42 L -3,38 L -3,31 L -8,34 L -8,30 L -6,16 L -27,26 L -27,20 L -5,-8 C -4.6,-16 -4,-24 -3.5,-30 Z" fill="white" @S/>',
    bizjet: '<path d="M0,-42 L 2.6,-36 L 3.4,-26 L 3.4,-8 L 27,8 L 27,13 L 3.6,6 L 3.6,16 L 8,18 L 8,26 L 3.8,25 L 3.2,30 L 15,34 L 15,38 L 2.4,36 L 0,40 L -2.4,36 L -15,38 L -15,34 L -3.2,30 L -3.8,25 L -8,26 L -8,18 L -3.6,16 L -3.6,6 L -27,13 L -27,8 L -3.4,-8 L -3.4,-26 L -2.6,-36 Z" fill="white" @S/>',
    uav: '<path d="M0,-40 C 3.6,-40 4.6,-35 4.4,-30 L 2.4,-12 L 43,-7 L 43,-2.5 L 2.3,0 L 2.1,24 L 13,32 L 13,36 L 1.6,30 L 0,38 L -1.6,30 L -13,36 L -13,32 L -2.1,24 L -2.3,0 L -43,-2.5 L -43,-7 L -2.4,-12 L -4.4,-30 C -4.6,-35 -3.6,-40 0,-40 Z" fill="white" @S/>'
  };
  var TYPES = {
    fastjet: "F16 F15 F18 FA18 F14 F22 F35 F4 F5 A10 AV8B TYPH EUFI RFAL RAFL GRIP JAS39 TOR MIR2 M2000 SU27 SU30 SU33 SU34 SU35 SU57 MG29 MIG29 MG31 J20 T38 HAWK L39 M346 T7A",
    uav: "Q1 Q4 Q9 MQ1 MQ4 MQ9 RQ4 TB2 SHDW HERN",
    helicopter: "EC20 EC25 EC30 EC35 EC45 EC55 AS50 AS55 AS65 AS32 A109 A119 A139 A169 A189 B06 B06T B407 B412 B427 B429 B430 B505 S76 S92 S61 S64 H60 H500 MD52 MD60 R22 R44 R66 EXEC EXPL GAZL LYNX NH90 PUMA SCAV UH1 B105 B212 B214 B222 AC H47 H64",
    quadjet: "B741 B742 B743 B744 B748 B74S B74R B74D A388 A342 A343 A345 A346 A124 C5M A225 IL96 B52 A140",
    widebody: "A306 A30B A310 A332 A333 A338 A339 A359 A35K B762 B763 B764 B772 B77L B773 B77W B778 B779 B788 B789 B78X MD11 IL86 DC10 L101 A337 B767 B777 B787 C17 K35R",
    turboprop: "DH8A DH8B DH8C DH8D AT43 AT44 AT45 AT46 AT72 AT73 AT75 AT76 SF34 SB20 SW3 SW4 E110 E120 C208 C212 C408 PC12 B190 BE20 B350 B300 JS31 JS32 JS41 D228 D328 F50 F27 ATP TBM7 TBM8 TBM9 TBM0 PC6 C441 C425 DHC6 DHC7 C130 AN12 AN26 AN32 SH36 CVLT SAAB A400",
    glider: "DISC DUOD VENT NIMB NIM3 NIM4 JANS ARCE DG40 DG80 DG1T DG30 DG50 LS3 LS4 LS6 LS7 LS8 STD3 G103 G102 G104 PW5 PW6 L13 L23 L33 PIK PEGA KEST TWIN AS33 ASW ASG ASK VENS GLID MOSQ DIMO",
    bizjet: "C500 C501 C510 C525 C25A C25B C25C C25M C550 C551 C560 C56X C650 C680 C68A C700 C750 CL30 CL35 CL60 GLF2 GLF3 GLF4 GLF5 GLF6 GA5C GA6C G150 G280 GL5T GL7T GLEX LJ23 LJ24 LJ25 LJ31 LJ35 LJ40 LJ45 LJ55 LJ60 LJ70 LJ75 FA10 FA20 FA50 FA7X FA8X F900 F2TH H25A H25B H25C HDJT E50P E55P E545 E550 PC24 PRM1 BE40 ASTR WW24 SF50",
    light: "C150 C152 C162 C172 C72R C175 C177 C180 C182 C185 C188 C206 C207 C210 C310 C337 SR20 SR22 S22T PA18 PA24 PA28 P28A P28B P28R PA32 P32R PA34 PA38 PA44 PA46 DA20 DA40 DA42 DA62 BE33 BE35 BE36 BE58 BE76 BE19 BE23 BE24 M20P M20T AA1 AA5 GLAS COL4 RV4 RV6 RV7 RV8 RV9 RV10 RV14 GA8 G115 BL8 CH7"
  };
  // how big each class is drawn against an airliner
  var SCALE = { light: 0.62, glider: 0.58, turboprop: 0.86, airliner: 1.0, widebody: 1.3, quadjet: 1.45, helicopter: 0.82, fastjet: 0.8, bizjet: 0.72, uav: 0.75 };
  root.RadarIcons = { BODIES: BODIES, TYPES: TYPES, SCALE: SCALE };
  if (typeof module !== "undefined" && module.exports) module.exports = root.RadarIcons;
})(typeof window !== "undefined" ? window : this);
