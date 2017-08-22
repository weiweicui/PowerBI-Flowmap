import { IPoint } from "../type";

export function translate(x: number, y: number): string;
export function translate(p: IPoint): string;
export function translate(a: number | IPoint, b?: number): string {
    return typeof a === 'number' ? `translate(${a},${b})` : `translate(${a.x},${a.y})`;
}

export function scale(v: number): string {
    return `scale(${v})`;
}

