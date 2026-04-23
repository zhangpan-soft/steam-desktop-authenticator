import { parse, stringify } from 'lossless-json';

// 入参建议用 Record<string, any> 或 any，在 TS 中直接使用大写 Object 会有一些严格模式下的类型限制
export function toJson(obj: any): string {
    return stringify(obj) as string;
}

export function fromJson<T>(json: string): T {
    return parse(json) as T;
}
