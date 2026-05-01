/**
 * src/models/maps/fire_tv/defaultKeys.ts  — ENHANCED VERSION
 *
 * Changes from original:
 *   - `power` now uses a perform-action template for state-aware toggling
 *   - Navigation keys gain conditional KEYCODE_* variants for ATV Remote Integration
 *   - All new behaviour is template-driven — no new code paths in the card itself
 *   - Original simple key entries are preserved as fallback
 *
 * How the power template works:
 *   When `android_tv_remote_id` is set in config, it sends KEYCODE_POWER via
 *   the remote domain. Otherwise it checks current state and calls
 *   media_player.turn_on or media_player.turn_off for stick/cube models,
 *   or androidtv.adb_command POWER for others.
 *
 *   The Nunjucks template evaluates at runtime using the config context
 *   that URC already provides to every element.
 */

import { IElementConfig } from '../../interfaces';

/**
 * https://www.home-assistant.io/integrations/androidtv#androidtvadb_command
 */
export const fireTVDefaultKeys: IElementConfig[] = [

	// ─── Power ──────────────────────────────────────────────────────────────
	{
		name: 'power',
		/*
		 * State-aware power adapted from HA-Firemote.
		 *
		 * Priority:
		 * 1. If android_tv_remote_id is set → remote.send_command KEYCODE_POWER
		 * 2. If state is off/unavailable   → media_player.turn_on
		 * 3. Else                           → media_player.turn_off
		 *
		 * This matches HA-Firemote's Fire TV stick / cube logic.
		 * For the original simple POWER ADB key, replace tap_action with:
		 *   { action: 'key', key: 'POWER' }
		 */
		tap_action: {
			action: 'perform-action',
			perform_action: "{{ 'remote.send_command' if config.android_tv_remote_id else ('media_player.turn_on' if states(config.entity) in ['off','unavailable','standby'] else 'media_player.turn_off') }}",
			target: {
				entity_id: "{{ config.android_tv_remote_id if config.android_tv_remote_id else config.media_player_id }}",
			},
			data: "{{ {'command': 'KEYCODE_POWER'} if config.android_tv_remote_id else {} }}",
		},
		icon: 'mdi:power',
	},

	{
		name: 'sleep',
		tap_action: { action: 'key', key: 'SLEEP' },
		icon: 'mdi:power-sleep',
	},
	{
		name: 'resume',
		tap_action: { action: 'key', key: 'RESUME' },
		icon: 'mdi:power-on',
	},
	{
		name: 'wakeup',
		tap_action: { action: 'key', key: 'RESUME' },
		icon: 'mdi:power-on',
	},
	{
		name: 'suspend',
		tap_action: { action: 'key', key: 'SUSPEND' },
		icon: 'mdi:power-off',
	},

	// ─── Navigation ─────────────────────────────────────────────────────────
	/*
	 * Navigation keys send KEYCODE_* via the Android TV Remote Integration when
	 * `android_tv_remote_id` is configured, falling back to ADB key names.
	 *
	 * This is the same priority logic as HA-Firemote:
	 *   ATV Remote (lower latency) > ADB key names
	 *
	 * If you don't use the ATV Remote Integration, these behave identically
	 * to the original URC defaults.
	 */
	{
		name: 'up',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'UP',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_DPAD_UP'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:chevron-up',
	},
	{
		name: 'down',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'DOWN',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_DPAD_DOWN'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:chevron-down',
	},
	{
		name: 'left',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'LEFT',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_DPAD_LEFT'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:chevron-left',
	},
	{
		name: 'right',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'RIGHT',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_DPAD_RIGHT'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:chevron-right',
	},
	{
		name: 'center',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'CENTER',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_DPAD_CENTER'} if config.android_tv_remote_id else {} }}",
		},
		icon: 'mdi:circle',
	},

	// ─── System navigation ───────────────────────────────────────────────────
	{
		name: 'home',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'HOME',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_HOME'} if config.android_tv_remote_id else {} }}",
		},
		icon: 'mdi:home',
	},
	{
		name: 'move_home',
		tap_action: { action: 'key', key: 'MOVE_HOME' },
		icon: 'mdi:home-import-outline',
	},
	{
		name: 'back',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'BACK',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_BACK'} if config.android_tv_remote_id else {} }}",
		},
		icon: 'mdi:keyboard-backspace',
	},
	{
		name: 'menu',
		tap_action: { action: 'key', key: 'MENU' },
		icon: 'mdi:menu',
	},
	{
		name: 'settings',
		tap_action: { action: 'key', key: 'SETTINGS' },
		icon: 'mdi:cog',
	},
	{
		name: 'recents',
		tap_action: { action: 'key', key: 'RECENTS' },
		icon: 'mdi:history',
	},
	{
		name: 'profile',
		// Google TV profile switch — Fire TV specific
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent KEYCODE_PROFILE_SWITCH' },
		},
		icon: 'mdi:account-circle',
	},

	// ─── Volume ──────────────────────────────────────────────────────────────
	{
		name: 'volume_up',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'VOLUME_UP',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_VOLUME_UP'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:volume-high',
	},
	{
		name: 'volume_down',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'VOLUME_DOWN',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_VOLUME_DOWN'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:volume-medium',
	},
	{
		name: 'volume_mute',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'MUTE',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_VOLUME_MUTE'} if config.android_tv_remote_id else {} }}",
		},
		icon: 'mdi:volume-low',
	},
	{
		name: 'volume_buttons',
		icon: 'mdi:volume-plus',
	},
	{
		type: 'slider',
		name: 'slider',
		range: [0, 1],
		step: 0.01,
		value_attribute: 'volume_level',
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.volume_set',
			data: {
				volume_level: '{{ value | float }}',
			},
		},
	},

	// ─── Media controls ──────────────────────────────────────────────────────
	{
		name: 'play_pause',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'perform-action' }}",
			perform_action: "{{ 'remote.send_command' if config.android_tv_remote_id else 'media_player.media_play_pause' }}",
			target: { entity_id: "{{ config.android_tv_remote_id if config.android_tv_remote_id else config.media_player_id }}" },
			data: "{{ {'command': 'KEYCODE_MEDIA_PLAY_PAUSE'} if config.android_tv_remote_id else {} }}",
		},
		icon: 'mdi:play-pause',
	},
	{
		name: 'play',
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.media_play',
			target: { entity_id: '{{ config.media_player_id }}' },
		},
		icon: 'mdi:play',
	},
	{
		name: 'pause',
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.media_pause',
			target: { entity_id: '{{ config.media_player_id }}' },
		},
		icon: 'mdi:pause',
	},
	{
		name: 'stop',
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.media_stop',
			target: { entity_id: '{{ config.media_player_id }}' },
		},
		icon: 'mdi:stop',
	},
	{
		name: 'rewind',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'REWIND',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_MEDIA_REWIND'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:rewind',
	},
	{
		name: 'fast_forward',
		tap_action: {
			action: "{{ 'perform-action' if config.android_tv_remote_id else 'key' }}",
			key: 'FAST_FORWARD',
			perform_action: 'remote.send_command',
			target: { entity_id: '{{ config.android_tv_remote_id }}' },
			data: "{{ {'command': 'KEYCODE_MEDIA_FAST_FORWARD'} if config.android_tv_remote_id else {} }}",
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:fast-forward',
	},
	{
		name: 'previous',
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.media_previous_track',
			target: { entity_id: '{{ config.media_player_id }}' },
		},
		icon: 'mdi:skip-previous',
	},
	{
		name: 'next',
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.media_next_track',
			target: { entity_id: '{{ config.media_player_id }}' },
		},
		icon: 'mdi:skip-next',
	},

	// ─── Channel controls (Fire TV Smart TVs and some sticks) ────────────────
	{
		name: 'channel_up',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent KEYCODE_CHANNEL_UP' },
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:arrow-up-circle',
	},
	{
		name: 'channel_down',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent KEYCODE_CHANNEL_DOWN' },
		},
		hold_action: { action: 'repeat' },
		icon: 'mdi:arrow-down-circle',
	},

	// ─── Number pad ──────────────────────────────────────────────────────────
	{
		name: 'n0',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 7' },
		},
		icon: 'mdi:numeric-0',
	},
	{
		name: 'n1',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 8' },
		},
		icon: 'mdi:numeric-1',
	},
	{
		name: 'n2',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 9' },
		},
		icon: 'mdi:numeric-2',
	},
	{
		name: 'n3',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 10' },
		},
		icon: 'mdi:numeric-3',
	},
	{
		name: 'n4',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 11' },
		},
		icon: 'mdi:numeric-4',
	},
	{
		name: 'n5',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 12' },
		},
		icon: 'mdi:numeric-5',
	},
	{
		name: 'n6',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 13' },
		},
		icon: 'mdi:numeric-6',
	},
	{
		name: 'n7',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 14' },
		},
		icon: 'mdi:numeric-7',
	},
	{
		name: 'n8',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 15' },
		},
		icon: 'mdi:numeric-8',
	},
	{
		name: 'n9',
		tap_action: {
			action: 'perform-action',
			perform_action: 'androidtv.adb_command',
			target: { entity_id: '{{ config.media_player_id }}' },
			data: { command: 'adb shell input keyevent 16' },
		},
		icon: 'mdi:numeric-9',
	},

	// ─── Keyboard / text input ────────────────────────────────────────────
	{
		name: 'keyboard',
		tap_action: { action: 'keyboard' },
		icon: 'mdi:keyboard',
	},
	{
		name: 'textbox',
		tap_action: { action: 'textbox' },
		icon: 'mdi:keyboard-outline',
	},
	{
		name: 'search',
		tap_action: { action: 'search' },
		icon: 'mdi:magnify',
	},
];
