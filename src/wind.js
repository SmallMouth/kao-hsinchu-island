// One world-space wind field; this is illustrative, not live weather data.
export const WIND_DIRECTION = Object.freeze({ x: 0.6, z: 0.8 });

export function sampleWind(time) {
  const gust = 0.65 + 0.22 * Math.sin(time * 0.7) + 0.1 * Math.sin(time * 1.9);
  // Integrating the gust curve makes all passive drift continuous and downwind.
  const travel = 0.65 * time + (0.22 / 0.7) * (1 - Math.cos(time * 0.7))
    + (0.1 / 1.9) * (1 - Math.cos(time * 1.9));
  return { gust, sway: gust * 0.13, travel };
}

// Steady-state response of a damped spring to the shared harmonic gusts.
function springResponse(time, naturalFrequency, damping) {
  let response = 0.65;
  for (const [amplitude, frequency] of [[0.22, 0.7], [0.1, 1.9]]) {
    const stiffness = naturalFrequency ** 2;
    const real = stiffness - frequency ** 2;
    const imaginary = 2 * damping * naturalFrequency * frequency;
    const gain = stiffness / Math.hypot(real, imaginary);
    const lag = Math.atan2(imaginary, real);
    response += amplitude * gain * Math.sin(time * frequency - lag);
  }
  return response;
}

export function sampleTreeWind(time, x = 0, z = 0) {
  // Only flexibility varies between trees; wind direction and gust timing do not.
  const flexibility = 1 + 0.12 * Math.sin(x * 0.61 + z * 0.37);
  return {
    trunk: 0.22 * flexibility * springResponse(time, 2.8, 0.72),
    crown: 0.3 * flexibility * springResponse(time, 2.2, 0.65),
    flutter: 0.07 * flexibility * springResponse(time, 4.2, 0.6),
  };
}
