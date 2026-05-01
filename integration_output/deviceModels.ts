/**
 * src/models/maps/fire_tv/deviceModels.ts
 *
 * Device model → raw input event path registry.
 * Extracted from HA-Firemote supported-devices.js.
 *
 * Used by the firemote-adapter to resolve the correct /dev/input/eventN path
 * for low-latency ADB sendevent commands on specific hardware models.
 *
 * In your URC YAML config, set `device_type: fire_stick_4k` (or whichever
 * model you have) to enable sendevent-based navigation instead of the higher-
 * latency ADB key name commands.
 *
 * If `device_type` is not set, the adapter falls back to simple ADB key names
 * (UP, DOWN, LEFT, RIGHT, etc.) which work on all devices.
 */

export interface FireTVDeviceModel {
  /** Human-readable device name */
  friendlyName: string;
  /** /dev/input/eventN path for sendevent commands, or "undefined" to force ADB key mode */
  defaultEventListenerBinPath: string;
  /** Device family group */
  family: 'amazon-fire';
  /** Whether this device has a physical tuner (affects channel button support) */
  tuner?: boolean;
  /** Number of HDMI inputs (0 = streaming stick) */
  hdmiInputs?: number;
}

export const FIRE_TV_DEVICE_MODELS: Record<string, FireTVDeviceModel> = {

  // ─── Smart TVs ───────────────────────────────────────────────────────────
  fire_tv_4_series: {
    friendlyName: 'Fire TV (4 Series - 2021)',
    defaultEventListenerBinPath: '/dev/input/event0',
    family: 'amazon-fire',
    tuner: true,
    hdmiInputs: 4,
  },
  fire_tv_insignia_f20: {
    friendlyName: 'INSIGNIA TV (F20 Series)',
    defaultEventListenerBinPath: '/dev/input/event0',
    family: 'amazon-fire',
    tuner: true,
    hdmiInputs: 3,
  },
  'fire_tv_jvc-4k-2021': {
    friendlyName: 'JVC 4K - Fire TV with Freeview Play (2021)',
    defaultEventListenerBinPath: '/dev/input/event0',
    family: 'amazon-fire',
    tuner: true,
    hdmiInputs: 4,
  },
  fire_tv_toshiba_v35: {
    friendlyName: 'Toshiba Fire TV (V35 Series - 2021)',
    defaultEventListenerBinPath: '/dev/input/event0',
    family: 'amazon-fire',
    tuner: true,
    hdmiInputs: 4,
  },

  // ─── Fire TV Cubes ───────────────────────────────────────────────────────
  fire_tv_cube_third_gen: {
    friendlyName: 'Fire TV Cube (3rd Gen - 2022)',
    defaultEventListenerBinPath: '/dev/input/event3',
    family: 'amazon-fire',
    hdmiInputs: 1,
  },
  fire_tv_cube_second_gen: {
    friendlyName: 'Fire TV Cube (2nd Gen - 2019)',
    defaultEventListenerBinPath: '/dev/input/event5',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_cube_first_gen: {
    friendlyName: 'Fire TV Cube (1st Gen - 2018)',
    defaultEventListenerBinPath: '/dev/input/event5',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },

  // ─── Fire TV Sticks (no eventListenerBinPath — uses ADB key fallback) ──
  fire_tv_stick_4k_max_second_gen: {
    friendlyName: 'Fire TV Stick 4K Max (2nd Gen - 2023)',
    defaultEventListenerBinPath: 'undefined',  // uses ADB KEYCODE commands
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_stick_4k_second_gen: {
    friendlyName: 'Fire TV Stick 4K (2nd Gen - 2023)',
    defaultEventListenerBinPath: 'undefined',  // uses ADB KEYCODE commands
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_stick_4k_max: {
    friendlyName: 'Fire TV Stick 4K Max (1st Gen - 2021)',
    defaultEventListenerBinPath: '/dev/input/event5',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_3rd_gen: {
    friendlyName: 'Fire TV Stick (3rd Gen - 2020)',
    defaultEventListenerBinPath: '/dev/input/event4',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_stick_lite: {
    friendlyName: 'Fire TV Stick Lite (1st Gen - 2020)',
    defaultEventListenerBinPath: '/dev/input/event4',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_stick_4k: {
    friendlyName: 'Fire TV Stick 4K (1st Gen - 2018)',
    defaultEventListenerBinPath: '/dev/input/event4',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_stick_second_gen: {
    friendlyName: 'Fire TV Stick (2nd Gen - 2016-2019)',
    defaultEventListenerBinPath: '/dev/input/event4',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_stick_basic: {
    friendlyName: 'Fire TV Stick (Basic Edition - 2017)',
    defaultEventListenerBinPath: '/dev/input/event4',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_stick_first_gen: {
    friendlyName: 'Fire TV Stick (1st Gen - 2014)',
    defaultEventListenerBinPath: '/dev/input/event1',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_third_gen_2017: {
    friendlyName: 'Fire TV (3rd Gen - 2017)',
    defaultEventListenerBinPath: '/dev/input/event3',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
  fire_tv_second_gen_2015: {
    friendlyName: 'Fire TV (2nd Gen - 2015)',
    defaultEventListenerBinPath: '/dev/input/event6',
    family: 'amazon-fire',
    hdmiInputs: 0,
  },
};

/**
 * Resolve the ADB event listener binary path for a given device type.
 * Returns the path, or "undefined" if the device should use simple ADB key commands.
 */
export function resolveEventPath(
  deviceType: string | undefined,
  compatibilityMode?: string
): string {
  if (compatibilityMode === 'strong') return 'undefined';
  if (compatibilityMode && compatibilityMode !== 'default') {
    // Custom path like "event4" — prefix it
    return `/dev/input/${compatibilityMode}`;
  }
  if (!deviceType) return 'undefined';
  return FIRE_TV_DEVICE_MODELS[deviceType]?.defaultEventListenerBinPath ?? 'undefined';
}

/**
 * Check whether a device type is a "stick" model that uses media_player
 * turn_on/turn_off for power rather than ADB POWER.
 */
export function isStickModel(deviceType: string | undefined): boolean {
  const sticks = [
    'fire_stick_4k',
    'fire_tv_stick_4k_max',
    'fire_tv_3rd_gen',
    'fire_stick_second_gen',
    'fire_tv_stick_4k_second_gen',
    'fire_tv_stick_4k_max_second_gen',
  ];
  return !!deviceType && sticks.includes(deviceType);
}
