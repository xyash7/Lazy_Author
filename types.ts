
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
}

export interface PenSize {
  id: string;
  value: number;
  label: string;
}

export interface PenColor {
  id: string;
  value: string;
  label: string;
}
