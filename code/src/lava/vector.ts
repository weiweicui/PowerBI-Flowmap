import { IPoint } from './type';

export function unit(e1: IPoint, e2: IPoint): [number, number] {
    let a = e2.x - e1.x, b = e2.y - e1.y;
    let s = Math.sqrt(a * a + b * b);
    return [a / s, b / s];
}

export function scale(e1: IPoint, e2: IPoint, scale: number): [number, number] {
    let a = e2.x - e1.x, b = e2.y - e1.y;
    return [a * scale, b * scale];
}

export function create(e1: IPoint, e2: IPoint): [number, number] {
    return [e2.x - e1.x, e2.y - e1.y];
}

export function length(e1: IPoint, e2: IPoint, len: number): [number, number] {
    let a = e2.x - e1.x, b = e2.y - e1.y;
    let s = Math.sqrt(a * a + b * b);
    return [a / s * len, b / s * len];
}

export function norm(vec: [number, number]): number {
    return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);
}