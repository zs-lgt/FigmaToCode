import { StyledTextSegmentSubset } from "types";

export function getStyledTextSegments(node: TextNode): StyledTextSegmentSubset[] {
  // If no text content, return empty array
  if (!node.characters) {
    return [];
  }

  // Create a single segment for the entire text content
  const segment: StyledTextSegmentSubset = {
    characters: node.characters,
    start: 0,
    end: node.characters.length,
    fontSize: node?.fontSize || 0,
    fontName: node.fontName,
    fontWeight: node.fontWeight || 400,
    textDecoration: node.textDecoration || "NONE",
    textCase: node.textCase || "ORIGINAL",
    lineHeight: {
      unit: node.lineHeightUnit || "PIXELS",
      value: node.style?.lineHeightPx || 0
    },
    letterSpacing: {
      unit: "PIXELS",
      value: node.letterSpacing || 0
    },
    fills: node.fills?.map(fill => ({
      type: fill.type,
      visible: fill.visible !== false,
      opacity: fill.opacity !== undefined ? fill.opacity : 1,
      blendMode: fill.blendMode || "NORMAL",
      color: fill.color ? {
        r: fill.color.r,
        g: fill.color.g,
        b: fill.color.b
      } : undefined,
      boundVariables: fill.boundVariables
    })) || [],
    textStyleId: "",
    fillStyleId: "",
    listOptions: {
      type: "NONE"
    },
    indentation: 0,
    hyperlink: null,
    openTypeFeatures: node.opentypeFlags || {
      LIGA: false,
      CLIG: false
    }
  };

  return [segment];
}

// Example usage:
/*
const textNode = {
  characters: "Hello World",
  style: {
    fontFamily: "SF Pro",
    fontPostScriptName: "SFPro-Semibold",
    fontWeight: 590,
    fontSize: 20,
    lineHeightPx: 24,
    lineHeightUnit: "PIXELS",
    letterSpacing: 0,
    opentypeFlags: {
      LNUM: true,
      TNUM: true
    }
  },
  fills: [{
    type: "SOLID",
    visible: true,
    opacity: 1,
    blendMode: "NORMAL",
    color: {
      r: 0,
      g: 0,
      b: 0
    },
    boundVariables: {
      color: {
        type: "VARIABLE_ALIAS",
        id: "VariableID:xxx"
      }
    }
  }]
};

const segments = getStyledTextSegments(textNode);
*/
