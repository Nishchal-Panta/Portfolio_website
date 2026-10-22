/**
 * Real constellation figures for the light theme.
 *
 * Nothing in this file is drawn by hand or from memory. The stick figures are
 * the IAU's own published figure set; the star positions come out of the
 * Hipparcos catalogue; the shapes below are those two sources projected, not
 * approximated.
 *
 * LICENCE OF THIS FILE
 *
 *   This file is an ADAPTATION of the constellation stick figures distributed
 *   with Stellarium as the sky culture "modern_iau", which are themselves the
 *   International Astronomical Union's official constellation figures,
 *   produced in collaboration with Sky & Telescope magazine (Roger Sinnott and
 *   Rick Fienberg).
 *
 *   The stick figures are licensed CC BY-SA 4.0:
 *     https://creativecommons.org/licenses/by-sa/4.0/
 *
 *   Because this file adapts them, it is offered under the same licence,
 *   CC BY-SA 4.0, and carries the attribution above. That obligation applies to
 *   THIS DATA FILE and to anything derived from it. It does not apply to the
 *   rest of the site's code, which is not a derivative of the figures - the
 *   figures are data consumed by an unrelated renderer. The site carries a
 *   visible credit line in the footer because that is what the licence asks
 *   for, not because the codebase is covered by it.
 *
 *   Nothing here is fetched at runtime. The figures, the coordinates and the
 *   magnitudes are all compiled into this file, so the page makes no request
 *   to Stellarium, the IAU, CDS or anyone else.
 *
 * SOURCES
 *
 *   Stick figures
 *     Stellarium sky culture "modern_iau", index.json from Stellarium master,
 *     fetched 2026-10-20.
 *     https://github.com/Stellarium/stellarium/tree/master/skycultures/modern_iau
 *     Licence: CC BY-SA 4.0.
 *
 *   Star positions and magnitudes
 *     Hipparcos Main Catalogue, ESA 1997, catalogue I/239, retrieved from
 *     CDS/VizieR (https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239).
 *     Columns RAICRS / DEICRS: degrees, ICRS, epoch J1991.25. Vmag: Johnson V.
 *     Hipparcos data is free to use with acknowledgement of ESA, which is given
 *     here and in the site footer.
 *
 * ORION
 *   Orion is drawn as its 9-star core. The published figure's shield (8 stars west of Rigel) and club (5 stars above Betelgeuse) are omitted, so the recognisable body keeps its size at 140-320 px. Every star drawn is still at its catalogue position and every edge is a published one; the 13 omitted stars are listed by HIP number in tools/build-constellations.mjs.
 *
 * PROJECTION
 *   Azimuthal equidistant, about each figure's own centroid, on a plane whose
 *   axes are celestial North and East, then flipped to chart orientation: North
 *   up, East to the left - the way these figures are printed - so no figure is
 *   mirrored. Each shape is centred on its bounding box and scaled so its
 *   longer side is exactly 1; the runtime picks the pixel size, so the unit box
 *   is the only scaling this file encodes. Equidistant was picked by measuring
 *   against the sphere, not by habit: tools/proj-diag.mjs puts it at 2.06% worst
 *   pairwise distance error, against 4.53% for stereographic and 15.66% for
 *   gnomonic, the last driven by Ursa Major spanning ~50 deg of sky.
 *
 * UNSIZED STARS
 *   0 of the 170 stars drawn here carry no Johnson V
 *   magnitude in Hipparcos. They are given the median magnitude - a neutral
 *   middle size - rather than being guessed a brightness.
 *
 * FIDELITY
 *   `fidelity` is the worst relative difference, over every pair of stars in
 *   the figure, between its separation in the projection and its true
 *   angular separation on the sphere. It is the distortion the projection
 *   introduces on its own. Largest across all figures: 0.0206 (2.060%).
 *
 * Built by tools/build-constellations.mjs from tools/fetch-constellations.mjs.
 * Do not edit the numbers by hand; re-run the build instead.
 */

export interface Figure {
  /** IAU three-letter abbreviation. */
  abbr: string;
  name: string;
  /** Hipparcos numbers of the drawn stars, same order as x / y / mag. */
  hips: number[];
  /** Unit-box coordinates, x right and y down the screen, longer side = 1. */
  x: number[];
  y: number[];
  /** Johnson V magnitude, kept so size tiers and the data test stay checkable. */
  mag: number[];
  /** Pairs of star indices to join, from the published figure. */
  edges: [number, number][];
}

