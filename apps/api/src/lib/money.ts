/** Format an integer KES amount: KES 12,500 */
export function kes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString("en-KE")}`;
}
