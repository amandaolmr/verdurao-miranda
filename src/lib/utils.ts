import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const UNIDADES = [
  { value: "KG", label: "Kg" },
  { value: "G", label: "g" },
  { value: "UN", label: "UN" },
  { value: "DZ", label: "DZ" },
  { value: "MACO", label: "Maço" },
  { value: "BANDEJA", label: "Bandeja" },
] as const;

export type UnidadeVenda = (typeof UNIDADES)[number]["value"];

export function formatUnidade(value: string): string {
  return UNIDADES.find((u) => u.value === value)?.label ?? value;
}
