// Set up Obsidian globals for the jest/jsdom test environment
global.activeWindow = global.window || global;
global.activeDocument = global.document;
