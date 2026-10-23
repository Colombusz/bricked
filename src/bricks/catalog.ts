export type Category = 'Bricks' | 'Plates' | 'Tiles';
export interface BrickType { id: string; category: Category; width: number; depth: number; height: number; studs: boolean; label: string }
function parts(category: Category, height: number, sizes: [number, number][]): BrickType[] {
  return sizes.map(([width, depth]) => ({ id: `${category.toLowerCase()}-${width}x${depth}`, category, width, depth, height, studs: category !== 'Tiles', label: `${width}×${depth}` }));
}
export const CATALOG = [
  ...parts('Bricks', 3, [[1,1],[1,2],[1,3],[1,4],[1,6],[2,2],[2,3],[2,4],[2,6]]),
  ...parts('Plates', 1, [[1,1],[1,2],[2,2],[2,4],[4,4]]),
  ...parts('Tiles', 1, [[1,1],[1,2],[2,2]]),
];
export const TYPES = new Map(CATALOG.map(type => [type.id, type]));
export const COLORS = [
  { name: 'Coral red', hex: '#e74c3c' }, { name: 'Ocean blue', hex: '#247bc0' },
  { name: 'Sunshine', hex: '#f4c740' }, { name: 'Leaf green', hex: '#3d9257' },
  { name: 'Cloud white', hex: '#f4f3ed' }, { name: 'Carbon black', hex: '#293038' },
  { name: 'Tangerine', hex: '#f18b36' }, { name: 'Light gray', hex: '#b9c1c6' },
  { name: 'Slate gray', hex: '#65737e' }, { name: 'Cocoa', hex: '#80523c' },
  { name: 'Sand', hex: '#d3b88a' }, { name: 'Bubblegum', hex: '#ec96b4' },
  { name: 'Lime', hex: '#a6c83e' }, { name: 'Grape', hex: '#9270bb' },
];
export interface Brick { id: string; type: string; color: string; rotation: number; x: number; y: number; z: number }
export function dimensions(brick: Pick<Brick, 'type' | 'rotation'>) {
  const type = TYPES.get(brick.type)!;
  return brick.rotation % 180 === 0 ? { width: type.width, depth: type.depth, height: type.height } : { width: type.depth, depth: type.width, height: type.height };
}
