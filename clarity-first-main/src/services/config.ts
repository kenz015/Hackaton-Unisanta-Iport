export interface CapacityConfig {
  hoursPerDay: number;
  attentionLimit: number; // %
  overloadLimit: number; // %
  staleDays: number;
  holidayUF: string;
}

export const defaultConfig: CapacityConfig = {
  hoursPerDay: 8,
  attentionLimit: 85,
  overloadLimit: 100,
  staleDays: 5,
  holidayUF: "SP",
};
