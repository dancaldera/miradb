import { createInterface } from "node:readline";

export const createReadlineInterface = () => {
	return createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "> ",
	});
};
