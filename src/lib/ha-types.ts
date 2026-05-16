import type { HassEntity } from "home-assistant-js-websocket";

export type { HassEntity };

export type EntityState = HassEntity["state"];

export interface SwitchEntity extends HassEntity {
  state: "on" | "off";
}

export interface LightEntity extends HassEntity {
  state: "on" | "off";
  attributes: {
    brightness?: number;
    color_mode?: string;
    color_temp?: number;
    rgb_color?: [number, number, number];
    hs_color?: [number, number];
    supported_color_modes?: string[];
    friendly_name?: string;
  };
}

export interface CoverEntity extends HassEntity {
  state: "open" | "closed" | "opening" | "closing";
  attributes: {
    current_position?: number;
    friendly_name?: string;
  };
}

export interface ClimateEntity extends HassEntity {
  state: "off" | "heat" | "cool" | "auto" | "dry" | "fan_only";
  attributes: {
    current_temperature?: number;
    temperature?: number;
    min_temp?: number;
    max_temp?: number;
    hvac_modes?: string[];
    friendly_name?: string;
  };
}

export interface MediaPlayerEntity extends HassEntity {
  state: "playing" | "paused" | "idle" | "off";
  attributes: {
    media_title?: string;
    media_artist?: string;
    volume_level?: number;
    source?: string;
    friendly_name?: string;
  };
}

export interface SensorEntity extends HassEntity {
  state: string;
  attributes: {
    unit_of_measurement?: string;
    friendly_name?: string;
  };
}

export interface VacuumEntity extends HassEntity {
  state: "docked" | "cleaning" | "paused" | "idle" | "returning";
  attributes: {
    battery_level?: number;
    status?: string;
    friendly_name?: string;
  };
}

export interface HAConfig {
  url: string;
  token: string;
}

export type HAEntityMap = Record<string, HassEntity>;
