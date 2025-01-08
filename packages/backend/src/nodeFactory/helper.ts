// Helper function to convert font weight to style
export function getFontStyle(weight: number): string {
  if (weight <= 100) return "Thin";
  if (weight <= 200) return "ExtraLight";
  if (weight <= 300) return "Light";
  if (weight <= 400) return "Regular";
  if (weight <= 500) return "Medium";
  if (weight <= 600) return "SemiBold";
  if (weight <= 700) return "Bold";
  if (weight <= 800) return "ExtraBold";
  return "Black";
}
