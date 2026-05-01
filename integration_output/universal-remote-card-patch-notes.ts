/**
 * universal-remote-card.ts — PATCH INSTRUCTIONS
 * ═══════════════════════════════════════════════
 *
 * You only need to make ONE change to universal-remote-card.ts:
 * Pass the new config fields down through `updateElementConfig` so that
 * the Nunjucks templates in defaultKeys.ts can access
 * `config.android_tv_remote_id` and `config.media_player_id` at render time.
 *
 * Good news: URC already does this. The `config` object is already passed
 * into the template context in `updateElementConfig` here:
 *
 *   const context = {
 *     config: {
 *       ...this.config,          ← all IConfig fields are already available
 *       entity: ...,
 *       attribute: ...,
 *     },
 *   };
 *
 * This means `config.android_tv_remote_id` is ALREADY available in templates
 * as soon as you add it to IConfig.ts and set it in your YAML.
 *
 * ── REQUIRED CHANGE ──────────────────────────────────────────────────────
 *
 * The only required change is in `updateElementConfig`, where `perform-action`
 * targets are auto-assigned. The current code auto-assigns `remote_id` or
 * `media_player_id` based on domain. We need to also handle the case where
 * the action's domain is `remote` and the config has `android_tv_remote_id`.
 *
 * Find this block in updateElementConfig (around line 67 in the original):
 *
 *   case 'remote':
 *     target.entity_id = entity.startsWith('remote')
 *       ? updatedElement.entity_id
 *       : this.config.remote_id;
 *     break;
 *
 * Replace with:
 *
 *   case 'remote':
 *     target.entity_id = entity.startsWith('remote')
 *       ? updatedElement.entity_id
 *       : this.config.android_tv_remote_id  // ← prefer ATV remote for KEYCODE_*
 *         ?? this.config.remote_id;
 *     break;
 *
 * ── OPTIONAL CHANGE (editor UI) ──────────────────────────────────────────
 *
 * If you want the visual editor to show the new fields, add them to
 * `universal-remote-card-editor.ts`. This is entirely optional — the card
 * works perfectly with manual YAML.
 *
 * In the editor's schema array, add entries like:
 *
 *   {
 *     name: 'android_tv_remote_id',
 *     selector: { entity: { domain: 'remote' } },
 *     label: 'Android TV Remote Integration entity',
 *   },
 *   {
 *     name: 'device_type',
 *     selector: { select: { options: FIRE_TV_DEVICE_MODELS_LIST } },
 *     label: 'Fire TV device model (optional)',
 *   },
 *   {
 *     name: 'compatibility_mode',
 *     selector: { select: { options: ['default', 'strong'] } },
 *     label: 'ADB compatibility mode (optional)',
 *   },
 *
 * ── NO OTHER CHANGES NEEDED ──────────────────────────────────────────────
 *
 * The action dispatch in base-remote-element.ts does NOT need modification.
 * The `key` action handler already sends `remote.send_command` for Fire TV.
 * The `perform-action` handler already calls any service you specify.
 * Everything works through the template system.
 */


// ─── Minimal patch for updateElementConfig ──────────────────────────────────
// Apply this patch to src/universal-remote-card.ts

/*
FIND (around line 67 in updateElementConfig):

  case 'remote':
    target.entity_id = entity.startsWith('remote')
      ? updatedElement.entity_id
      : this.config.remote_id;
    break;

REPLACE WITH:

  case 'remote':
    target.entity_id = entity.startsWith('remote')
      ? updatedElement.entity_id
      : (this.config as IConfig).android_tv_remote_id
        ?? this.config.remote_id;
    break;
*/

// That's it. The rest is handled by the template context which already
// includes the full config object.