export const FIGURES: Figure[] = [
  {
    abbr: 'Ori',
    name: 'Orion',
    hips: [27989, 26727, 27366, 26311, 25930, 25336, 25281, 24436, 26207],
    x: [-0.257416, -0.075101, -0.162745, -0.01718, 0.036451, 0.123616, 0.132374, 0.257416, -0.003397],
    y: [-0.371631, 0.105688, 0.5, 0.067905, 0.021864, -0.317296, 0.128897, 0.425398, -0.5],
    mag: [0.45, 1.74, 2.07, 1.69, 2.25, 1.64, 3.35, 0.18, 3.39],
    edges: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [4, 6], [6, 7], [0, 5], [5, 8], [8, 0]],
  },
  {
    abbr: 'UMa',
    name: 'Ursa Major',
    hips: [58001, 57399, 54539, 50801, 50372, 55219, 55203, 59774, 54061, 53910, 62956, 65378, 67301, 46733, 48319, 41704, 46853, 44471, 44127],
    x: [-0.106353, -0.102847, 0.028245, 0.221671, 0.239227, -0.022227, -0.022851, -0.154618, 0.059556, 0.062711, -0.272956, -0.366546, -0.5, 0.28765, 0.262705, 0.454099, 0.360603, 0.492314, 0.5],
    y: [-0.130927, 0.002436, 0.088346, 0.146748, 0.113088, 0.337057, 0.371514, -0.218416, -0.290564, -0.172334, -0.235721, -0.257226, -0.191454, -0.35281, -0.253142, -0.371514, -0.110953, -0.051292, -0.076029],
    mag: [2.41, 3.69, 3.00, 3.06, 3.45, 3.49, 3.79, 3.32, 1.81, 2.34, 1.76, 2.23, 1.85, 3.65, 3.78, 3.35, 3.17, 3.57, 3.12],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [7, 8], [8, 9], [9, 0], [0, 7], [7, 10], [10, 11], [11, 12], [8, 13], [13, 14], [13, 15], [15, 14], [14, 9], [14, 16], [16, 17], [17, 18]],
  },
  {
    abbr: 'UMi',
    name: 'Ursa Minor',
    hips: [11767, 85822, 82080, 77055, 79822, 75097, 72607],
    x: [-0.057068, -0.126201, -0.154416, -0.039646, -0.14832, 0.059765, 0.154416],
    y: [-0.5, -0.299972, -0.052648, 0.187819, 0.289522, 0.5, 0.358301],
    mag: [1.97, 4.35, 4.21, 4.29, 4.95, 3.00, 2.07],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    abbr: 'Cas',
    name: 'Cassiopeia',
    hips: [746, 3179, 4427, 6686, 8886],
    x: [0.5, 0.195153, 0.012536, -0.27657, -0.5],
    y: [0.057082, 0.30836, -0.019884, 0.005712, -0.30836],
    mag: [2.28, 2.24, 2.15, 2.66, 3.35],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    abbr: 'Cyg',
    name: 'Cygnus',
    hips: [102098, 100453, 102488, 95947, 97165, 95853, 94779, 99848, 103413, 104732],
    x: [-0.130826, -0.002501, -0.200971, 0.437646, 0.257134, 0.323624, 0.386511, 0.047129, -0.257929, -0.437646],
    y: [-0.158598, 0.043619, 0.279342, 0.5, -0.156324, -0.424308, -0.5, -0.247121, -0.009419, 0.398639],
    mag: [1.25, 2.23, 2.48, 3.05, 2.86, 3.76, 3.80, 3.96, 3.94, 3.21],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [5, 6], [5, 7], [7, 0], [0, 8], [8, 9], [9, 2]],
  },
  {
    abbr: 'Lyr',
    name: 'Lyra',
    hips: [91262, 91919, 91971, 92791, 93194, 92420],
    x: [0.320131, 0.111303, 0.102236, -0.176523, -0.320131, -0.051452],
    y: [-0.376763, -0.5, -0.203006, -0.102311, 0.5, 0.407324],
    mag: [0.03, 4.67, 4.34, 4.22, 3.25, 3.52],
    edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  {
    abbr: 'Sco',
    name: 'Scorpius',
    hips: [78820, 78401, 78265, 80112, 80763, 81266, 82396, 82514, 82729, 84143, 86228, 87073, 86670, 85696, 85927, 87261, 79374, 78104],
    x: [0.450203, 0.490152, 0.489714, 0.280186, 0.200641, 0.13746, 0.005646, -0.007916, -0.027619, -0.162264, -0.356591, -0.45468, -0.420628, -0.33334, -0.357957, -0.49359, 0.385863, 0.49359],
    y: [-0.479945, -0.356342, -0.207733, -0.248064, -0.216839, -0.143975, 0.110019, 0.268119, 0.449894, 0.491957, 0.5, 0.390895, 0.339026, 0.25464, 0.249139, 0.264495, -0.5, -0.075169],
    mag: [2.56, 2.29, 2.89, 2.90, 1.06, 2.82, 2.29, 3.00, 3.62, 3.32, 1.86, 2.99, 2.39, 2.70, 1.62, 3.19, 4.00, 3.87],
    edges: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [0, 16], [2, 17]],
  },
  {
    abbr: 'Leo',
    name: 'Leo',
    hips: [49669, 49583, 50583, 50335, 48455, 47908, 54872, 57632, 54879, 46146, 46750, 55642, 55434],
    x: [0.223126, 0.226673, 0.135712, 0.156205, 0.313797, 0.364906, -0.239827, -0.5, -0.249679, 0.5, 0.462754, -0.32736, -0.313072],
    y: [0.136993, -0.005401, -0.094498, -0.200827, -0.284161, -0.220891, -0.123377, 0.033601, 0.027959, -0.304935, -0.204552, 0.169565, 0.304935],
    mag: [1.36, 3.48, 2.01, 3.43, 3.88, 2.97, 2.56, 2.14, 3.33, 4.47, 4.32, 4.00, 4.05],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 6], [8, 1], [4, 9], [9, 10], [10, 5], [5, 1], [8, 11], [11, 12]],
  },
  {
    abbr: 'Gem',
    name: 'Gemini',
    hips: [32362, 35350, 35550, 34088, 31681, 36962, 37740, 37826, 36046, 34693, 36850, 33018, 32246, 30883, 30343, 29655, 28734],
    x: [0.09844, -0.248617, -0.262493, -0.100949, 0.174897, -0.408304, -0.5, -0.495168, -0.307321, -0.164208, -0.380211, 0.006456, 0.099627, 0.258775, 0.313977, 0.395223, 0.5],
    y: [0.458831, 0.298913, 0.06073, 0.125695, 0.303569, -0.161636, -0.058618, -0.217876, -0.19539, -0.297332, -0.378756, -0.458831, -0.075461, 0.133057, 0.028915, 0.023358, -0.019387],
    mag: [3.35, 3.58, 3.50, 4.01, 1.93, 4.06, 3.57, 1.16, 3.78, 4.41, 1.58, 3.60, 3.06, 4.13, 2.87, 3.31, 4.16],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [5, 7], [5, 8], [8, 9], [9, 10], [9, 11], [9, 12], [12, 13], [12, 14], [14, 15], [15, 16]],
  },
  {
    abbr: 'Tau',
    name: 'Taurus',
    hips: [26451, 21421, 20894, 20205, 20455, 20889, 25428, 16083, 18907, 15900, 16852, 18724],
    x: [-0.5, -0.049847, 0.004749, 0.071964, 0.048469, 0.006455, -0.390757, 0.480707, 0.202366, 0.5, 0.412962, 0.218853],
    y: [-0.224452, -0.050231, -0.0292, -0.021069, -0.081518, -0.133542, -0.453773, 0.154849, 0.281973, 0.176256, 0.453773, 0.076609],
    mag: [2.97, 0.87, 3.40, 3.65, 3.77, 3.53, 1.65, 3.73, 3.91, 3.61, 4.29, 3.41],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [7, 8], [9, 10], [3, 11], [11, 7]],
  },
  {
    abbr: 'Aql',
    name: 'Aquila',
    hips: [98036, 97649, 97278, 95501, 93805, 93747, 97804, 99473, 93244, 93429, 96468],
    x: [-0.230172, -0.175105, -0.12087, 0.125112, 0.35589, 0.357905, -0.197927, -0.423912, 0.423912, 0.410427, -0.009278],
    y: [-0.082694, -0.200204, -0.283499, 0.076199, 0.458981, -0.440981, 0.176698, 0.263032, -0.5, 0.5, 0.287074],
    mag: [3.71, 0.76, 2.72, 3.36, 3.43, 2.99, 3.87, 3.24, 4.02, 4.02, 4.36],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [6, 7], [8, 5], [4, 9], [7, 10], [10, 4], [4, 5]],
  },
  {
    abbr: 'Per',
    name: 'Perseus',
    hips: [17448, 18246, 18614, 18532, 17358, 15863, 14328, 13268, 13531, 14632, 14668, 14576, 14354, 19343, 19812, 20070, 19167, 12777, 8068],
    x: [-0.313513, -0.401017, -0.430157, -0.405988, -0.273305, -0.145319, -0.027116, 0.046545, 0.040994, -0.043032, -0.034402, -0.015002, 0.014177, -0.451512, -0.490085, -0.5, -0.423557, 0.124692, 0.5],
    y: [0.486831, 0.498196, 0.333617, 0.160606, -0.152324, -0.235669, -0.391518, -0.498196, -0.367007, -0.229167, -0.032826, 0.127552, 0.21325, -0.164986, -0.199548, -0.280247, -0.271539, -0.230166, -0.384637],
    mag: [3.84, 2.84, 3.98, 2.90, 3.01, 1.79, 2.91, 3.77, 3.93, 4.05, 3.79, 2.09, 3.32, 3.96, 4.12, 4.60, 4.25, 4.10, 4.01],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 6], [8, 9], [9, 5], [9, 10], [10, 11], [11, 3], [11, 12], [4, 13], [13, 14], [14, 15], [15, 16], [9, 17], [17, 18]],
  },
  {
    abbr: 'CMa',
    name: 'Canis Major',
    hips: [30324, 32349, 34444, 33579, 35904, 31592, 33152, 33347, 34045, 33160],
    x: [0.4022, 0.096854, -0.209836, -0.082969, -0.4022, 0.209661, -0.026469, -0.054022, -0.159609, -0.027389],
    y: [-0.150722, -0.231142, 0.325419, 0.471312, 0.5, -0.083038, 0.196512, -0.212325, -0.292926, -0.5],
    mag: [1.98, -1.44, 1.83, 1.50, 2.45, 3.95, 3.89, 4.36, 4.11, 4.08],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4], [0, 5], [5, 6], [6, 3], [1, 7], [7, 8], [8, 9], [9, 7]],
  },
  {
    abbr: 'Sgr',
    name: 'Sagittarius',
    hips: [90185, 88635, 89931, 90496, 92041, 92855, 93864, 93506, 89642, 89341, 95168, 94141, 93683, 93085],
    x: [0.238102, 0.458128, 0.285688, 0.212941, 0.000564, -0.114161, -0.250165, -0.194821, 0.302038, 0.396454, -0.458128, -0.299934, -0.235436, -0.150189],
    y: [0.369846, 0.171733, 0.128916, -0.108996, -0.028614, -0.064252, 0.013362, 0.129003, 0.5, -0.33363, -0.5, -0.339073, -0.303462, -0.3399],
    mag: [1.79, 2.98, 2.72, 2.82, 3.17, 2.05, 3.32, 2.60, 3.10, 3.84, 3.92, 2.88, 3.76, 3.52],
    edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2], [4, 5], [5, 6], [6, 7], [7, 4], [7, 0], [0, 8], [3, 9], [10, 11], [11, 12], [12, 13], [13, 11]],
  }
];

/** Magnitude tiers, largest for the brightest. Assigned on the global
    distribution, so a star is always the same size in every figure. */
export const MAG_TIER_CUTS: [number, number] = [2.860, 3.650];

export const magTier = (m: number) => (m <= MAG_TIER_CUTS[0] ? 2 : m <= MAG_TIER_CUTS[1] ? 1 : 0);
