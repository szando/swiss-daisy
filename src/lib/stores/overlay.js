// src/lib/stores/overlay.js
import { writable } from 'svelte/store';

/** @typedef {{ id:string, start:number, end:number, text:string, glossDe?:string, glossEn?:string }} Fragment */

export const currentFragment = writable(/** @type {Fragment|null} */ (null));
export const audioElement = writable(/** @type {HTMLAudioElement|null} */ (null));
