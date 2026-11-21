import { createLucideIcon } from "lucide-react";

// Íconos de ventilador por velocidad: la misma pala del `Fan` de lucide repetida N veces
// alrededor del centro. Cuantas más palas, más rápido parece girar.
// Baja 4 (idéntico al `Fan` de lucide) · Media 6 · Alta 8
export const FanLow = createLucideIcon("fan-low", [
  ["path", { d: "M10.83 16.38A6.08 6.08 0 0 1 2.21 9.38L7.62 10.83A6.08 6.08 0 0 1 14.62 2.21L13.17 7.62A6.08 6.08 0 0 1 21.79 14.62L16.38 13.17A6.08 6.08 0 0 1 9.38 21.79L10.83 16.38Z", key: "blades" }],
  ["path", { d: "M12 12v.01", key: "hub" }],
]);

export const FanMedium = createLucideIcon("fan-medium", [
  ["path", { d: "M10.83 16.38A4.82 4.82 0 0 1 2.21 14.62L7.62 13.17A4.82 4.82 0 0 1 4.83 4.83L8.80 8.80A4.82 4.82 0 0 1 14.62 2.21L13.17 7.62A4.82 4.82 0 0 1 21.79 9.38L16.38 10.83A4.82 4.82 0 0 1 19.17 19.17L15.20 15.20A4.82 4.82 0 0 1 9.38 21.79L10.83 16.38Z", key: "blades" }],
  ["path", { d: "M12 12v.01", key: "hub" }],
]);

export const FanHigh = createLucideIcon("fan-high", [
  ["path", { d: "M10.83 16.38A4.19 4.19 0 0 1 3.22 17.07L8.08 14.27A4.19 4.19 0 0 1 2.21 9.38L7.62 10.83A4.19 4.19 0 0 1 6.93 3.22L9.73 8.08A4.19 4.19 0 0 1 14.62 2.21L13.17 7.62A4.19 4.19 0 0 1 20.78 6.93L15.92 9.73A4.19 4.19 0 0 1 21.79 14.62L16.38 13.17A4.19 4.19 0 0 1 17.07 20.78L14.26 15.92A4.19 4.19 0 0 1 9.38 21.79L10.83 16.38Z", key: "blades" }],
  ["path", { d: "M12 12v.01", key: "hub" }],
]);
