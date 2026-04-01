import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR");
}

export function formatDateISO(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0];
}

export function getQuarterLabel(quarter: string): string {
  const [year, q] = quarter.split("-");
  const labels: Record<string, string> = {
    Q1: "1º Trimestre",
    Q2: "2º Trimestre",
    Q3: "3º Trimestre",
    Q4: "4º Trimestre",
  };
  return `${labels[q] || q} ${year}`;
}

export function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
