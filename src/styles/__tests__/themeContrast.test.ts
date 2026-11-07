import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rgb = { r: number; g: number; b: number; a: number };

const stylesheet = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

function extractBlock(selector: string): string {
    const selectorIndex = stylesheet.indexOf(selector);
    if (selectorIndex < 0) throw new Error(`Missing CSS selector: ${selector}`);
    const openBrace = stylesheet.indexOf("{", selectorIndex);
    const closeBrace = stylesheet.indexOf("\n}", openBrace);
    if (openBrace < 0 || closeBrace < 0) throw new Error(`Unclosed CSS block: ${selector}`);
    return stylesheet.slice(openBrace + 1, closeBrace);
}

const themeBlocks = {
    dark: extractBlock(":root {"),
    light: extractBlock(".theme-light {"),
};

function getToken(block: string, token: string): string {
    const match = block.match(new RegExp(`${token}:\\s*([^;]+);`));
    if (!match) throw new Error(`Missing CSS token: ${token}`);
    return match[1].trim();
}

function parseColor(value: string): Rgb {
    const hex = value.match(/^#([\da-f]{6})$/i)?.[1];
    if (hex) {
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: 1,
        };
    }

    const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (rgb) {
        return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] ? Number(rgb[4]) : 1 };
    }
    throw new Error(`Unsupported color in contrast check: ${value}`);
}

function composite(foreground: Rgb, background: Rgb): Rgb {
    return {
        r: foreground.r * foreground.a + background.r * (1 - foreground.a),
        g: foreground.g * foreground.a + background.g * (1 - foreground.a),
        b: foreground.b * foreground.a + background.b * (1 - foreground.a),
        a: 1,
    };
}

function relativeLuminance(color: Rgb): number {
    const linear = [color.r, color.g, color.b].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: Rgb, second: Rgb): number {
    const firstLuminance = relativeLuminance(first);
    const secondLuminance = relativeLuminance(second);
    return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("semantic theme contrast", () => {
    for (const [themeName, block] of Object.entries(themeBlocks)) {
        const canvas = parseColor(getToken(block, "--wf-bg-app"));
        const panel = composite(parseColor(getToken(block, "--wf-surface-1")), canvas);

        it(`${themeName} primary and muted text meet WCAG AA on the canvas and panel`, () => {
            for (const token of [
                "--wf-text-strong",
                "--wf-text",
                "--wf-text-muted",
                "--wf-text-dim",
                "--wf-accent-text",
                "--wf-accent-primary",
                "--wf-success",
                "--wf-warning",
                "--wf-danger",
                "--wf-info",
            ]) {
                const foreground = parseColor(getToken(block, token));
                expect(contrastRatio(foreground, canvas), `${themeName} ${token} on canvas`).toBeGreaterThanOrEqual(4.5);
                expect(contrastRatio(foreground, panel), `${themeName} ${token} on panel`).toBeGreaterThanOrEqual(4.5);
            }
        });

        it(`${themeName} focus and input borders remain visible`, () => {
            const focusRing = parseColor(getToken(block, "--wf-focus-ring"));
            const input = composite(parseColor(getToken(block, "--wf-surface-input")), canvas);
            const inputBorder = composite(parseColor(getToken(block, "--wf-border-input")), input);
            expect(contrastRatio(focusRing, canvas), `${themeName} focus ring`).toBeGreaterThanOrEqual(3);
            expect(contrastRatio(inputBorder, input), `${themeName} input border`).toBeGreaterThanOrEqual(3);
        });

        it(`${themeName} selected text remains readable on selected surfaces`, () => {
            const selectionSurface = composite(parseColor(getToken(block, "--wf-selection")), panel);
            const selectionText = parseColor(getToken(block, "--wf-selection-text"));
            expect(contrastRatio(selectionText, selectionSurface), `${themeName} selection`).toBeGreaterThanOrEqual(4.5);
        });
    }

    it("remaps pale legacy accent text to readable light-theme colors", () => {
        const white = { r: 255, g: 255, b: 255, a: 1 };
        const mappings = [
            ["text-sky-100", "#0c4a6e"],
            ["text-sky-200", "#075985"],
            ["text-yellow-100", "#78350f"],
            ["text-yellow-200", "#854d0e"],
            ["text-yellow-300", "#a16207"],
            ["text-yellow-400", "#a16207"],
            ["text-lime-300", "#3f6212"],
            ["text-rose-100", "#9f1239"],
            ["text-violet-400", "#6d28d9"],
        ] as const;

        for (const [utility, color] of mappings) {
            expect(stylesheet).toContain(`.theme-light [class*="${utility}"] { color: ${color} !important; }`);
            expect(contrastRatio(parseColor(color), white), `${utility} on light canvas`).toBeGreaterThanOrEqual(4.5);
        }
    });
});
