export type Role = 'user' | 'admin';
export type AndonState = 'green' | 'yellow' | 'red' | 'white';
export type Season = 'spring_summer' | 'autumn_winter';
export type TimeBand = 'madrugada' | 'manana' | 'tarde' | 'noche';

export interface Profile {
  id: string;
  public_id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface TelemetryRow {
  id: number;
  owner_id: string;
  apiary_id: string;
  child_node_id: string;
  mother_node_id: string | null;
  event_uid: string | null;
  temperature_c: number | null;
  humidity_rh: number | null;
  activity_detected: boolean | null;
  acoustic_energy: number | null;
  swarm_band_detected: boolean | null;
  tilt_delta_deg: number | null;
  tilt_critical_deg: number | null;
  tilt_alert: boolean | null;
  seconds_ago: number;
  measured_at: string;
  received_at: string;
  season: Season;
  time_band: TimeBand;
  dew_point_c: number | null;
  dew_point_margin_c: number | null;
  is_valid: boolean;
  andon_state: AndonState;
  alert_title: string | null;
  alert_message: string | null;
}

export interface ChildNode {
  id: string;
  owner_id: string;
  apiary_id: string;
  mac_address: string;
  display_name: string;
  standard_boxes: number;
  three_quarter_boxes: number;
  half_boxes: number;
  estimated_height_cm: number | null;
  critical_tilt_deg: number | null;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
}
