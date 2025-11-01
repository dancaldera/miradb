#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { App } from "./App.js";
import { registerInkInstance } from "./inkControl.js";

const inkInstance = render(<App />);
registerInkInstance(inkInstance);
