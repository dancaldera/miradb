import type { Instance } from "ink";

let clearFn: (() => void) | null = null;

export const registerInkInstance = (instance: Instance) => {
	clearFn = instance.clear;
};

export const clearInkScreen = () => {
	clearFn?.();
};
