/**
 * src/models/interfaces/IConfig.ts  — PATCHED VERSION
 *
 * Changes from original:
 *   - Added `android_tv_remote_id`  (Android TV Remote Integration entity)
 *   - Added `device_type`           (enables sendevent paths for Fire TV)
 *   - Added `compatibility_mode`    (ADB compatibility override for Fire TV)
 *
 * All new fields are optional — no existing configs are broken.
 */

import { IElementConfig, Platform } from '.';

export type Row = string | Row[];

export interface IIconConfig {
	name: string;
	path: string;
}

export interface IConfig {
	type?: string;
	title?: string;

	// ─── Platform / entity settings (unchanged) ────────────────────────────
	platform?: Platform;
	keyboard_id?: string;
	remote_id?: string;
	media_player_id?: string;
	device?: string;
	autofill_entity_id?: boolean;

	// ─── HA-Firemote backend fields (Fire TV only) ─────────────────────────
	/**
	 * The `remote.*` entity from the **Android TV Remote Integration**.
	 * When set for Fire TV / Android TV platforms, navigation commands are sent
	 * as KEYCODE_* via `remote.send_command` instead of ADB strings.
	 * This provides lower latency and is preferred when the ATV Remote Integration
	 * is installed.
	 *
	 * Example: `remote.fire_tv_remote`
	 */
	android_tv_remote_id?: string;

	/**
	 * Device model slug — enables model-specific optimisations for Fire TV.
	 * When set, navigation and media keys use low-latency `sendevent` ADB commands
	 * instead of the higher-latency ADB key-name strings.
	 *
	 * Supported values (from HA-Firemote device registry):
	 *   fire_stick_4k | fire_tv_3rd_gen | fire_tv_stick_4k_max |
	 *   fire_tv_stick_lite | fire_tv_cube_third_gen | fire_tv_cube_second_gen |
	 *   fire_tv_4_series | fire_tv_toshiba_v35 | fire_tv_jvc-4k-2021 |
	 *   fire_tv_insignia_f20 | fire_stick_second_gen | fire_stick_basic |
	 *   fire_stick_first_gen | fire_tv_stick_4k_second_gen |
	 *   fire_tv_stick_4k_max_second_gen | fire_tv_cube_first_gen |
	 *   fire_tv_third_gen_2017 | fire_tv_second_gen_2015
	 *
	 * Leave unset to use simple ADB key commands (works on all devices, slightly slower).
	 */
	device_type?: string;

	/**
	 * ADB compatibility mode for Fire TV (default: "default").
	 *
	 * - "default" — Use sendevent if `device_type` is known, else ADB key names
	 * - "strong"  — Always use simple ADB key names (most compatible)
	 * - "eventN"  — Force a specific /dev/input/eventN path (e.g. "event4")
	 *
	 * Leave unset or use "default" for the best auto-detected behaviour.
	 */
	compatibility_mode?: 'default' | 'strong' | string;

	// ─── Customisation (unchanged) ─────────────────────────────────────────
	custom_actions?: IElementConfig[];
	custom_actions_file?: string;
	custom_icons?: IIconConfig[];

	styles?: string;
	haptics?: boolean;

	hold_time?: number;
	repeat_delay?: number;
	double_tap_window?: number;

	rows?: Row[];
}
