/** Directional ship-sheet order: down, up, right, left.
 *
 * The generated source art has its two horizontal images stored opposite to
 * their manifest labels, so movement must intentionally select the other
 * horizontal frame. Vertical movement and vertical-dominant diagonals keep
 * their existing frames.
 */
export function worldShipDirectionFrame(dx: number, dy: number): number {
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 3 : 2;
  return dy >= 0 ? 0 : 1;
}
