// Erzeugt von tools/build-fx.mjs aus public/js/fx-data.js der Web-App – nicht von Hand ändern (dort ändern, dann neu bauen).
export const FX: any[] = [
 {
  "id": "golddust",
  "name": "Goldstaub",
  "blend": "screen",
  "amb": {
   "side": "bottom",
   "rgb": "255,186,70",
   "a": 0.22,
   "size": 0.5
  },
  "layers": [
   {
    "s": [
     "bokeh"
    ],
    "n": 6,
    "m": "rise",
    "size": [
     18,
     40
    ],
    "dur": [
     12,
     18
    ],
    "sway": [
     8,
     20
    ],
    "swayDur": [
     3,
     4.6
    ],
    "op": [
     0.1,
     0.22
    ],
    "tint": [
     "#ffd35a",
     "#ffb84a",
     "#ffe9a0"
    ],
    "blur": 1.2,
    "fade": "ends"
   },
   {
    "s": [
     "glow"
    ],
    "n": 30,
    "m": "rise",
    "size": [
     3,
     6.5
    ],
    "dur": [
     8,
     15
    ],
    "sway": [
     5,
     14
    ],
    "swayDur": [
     2.2,
     3.8
    ],
    "op": [
     0.55,
     1
    ],
    "tint": [
     "#fff3c2",
     "#ffd35a",
     "#ffe9a0"
    ],
    "fade": "ends"
   },
   {
    "s": [
     "flare"
    ],
    "n": 5,
    "m": "twinkle",
    "size": [
     16,
     30
    ],
    "dur": [
     2.6,
     4.6
    ],
    "spin": [
     20,
     60
    ],
    "op": [
     0.75,
     1
    ],
    "tint": [
     "#fff6d6",
     "#ffe9a0"
    ],
    "y": [
     0.1,
     0.9
    ]
   }
  ]
 },
 {
  "id": "bokeh",
  "name": "Lichter",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "bokeh"
    ],
    "n": 8,
    "m": "float",
    "size": [
     44,
     92
    ],
    "dur": [
     9,
     15
    ],
    "sway": [
     12,
     28
    ],
    "op": [
     0.13,
     0.28
    ],
    "tint": [
     "#b8a6ff",
     "#ff9ed0",
     "#8fd8ff",
     "#ffd9a0"
    ],
    "blur": 2.2,
    "lo": 0.35
   },
   {
    "s": [
     "bokeh"
    ],
    "n": 10,
    "m": "float",
    "size": [
     14,
     30
    ],
    "dur": [
     6,
     10
    ],
    "sway": [
     8,
     20
    ],
    "op": [
     0.22,
     0.46
    ],
    "tint": [
     "#c9b8ff",
     "#ffb3d9",
     "#a8e0ff",
     "#ffe6b8"
    ],
    "blur": 0.5,
    "lo": 0.3
   },
   {
    "s": [
     "glow"
    ],
    "n": 9,
    "m": "twinkle",
    "size": [
     3,
     6
    ],
    "dur": [
     2.2,
     4.2
    ],
    "op": [
     0.7,
     1
    ],
    "lo": 0.1
   }
  ]
 },
 {
  "id": "sparks",
  "name": "Funkeln",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "flare"
    ],
    "n": 9,
    "m": "twinkle",
    "size": [
     30,
     60
    ],
    "dur": [
     2.4,
     4.2
    ],
    "spin": [
     30,
     90
    ],
    "op": [
     0.9,
     1
    ],
    "tint": [
     "#ffffff",
     "#fff3c2",
     "#dfe8ff"
    ],
    "lo": 0.1
   },
   {
    "s": [
     "star"
    ],
    "n": 18,
    "m": "twinkle",
    "size": [
     9,
     18
    ],
    "dur": [
     1.8,
     3.6
    ],
    "op": [
     0.85,
     1
    ],
    "tint": [
     "#ffffff",
     "#fff3c2"
    ],
    "lo": 0.1
   },
   {
    "s": [
     "glow"
    ],
    "n": 10,
    "m": "float",
    "size": [
     2.5,
     4.5
    ],
    "dur": [
     6,
     10
    ],
    "sway": [
     6,
     16
    ],
    "op": [
     0.4,
     0.8
    ],
    "lo": 0.2
   }
  ]
 },
 {
  "id": "stars",
  "name": "Sternenhimmel",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "glow"
    ],
    "n": 4,
    "m": "float",
    "size": [
     170,
     280
    ],
    "dur": [
     14,
     20
    ],
    "sway": [
     10,
     24
    ],
    "op": [
     0.08,
     0.15
    ],
    "tint": [
     "#6a5cff",
     "#3d8bff",
     "#b260ff"
    ],
    "lo": 0.6
   },
   {
    "s": [
     "glow"
    ],
    "n": 46,
    "m": "twinkle",
    "size": [
     2.4,
     4.8
    ],
    "dur": [
     2.4,
     5.2
    ],
    "op": [
     0.8,
     1
    ],
    "lo": 0.45
   },
   {
    "s": [
     "star"
    ],
    "n": 14,
    "m": "twinkle",
    "size": [
     11,
     24
    ],
    "dur": [
     3,
     5.6
    ],
    "op": [
     0.9,
     1
    ],
    "tint": [
     "#ffffff",
     "#ffe9b0",
     "#cfe0ff"
    ],
    "lo": 0.3
   }
  ]
 },
 {
  "id": "meteors",
  "name": "Sternschnuppen",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "glow"
    ],
    "n": 28,
    "m": "twinkle",
    "size": [
     2,
     3.6
    ],
    "dur": [
     2.6,
     5
    ],
    "op": [
     0.6,
     1
    ],
    "lo": 0.3
   },
   {
    "s": [
     "star"
    ],
    "n": 4,
    "m": "twinkle",
    "size": [
     9,
     15
    ],
    "dur": [
     3.4,
     5.6
    ],
    "op": [
     0.8,
     1
    ],
    "lo": 0.2
   },
   {
    "s": [
     "meteor"
    ],
    "n": 5,
    "m": "streak",
    "size": [
     120,
     200
    ],
    "dur": [
     5,
     9
    ],
    "op": [
     0.9,
     1
    ],
    "angle": 148
   }
  ]
 },
 {
  "id": "aurora",
  "name": "Polarlicht",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "aurora"
    ],
    "n": 1,
    "m": "scroll",
    "dur": [
     34,
     34
    ],
    "op": [
     0.8,
     0.8
    ],
    "top": -0.06,
    "h": 0.6
   },
   {
    "s": [
     "aurora"
    ],
    "n": 1,
    "m": "scroll",
    "dur": [
     52,
     52
    ],
    "op": [
     0.42,
     0.42
    ],
    "top": 0.02,
    "h": 0.74,
    "dir": -1
   },
   {
    "s": [
     "glow"
    ],
    "n": 16,
    "m": "twinkle",
    "size": [
     2,
     3.4
    ],
    "dur": [
     2.6,
     5
    ],
    "op": [
     0.6,
     1
    ],
    "lo": 0.3,
    "y": [
     0,
     0.55
    ]
   }
  ]
 },
 {
  "id": "mist",
  "name": "Nebel",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "fog"
    ],
    "n": 1,
    "m": "scroll",
    "dur": [
     58,
     58
    ],
    "op": [
     0.2,
     0.2
    ],
    "top": 0.24,
    "h": 0.7,
    "tint": [
     "#c9d4ff"
    ]
   },
   {
    "s": [
     "fog"
    ],
    "n": 1,
    "m": "scroll",
    "dur": [
     36,
     36
    ],
    "op": [
     0.28,
     0.28
    ],
    "top": 0.46,
    "h": 0.66,
    "dir": -1,
    "tint": [
     "#e6ecff"
    ],
    "blur": 1
   }
  ]
 },
 {
  "id": "petals",
  "name": "Kirschblüten",
  "layers": [
   {
    "s": [
     "petal1",
     "petal2",
     "petal3"
    ],
    "n": 8,
    "m": "fall",
    "size": [
     10,
     15
    ],
    "dur": [
     10,
     14
    ],
    "sway": [
     12,
     24
    ],
    "swayDur": [
     2.8,
     4
    ],
    "drift": [
     -30,
     30
    ],
    "spin": [
     -120,
     160
    ],
    "rock": [
     30,
     55
    ],
    "op": [
     0.55,
     0.75
    ],
    "blur": 0.6
   },
   {
    "s": [
     "petal1",
     "petal2",
     "petal3"
    ],
    "n": 10,
    "m": "fall",
    "size": [
     18,
     28
    ],
    "dur": [
     7,
     10
    ],
    "sway": [
     18,
     34
    ],
    "swayDur": [
     2.4,
     3.6
    ],
    "drift": [
     -40,
     40
    ],
    "spin": [
     -140,
     180
    ],
    "rock": [
     35,
     60
    ],
    "op": [
     0.9,
     1
    ]
   },
   {
    "s": [
     "petal1",
     "petal2",
     "petal3"
    ],
    "n": 3,
    "m": "fall",
    "size": [
     40,
     56
    ],
    "dur": [
     5.2,
     6.8
    ],
    "sway": [
     26,
     44
    ],
    "swayDur": [
     2.2,
     3
    ],
    "drift": [
     -50,
     50
    ],
    "spin": [
     -100,
     140
    ],
    "rock": [
     30,
     50
    ],
    "op": [
     0.5,
     0.68
    ],
    "blur": 3
   }
  ]
 },
 {
  "id": "snow",
  "name": "Schnee",
  "layers": [
   {
    "s": [
     "glow"
    ],
    "n": 30,
    "m": "fall",
    "size": [
     3,
     5.5
    ],
    "dur": [
     10,
     15
    ],
    "sway": [
     5,
     13
    ],
    "swayDur": [
     2.6,
     4.2
    ],
    "drift": [
     -14,
     14
    ],
    "op": [
     0.5,
     0.85
    ]
   },
   {
    "s": [
     "snow1",
     "snow2"
    ],
    "n": 10,
    "m": "fall",
    "size": [
     11,
     19
    ],
    "dur": [
     7.5,
     11
    ],
    "sway": [
     10,
     22
    ],
    "swayDur": [
     2.6,
     3.8
    ],
    "drift": [
     -20,
     20
    ],
    "spin": [
     -90,
     160
    ],
    "op": [
     0.75,
     1
    ]
   },
   {
    "s": [
     "glow"
    ],
    "n": 5,
    "m": "fall",
    "size": [
     18,
     32
    ],
    "dur": [
     5.5,
     7.5
    ],
    "sway": [
     14,
     28
    ],
    "swayDur": [
     2.4,
     3.2
    ],
    "drift": [
     -24,
     24
    ],
    "op": [
     0.22,
     0.38
    ]
   }
  ]
 },
 {
  "id": "rain",
  "name": "Regen",
  "amb": {
   "side": "bottom",
   "rgb": "170,205,255",
   "a": 0.1,
   "size": 0.3
  },
  "layers": [
   {
    "s": [
     "drop"
    ],
    "n": 34,
    "m": "fall",
    "size": [
     16,
     24
    ],
    "dur": [
     0.8,
     1.15
    ],
    "drift": [
     -22,
     -22
    ],
    "angle": 10,
    "op": [
     0.22,
     0.42
    ],
    "tint": [
     "#cfe2ff"
    ]
   },
   {
    "s": [
     "drop"
    ],
    "n": 14,
    "m": "fall",
    "size": [
     28,
     44
    ],
    "dur": [
     0.52,
     0.72
    ],
    "drift": [
     -34,
     -34
    ],
    "angle": 10,
    "op": [
     0.45,
     0.75
    ],
    "tint": [
     "#e6f0ff"
    ]
   }
  ]
 },
 {
  "id": "leaves",
  "name": "Herbstlaub",
  "layers": [
   {
    "s": [
     "leaf1",
     "leaf2",
     "leaf3"
    ],
    "n": 6,
    "m": "fall",
    "size": [
     12,
     17
    ],
    "dur": [
     10,
     14
    ],
    "sway": [
     14,
     28
    ],
    "swayDur": [
     2.8,
     4
    ],
    "drift": [
     -30,
     30
    ],
    "spin": [
     -160,
     200
    ],
    "rock": [
     30,
     50
    ],
    "op": [
     0.6,
     0.8
    ],
    "blur": 0.6
   },
   {
    "s": [
     "leaf1",
     "leaf2",
     "leaf3"
    ],
    "n": 9,
    "m": "fall",
    "size": [
     22,
     34
    ],
    "dur": [
     7,
     10.5
    ],
    "sway": [
     22,
     42
    ],
    "swayDur": [
     2.4,
     3.6
    ],
    "drift": [
     -44,
     44
    ],
    "spin": [
     -200,
     240
    ],
    "rock": [
     30,
     55
    ],
    "op": [
     0.92,
     1
    ]
   },
   {
    "s": [
     "leaf1",
     "leaf2",
     "leaf3"
    ],
    "n": 2,
    "m": "fall",
    "size": [
     46,
     60
    ],
    "dur": [
     5.2,
     6.6
    ],
    "sway": [
     30,
     48
    ],
    "swayDur": [
     2.2,
     3
    ],
    "drift": [
     -50,
     50
    ],
    "spin": [
     -120,
     160
    ],
    "rock": [
     25,
     45
    ],
    "op": [
     0.55,
     0.7
    ],
    "blur": 3
   }
  ]
 },
 {
  "id": "bubbles",
  "name": "Seifenblasen",
  "layers": [
   {
    "s": [
     "bubble"
    ],
    "n": 11,
    "m": "rise",
    "size": [
     14,
     40
    ],
    "dur": [
     8,
     13
    ],
    "sway": [
     8,
     24
    ],
    "swayDur": [
     2.4,
     3.8
    ],
    "drift": [
     -20,
     20
    ],
    "tilt": 10,
    "op": [
     0.75,
     1
    ],
    "fade": "ends"
   },
   {
    "s": [
     "bubble"
    ],
    "n": 2,
    "m": "rise",
    "size": [
     58,
     80
    ],
    "dur": [
     10,
     13
    ],
    "sway": [
     14,
     26
    ],
    "swayDur": [
     3,
     4
    ],
    "drift": [
     -16,
     16
    ],
    "tilt": 8,
    "op": [
     0.4,
     0.55
    ],
    "blur": 1.6,
    "fade": "ends"
   }
  ]
 },
 {
  "id": "fireflies",
  "name": "Glühwürmchen",
  "blend": "screen",
  "layers": [
   {
    "s": [
     "glow"
    ],
    "n": 10,
    "m": "float",
    "size": [
     5,
     9
    ],
    "dur": [
     8,
     13
    ],
    "sway": [
     16,
     36
    ],
    "op": [
     0.35,
     0.65
    ],
    "tint": [
     "#e9ff8a",
     "#fff2a0"
    ],
    "lo": 0
   },
   {
    "s": [
     "glow"
    ],
    "n": 13,
    "m": "float",
    "size": [
     13,
     24
    ],
    "dur": [
     6,
     11
    ],
    "sway": [
     26,
     58
    ],
    "op": [
     0.85,
     1
    ],
    "tint": [
     "#e9ff8a",
     "#c8ff6a",
     "#fff2a0"
    ],
    "lo": 0,
    "pulse": 3
   }
  ]
 },
 {
  "id": "hearts",
  "name": "Herzen",
  "layers": [
   {
    "s": [
     "heart1",
     "heart2"
    ],
    "n": 7,
    "m": "rise",
    "size": [
     9,
     14
    ],
    "dur": [
     10,
     14
    ],
    "sway": [
     10,
     22
    ],
    "swayDur": [
     2.8,
     4
    ],
    "drift": [
     -20,
     20
    ],
    "tilt": 14,
    "op": [
     0.5,
     0.72
    ],
    "blur": 0.5,
    "fade": "ends"
   },
   {
    "s": [
     "heart1",
     "heart2"
    ],
    "n": 8,
    "m": "rise",
    "size": [
     18,
     30
    ],
    "dur": [
     7,
     10.5
    ],
    "sway": [
     14,
     30
    ],
    "swayDur": [
     2.4,
     3.6
    ],
    "drift": [
     -26,
     26
    ],
    "tilt": 16,
    "op": [
     0.9,
     1
    ],
    "fade": "ends"
   },
   {
    "s": [
     "heart1",
     "heart2"
    ],
    "n": 2,
    "m": "rise",
    "size": [
     44,
     58
    ],
    "dur": [
     5.6,
     7
    ],
    "sway": [
     22,
     38
    ],
    "swayDur": [
     2.4,
     3.2
    ],
    "drift": [
     -30,
     30
    ],
    "tilt": 12,
    "op": [
     0.5,
     0.65
    ],
    "blur": 3,
    "fade": "ends"
   }
  ]
 },
 {
  "id": "embers",
  "name": "Glut",
  "blend": "screen",
  "amb": {
   "side": "bottom",
   "rgb": "255,96,24",
   "a": 0.3,
   "size": 0.45
  },
  "layers": [
   {
    "s": [
     "glow"
    ],
    "n": 7,
    "m": "rise",
    "size": [
     16,
     30
    ],
    "dur": [
     5,
     8
    ],
    "sway": [
     8,
     18
    ],
    "swayDur": [
     1.6,
     2.6
    ],
    "op": [
     0.14,
     0.26
    ],
    "tint": [
     "#ff8a2e",
     "#ffb35e"
    ],
    "fade": "out"
   },
   {
    "s": [
     "ember"
    ],
    "n": 22,
    "m": "rise",
    "size": [
     12,
     22
    ],
    "dur": [
     3.6,
     6.8
    ],
    "sway": [
     6,
     20
    ],
    "swayDur": [
     0.9,
     1.8
    ],
    "drift": [
     -24,
     24
    ],
    "op": [
     0.75,
     1
    ],
    "fade": "out"
   }
  ]
 },
 {
  "id": "confetti",
  "name": "Konfetti",
  "layers": [
   {
    "s": [
     "foil1",
     "foil2",
     "foil3",
     "foil4",
     "foil5"
    ],
    "n": 14,
    "m": "fall",
    "size": [
     9,
     13
    ],
    "dur": [
     6.5,
     9.5
    ],
    "sway": [
     10,
     22
    ],
    "swayDur": [
     1.4,
     2.2
    ],
    "drift": [
     -24,
     24
    ],
    "spin": [
     -240,
     300
    ],
    "rock": [
     55,
     78
    ],
    "op": [
     0.6,
     0.8
    ]
   },
   {
    "s": [
     "foil1",
     "foil2",
     "foil3",
     "foil4",
     "foil5"
    ],
    "n": 22,
    "m": "fall",
    "size": [
     16,
     25
    ],
    "dur": [
     4.6,
     7.4
    ],
    "sway": [
     14,
     32
    ],
    "swayDur": [
     1.2,
     2
    ],
    "drift": [
     -36,
     36
    ],
    "spin": [
     -260,
     320
    ],
    "rock": [
     58,
     80
    ],
    "op": [
     1,
     1
    ]
   },
   {
    "s": [
     "foil1",
     "foil2",
     "foil3",
     "foil4",
     "foil5"
    ],
    "n": 4,
    "m": "fall",
    "size": [
     32,
     44
    ],
    "dur": [
     3.6,
     4.8
    ],
    "sway": [
     20,
     36
    ],
    "swayDur": [
     1.2,
     1.8
    ],
    "drift": [
     -40,
     40
    ],
    "spin": [
     -200,
     260
    ],
    "rock": [
     50,
     72
    ],
    "op": [
     0.6,
     0.78
    ],
    "blur": 2.6
   }
  ]
 }
];
