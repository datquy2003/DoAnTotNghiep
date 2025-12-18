export const sliceColor = (idx) => {
  const hue = (idx * 137.508) % 360;
  return `hsl(${hue} 70% 45%)`;
};