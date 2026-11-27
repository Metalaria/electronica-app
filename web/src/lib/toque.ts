// 2.2: the app's minimum touch target, Material's 48 dp (it was the owner's 44 px since 0.11). Controls measure it
// (CSS: the 48 px sizes and the `toque-44` touch boxes of app.css); drawn things that must not grow — a figure's zones,
// the drawn instruments' buttons, the schematic's handles — get a hit area of at least this much around the drawing.
export const TOQUE_MIN = 48;
