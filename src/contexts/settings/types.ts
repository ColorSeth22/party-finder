export type DistanceUnit = 'km' | 'mi';

export interface Settings {
  distanceUnit: DistanceUnit;
  toggleDistanceUnit: () => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
}