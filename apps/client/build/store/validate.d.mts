/** validate.mjs の型（テスト・TypeScript から使うため） */
export interface ImageInfo {
  format: 'png' | 'jpg';
  width: number;
  height: number;
}
export interface CapsuleSpec {
  file: string;
  width: number;
  height: number;
  format: string;
}
export function readImageInfo(bytes: Uint8Array): ImageInfo | null;
export function validateCapsule(spec: CapsuleSpec, bytes: Uint8Array, maxBytes: number): string[];
