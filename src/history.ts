import type { Brick } from './bricks/catalog';
import { Grid } from './grid';

interface Command { execute(): void; undo(): void }
export class History {
  private past: Command[] = [];
  private future: Command[] = [];
  onChange = () => {};
  constructor(private grid: Grid) {}
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  private run(command: Command) {
    command.execute(); this.past.push(command); this.future = [];
    if (this.past.length > 200) this.past.shift();
    this.onChange();
  }
  place(brick: Brick) {
    if (this.grid.bricks.has(brick.id) || this.grid.collides(brick) || !this.grid.inBounds(brick)) return false;
    this.run({ execute: () => { this.grid.add(brick); }, undo: () => { this.grid.remove(brick.id); } }); return true;
  }
  delete(id: string) {
    const brick = this.grid.bricks.get(id); if (!brick) return;
    const snapshot = { ...brick };
    this.run({ execute: () => { this.grid.remove(id); }, undo: () => { this.grid.add(snapshot); } });
  }
  replace(next: Brick[]) {
    const before = this.grid.snapshot();
    this.run({ execute: () => this.grid.replace(next), undo: () => this.grid.replace(before) });
  }
  undo() { const command = this.past.pop(); if (command) { command.undo(); this.future.push(command); this.onChange(); } }
  redo() { const command = this.future.pop(); if (command) { command.execute(); this.past.push(command); this.onChange(); } }
}
