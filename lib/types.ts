export type Borough =
  | "Manhattan"
  | "Brooklyn"
  | "Queens"
  | "Bronx"
  | "Staten Island";

export interface Park {
  code: string;
  name: string;
  borough: Borough;
}

export interface Permit {
  start: Date;
  end: Date;
  fieldName: string;
  sport: string;
  sportRaw: string;
  eventName: string;
  organization: string;
  status: string;
}

export interface TimeBlock {
  /** Decimal hour within the day, 0..24. e.g. 16.5 = 4:30pm. */
  startHour: number;
  endHour: number;
  label: string;
}

export interface DayAvailability {
  /** YYYY-MM-DD in NYC local time. */
  date: string;
  booked: TimeBlock[];
}

export interface FieldAvailability {
  parkCode: string;
  parkName: string;
  borough: Borough;
  fieldName: string;
  fieldDisplayName: string;
  sports: string[];
  days: DayAvailability[];
}

export interface AvailabilityResponse {
  sport: string;
  startDate: string;
  endDate: string;
  windowStartHour: number;
  windowEndHour: number;
  fields: FieldAvailability[];
  warnings: string[];
  fetchedAt: string;
}
