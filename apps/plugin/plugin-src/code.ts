import { tailwindCodeGenTextStyles } from "./../../../packages/backend/src/tailwind/tailwindMain";
import {
  run,
  flutterMain,
  tailwindMain,
  swiftuiMain,
  convertIntoNodes,
  htmlMain,
  PluginSettings,
} from "backend";
import { retrieveGenericSolidUIColors } from "backend/src/common/retrieveUI/retrieveColors";
import { flutterCodeGenTextStyles } from "backend/src/flutter/flutterMain";
import { htmlCodeGenTextStyles } from "backend/src/html/htmlMain";
import { swiftUICodeGenTextStyles } from "backend/src/swiftui/swiftuiMain";

let userPluginSettings: PluginSettings;

const defaultPluginSettings: PluginSettings = {
  framework: "HTML",
  jsx: false,
  optimizeLayout: true,
  layerName: false,
  inlineStyle: true,
  responsiveRoot: false,
  flutterGenerationMode: "snippet",
  swiftUIGenerationMode: "snippet",
  roundTailwindValues: false,
  roundTailwindColors: false,
  customTailwindColors: false,
};

// A helper type guard to ensure the key belongs to the PluginSettings type
function isKeyOfPluginSettings(key: string): key is keyof PluginSettings {
  return key in defaultPluginSettings;
}

const getUserSettings = async () => {
  const possiblePluginSrcSettings =
    (await figma.clientStorage.getAsync("userPluginSettings")) ?? {};

  const updatedPluginSrcSettings = {
    ...defaultPluginSettings,
    ...Object.keys(defaultPluginSettings).reduce((validSettings, key) => {
      if (
        isKeyOfPluginSettings(key) &&
        key in possiblePluginSrcSettings &&
        typeof possiblePluginSrcSettings[key] ===
          typeof defaultPluginSettings[key]
      ) {
        validSettings[key] = possiblePluginSrcSettings[key] as any;
      }
      return validSettings;
    }, {} as Partial<PluginSettings>),
  };

  userPluginSettings = updatedPluginSrcSettings as PluginSettings;
};

const initSettings = async () => {
  await getUserSettings();
  figma.ui.postMessage({
    type: "pluginSettingChanged",
    data: userPluginSettings,
  });

  safeRun(userPluginSettings);
};

const safeRun = (settings: PluginSettings) => {
  try {
    run(settings);
  } catch (e) {
    if (e && typeof e === "object" && "message" in e) {
      figma.ui.postMessage({
        type: "error",
        data: e.message,
      });
    }
  }
};

// Types for node creation
interface NodeCreator {
  createNode(data: any): Promise<SceneNode | null>;
  setBaseProperties(node: SceneNode, data: any): void;
  setGeometry(node: SceneNode, data: any, parentBounds?: { x: number, y: number }): { x: number, y: number };
  setAppearance(node: SceneNode, data: any): void;
}

// Base node creator with common functionality
class BaseNodeCreator implements NodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    return null;
  }

  setBaseProperties(node: SceneNode, data: any) {
    if (data.name) node.name = data.name;
    if (data.visible !== undefined) node.visible = data.visible;
    if (data.locked !== undefined) node.locked = data.locked;
    if (data.opacity !== undefined) node.opacity = data.opacity;
  }

  setGeometry(node: SceneNode, data: any, parentBounds?: { x: number, y: number }): { x: number, y: number } {
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;

    // Get absolute bounds
    if (data.absoluteBoundingBox) {
      width = Math.abs(data.absoluteBoundingBox.width || 0);
      height = Math.abs(data.absoluteBoundingBox.height || 0);
      x = data.absoluteBoundingBox.x || 0;
      y = data.absoluteBoundingBox.y || 0;
    } else if (data.size) {
      width = data.size.width || 0;
      height = data.size.height || 0;
      x = data.x || 0;
      y = data.y || 0;
    }

    // Apply size if valid
    if (width > 0 && height > 0) {
      try {
        node.resize(width, height);
      } catch (error) {
        console.warn(`Failed to resize ${node.name}:`, error);
      }
    }

    // Convert absolute coordinates to relative if parent bounds are provided
    if (parentBounds) {
      x = x - parentBounds.x;
      y = y - parentBounds.y;
    }

    // Apply position
    node.x = x;
    node.y = y;

    if (data.rotation) {
      node.rotation = data.rotation;
    }

    // Return the node's bounds for child positioning
    return {
      x: x + (parentBounds?.x || 0),
      y: y + (parentBounds?.y || 0)
    };
  }

  setAppearance(node: SceneNode, data: any) {
    // Set fills
    if ('fills' in node && data.fills) {
      try {
        node.fills = this.processFills(data.fills);
      } catch (error) {
        console.warn(`Failed to set fills for ${node.name}:`, error);
      }
    }

    // Set strokes
    if ('strokes' in node && data.strokes) {
      try {
        node.strokes = this.processStrokes(data.strokes);
        
        // Set stroke properties if available
        if ('strokeWeight' in node && data.strokeWeight !== undefined) {
          node.strokeWeight = data.strokeWeight;
        }
        if ('strokeAlign' in node && data.strokeAlign) {
          node.strokeAlign = data.strokeAlign;
        }
        if ('strokeCap' in node && data.strokeCap) {
          node.strokeCap = data.strokeCap;
        }
        if ('strokeJoin' in node && data.strokeJoin) {
          node.strokeJoin = data.strokeJoin;
        }
        if ('dashPattern' in node && data.strokeDashes) {
          node.dashPattern = data.strokeDashes;
        }
      } catch (error) {
        console.warn(`Failed to set strokes for ${node.name}:`, error);
      }
    }

    // Set effects (shadows, blurs, etc.)
    if ('effects' in node && data.effects) {
      try {
        node.effects = this.processEffects(data.effects);
      } catch (error) {
        console.warn(`Failed to set effects for ${node.name}:`, error);
      }
    }

    // Set blend mode
    if ('blendMode' in node && data.blendMode) {
      try {
        node.blendMode = data.blendMode;
      } catch (error) {
        console.warn(`Failed to set blend mode for ${node.name}:`, error);
      }
    }

    // Set opacity
    if ('opacity' in node && data.opacity !== undefined) {
      node.opacity = data.opacity;
    }

    // Set corner radius for shapes that support it
    if ('cornerRadius' in node) {
      if (data.cornerRadius !== undefined) {
        node.cornerRadius = data.cornerRadius;
      } else if (data.topLeftRadius !== undefined) {
        // Handle individual corner radii
        node.topLeftRadius = data.topLeftRadius;
        node.topRightRadius = data.topRightRadius;
        node.bottomLeftRadius = data.bottomLeftRadius;
        node.bottomRightRadius = data.bottomRightRadius;
      }
    }
  }

  private processFills(fills: any[]): Paint[] {
    return fills.map(fill => {
      switch (fill.type) {
        case 'SOLID':
          return {
            type: 'SOLID',
            color: {
              r: fill.color.r || 0,
              g: fill.color.g || 0,
              b: fill.color.b || 0
            },
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
            blendMode: fill.blendMode || 'NORMAL'
          };

        case 'GRADIENT_LINEAR':
        case 'GRADIENT_RADIAL':
        case 'GRADIENT_ANGULAR':
        case 'GRADIENT_DIAMOND':
          return {
            type: fill.type,
            gradientStops: fill.gradientStops.map((stop: any) => ({
              color: {
                r: stop.color.r || 0,
                g: stop.color.g || 0,
                b: stop.color.b || 0,
                a: stop.color.a || 1
              },
              position: stop.position
            })),
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
            blendMode: fill.blendMode || 'NORMAL',
            gradientTransform: fill.gradientTransform || [[1, 0, 0], [0, 1, 0]]
          };

        case 'IMAGE':
          return {
            type: 'IMAGE',
            imageHash: fill.imageHash || '',
            scaleMode: fill.scaleMode || 'FILL',
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
            blendMode: fill.blendMode || 'NORMAL',
            imageTransform: fill.imageTransform || [[1, 0, 0], [0, 1, 0]]
          };

        default:
          console.warn(`Unknown fill type: ${fill.type}`);
          return fill;
      }
    });
  }

  private processStrokes(strokes: any[]): Paint[] {
    return strokes.map(stroke => {
      switch (stroke.type) {
        case 'SOLID':
          return {
            type: 'SOLID',
            color: {
              r: stroke.color.r || 0,
              g: stroke.color.g || 0,
              b: stroke.color.b || 0
            },
            opacity: stroke.opacity !== undefined ? stroke.opacity : 1,
            blendMode: stroke.blendMode || 'NORMAL'
          };

        case 'GRADIENT_LINEAR':
        case 'GRADIENT_RADIAL':
        case 'GRADIENT_ANGULAR':
        case 'GRADIENT_DIAMOND':
          return {
            type: stroke.type,
            gradientStops: stroke.gradientStops.map((stop: any) => ({
              color: {
                r: stop.color.r || 0,
                g: stop.color.g || 0,
                b: stop.color.b || 0,
                a: stop.color.a || 1
              },
              position: stop.position
            })),
            opacity: stroke.opacity !== undefined ? stroke.opacity : 1,
            blendMode: stroke.blendMode || 'NORMAL',
            gradientTransform: stroke.gradientTransform || [[1, 0, 0], [0, 1, 0]]
          };

        default:
          console.warn(`Unknown stroke type: ${stroke.type}`);
          return stroke;
      }
    });
  }

  private processEffects(effects: any[]): Effect[] {
    return effects.map(effect => {
      switch (effect.type) {
        case 'DROP_SHADOW':
        case 'INNER_SHADOW':
          return {
            type: effect.type,
            color: {
              r: effect.color.r || 0,
              g: effect.color.g || 0,
              b: effect.color.b || 0,
              a: effect.color.a || 1
            },
            offset: {
              x: effect.offset.x || 0,
              y: effect.offset.y || 0
            },
            radius: effect.radius || 0,
            spread: effect.spread || 0,
            visible: effect.visible !== undefined ? effect.visible : true,
            blendMode: effect.blendMode || 'NORMAL'
          };

        case 'LAYER_BLUR':
        case 'BACKGROUND_BLUR':
          return {
            type: effect.type,
            radius: effect.radius || 0,
            visible: effect.visible !== undefined ? effect.visible : true
          };

        default:
          console.warn(`Unknown effect type: ${effect.type}`);
          return effect;
      }
    });
  }
}

// Helper function to convert font weight to style
function getFontStyle(weight: number): string {
  if (weight <= 100) return "Thin";
  if (weight <= 200) return "ExtraLight";
  if (weight <= 300) return "Light";
  if (weight <= 400) return "Regular";
  if (weight <= 500) return "Medium";
  if (weight <= 600) return "SemiBold";
  if (weight <= 700) return "Bold";
  if (weight <= 800) return "ExtraBold";
  return "Black";
}

// 文本节点
class TextNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createText();
    this.setBaseProperties(node, data);
    
    try {
      // 加载字体
      await this.loadFont(data);
      
      // 写入文本
      if (data.characters) {
        node.characters = data.characters;
      }
      
      // 导入文本样式
      await this.applyTextStyles(node, data);
      
      // 导入背景、边框等容器样式
      this.setAppearance(node, data);
      
      return node;
    } catch (error) {
      console.error('Error creating text node:', error);
      return node;
    }
  }

  private async loadFont(data: any): Promise<void> {
    try {
      let fontName: FontName;

      // Try to get font from style or direct properties
      if (data.style?.fontName) {
        fontName = data.style.fontName;
      } else if (data.fontName) {
        fontName = data.fontName;
      } else {
        // Default font
        fontName = { family: "Inter", style: "Regular" };
      }

      await figma.loadFontAsync(fontName);
    } catch (error) {
      console.warn('Failed to load specified font, falling back to Inter:', error);
      // Fallback to Inter
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    }
  }

  private async applyTextStyles(node: TextNode, data: any): Promise<void> {
    try {
      // Get style object combining direct properties and style object
      const style = { ...data.style, ...data };

      // Font properties
      if (style.fontName) {
        node.fontName = style.fontName;
      }

      if (style.fontSize) {
        node.fontSize = style.fontSize;
      }

      // Text alignment
      if (style.textAlignHorizontal) {
        node.textAlignHorizontal = style.textAlignHorizontal;
      }

      if (style.textAlignVertical) {
        node.textAlignVertical = style.textAlignVertical;
      }

      // Line height
      if (style.lineHeight) {
        if (typeof style.lineHeight === 'object') {
          node.lineHeight = style.lineHeight;
        } else {
          node.lineHeight = { value: style.lineHeight, unit: 'PIXELS' };
        }
      }

      // Letter spacing
      if (style.letterSpacing) {
        if (typeof style.letterSpacing === 'object') {
          node.letterSpacing = style.letterSpacing;
        } else {
          node.letterSpacing = { value: style.letterSpacing, unit: 'PIXELS' };
        }
      }

      // Text case
      if (style.textCase) {
        node.textCase = style.textCase;
      }

      // Text decoration
      if (style.textDecoration) {
        node.textDecoration = style.textDecoration;
      }

      // Paragraph spacing
      if (style.paragraphSpacing) {
        node.paragraphSpacing = style.paragraphSpacing;
      }

      // Paragraph indent
      if (style.paragraphIndent) {
        node.paragraphIndent = style.paragraphIndent;
      }

      // Text auto resize
      if (style.textAutoResize) {
        node.textAutoResize = style.textAutoResize;
      }

      // Font features
      if (style.fontFeatures) {
        for (const [feature, value] of Object.entries(style.fontFeatures)) {
          try {
            // @ts-ignore: Figma's type definitions might not include all font features
            node.setFontFeatures([[feature, value]]);
          } catch (error) {
            console.warn(`Failed to set font feature ${feature}:`, error);
          }
        }
      }

      // OpenType features
      if (style.openTypeFeatures) {
        for (const [feature, value] of Object.entries(style.openTypeFeatures)) {
          try {
            // @ts-ignore: Figma's type definitions might not include all OpenType features
            node.setOpenTypeFeatures([[feature, value]]);
          } catch (error) {
            console.warn(`Failed to set OpenType feature ${feature}:`, error);
          }
        }
      }

      // Text style variants
      if (style.textStyleId) {
        try {
          node.textStyleId = style.textStyleId;
        } catch (error) {
          console.warn('Failed to apply text style:', error);
        }
      }

      // Hyperlink
      if (style.hyperlink) {
        try {
          node.hyperlink = style.hyperlink;
        } catch (error) {
          console.warn('Failed to set hyperlink:', error);
        }
      }

      // Mixed styles
      if (style.textSegments) {
        try {
          // Store original text
          const fullText = node.characters;
          
          // Clear existing text
          node.characters = '';
          
          // Apply segments
          for (const segment of style.textSegments) {
            const start = node.characters.length;
            node.insertCharacters(start, segment.characters);
            
            // Apply segment-specific styles
            if (segment.fontSize) {
              node.setRangeFontSize(start, start + segment.characters.length, segment.fontSize);
            }
            if (segment.fontName) {
              await figma.loadFontAsync(segment.fontName);
              node.setRangeFontName(start, start + segment.characters.length, segment.fontName);
            }
            if (segment.fills) {
              node.setRangeFills(start, start + segment.characters.length, this.processFills(segment.fills));
            }
            if (segment.textDecoration) {
              node.setRangeTextDecoration(start, start + segment.characters.length, segment.textDecoration);
            }
            if (segment.textCase) {
              node.setRangeTextCase(start, start + segment.characters.length, segment.textCase);
            }
            if (segment.letterSpacing) {
              node.setRangeLetterSpacing(start, start + segment.characters.length, segment.letterSpacing);
            }
            if (segment.lineHeight) {
              node.setRangeLineHeight(start, start + segment.characters.length, segment.lineHeight);
            }
            if (segment.hyperlink) {
              node.setRangeHyperlink(start, start + segment.characters.length, segment.hyperlink);
            }
          }
        } catch (error) {
          console.warn('Failed to apply text segments:', error);
          // Fallback to simple text
          node.characters = data.characters || '';
        }
      }

    } catch (error) {
      console.error('Error applying text styles:', error);
    }
  }
}

// Document node creator
class DocumentNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createFrame();
    this.setBaseProperties(node, data);
    
    // Document should not have fills
    node.fills = [];
    
    // Set a large size initially - will be adjusted based on children
    node.resize(3000, 2000);
    
    return node;
  }
}

// Canvas node creator
class CanvasNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createFrame();
    this.setBaseProperties(node, data);
    
    // Canvas should not have fills
    node.fills = [];
    node.layoutMode = "NONE";
    
    return node;
  }
}

// Frame node creator
class FrameNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createFrame();
    
    // Set base properties
    this.setBaseProperties(node, data);
    
    // Set layout properties
    if (data.layoutMode) {
      node.layoutMode = data.layoutMode;
      if (data.primaryAxisSizingMode) node.primaryAxisSizingMode = data.primaryAxisSizingMode;
      if (data.counterAxisSizingMode) node.counterAxisSizingMode = data.counterAxisSizingMode;
      if (data.primaryAxisAlignItems) node.primaryAxisAlignItems = data.primaryAxisAlignItems;
      if (data.counterAxisAlignItems) node.counterAxisAlignItems = data.counterAxisAlignItems;
      if (data.itemSpacing !== undefined) node.itemSpacing = data.itemSpacing;
    }

    // Set padding
    if (data.paddingLeft !== undefined) node.paddingLeft = data.paddingLeft;
    if (data.paddingRight !== undefined) node.paddingRight = data.paddingRight;
    if (data.paddingTop !== undefined) node.paddingTop = data.paddingTop;
    if (data.paddingBottom !== undefined) node.paddingBottom = data.paddingBottom;

    // Set clipsContent
    if (data.clipsContent !== undefined) {
      node.clipsContent = data.clipsContent;
    }

    // Set appearance
    this.setAppearance(node, data);
    
    return node;
  }
}

// Rectangle node creator
class RectangleNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createRectangle();
    
    this.setBaseProperties(node, data);
    
    // Set corner radius
    if (data.cornerRadius !== undefined) {
      node.cornerRadius = data.cornerRadius;
    }
    
    this.setAppearance(node, data);
    
    return node;
  }
}

// Group node creator
class GroupNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    // Create a temporary frame that will be converted to group after children are added
    const node = figma.createFrame();
    this.setBaseProperties(node, data);
    
    // Groups don't have fills
    node.fills = [];
    
    return node;
  }
}

// Component node creator
class ComponentNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createComponent();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Instance node creator
class InstanceNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    // Since we can't create instances without main components,
    // create a frame as a placeholder
    const node = figma.createFrame();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Vector node creator
class VectorNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createVector();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Boolean operation node creator
class BooleanOperationNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createBooleanOperation();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Ellipse node creator
class EllipseNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createEllipse();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Factory for creating nodes
class NodeFactory {
  private creators: Map<string, NodeCreator>;

  constructor() {
    this.creators = new Map();
    this.creators.set('DOCUMENT', new DocumentNodeCreator());
    this.creators.set('CANVAS', new CanvasNodeCreator());
    this.creators.set('FRAME', new FrameNodeCreator());
    this.creators.set('RECTANGLE', new RectangleNodeCreator());
    this.creators.set('TEXT', new TextNodeCreator());
    this.creators.set('GROUP', new GroupNodeCreator());
    this.creators.set('COMPONENT', new ComponentNodeCreator());
    this.creators.set('INSTANCE', new InstanceNodeCreator());
    this.creators.set('VECTOR', new VectorNodeCreator());
    this.creators.set('BOOLEAN_OPERATION', new BooleanOperationNodeCreator());
    this.creators.set('ELLIPSE', new EllipseNodeCreator());
  }

  async createNode(type: string, data: any): Promise<SceneNode | null> {
    const creator = this.creators.get(type);
    if (!creator) {
      console.warn(`No creator found for node type: ${type}`);
      return null;
    }
    return creator.createNode(data);
  }
}

// Main function to import nodes
async function importNode(data: any, parent: BaseNode & ChildrenMixin, parentBounds?: { x: number, y: number }): Promise<SceneNode | null> {
  try {
    const factory = new NodeFactory();
    const node = await factory.createNode(data.type, data);
    
    if (!node) {
      console.warn(`Failed to create node of type: ${data.type}`);
      return null;
    }

    // Add to parent
    if (parent) {
      parent.appendChild(node);
    }

    // Set geometry and get new bounds for children
    const creator = new BaseNodeCreator();
    const nodeBounds = creator.setGeometry(node, data, parentBounds);

    // Process children
    if (data.children && 'appendChild' in node && data.type !== 'TEXT') {
      for (const childData of data.children) {
        await importNode(childData, node as BaseNode & ChildrenMixin, nodeBounds);
      }
    }

    // Convert frame to group if needed
    if (data.type === 'GROUP' && node.type === 'FRAME') {
      try {
        const children = [...node.children];
        if (children.length > 0) {
          const group = figma.group(children, parent);
          // Copy over properties that groups can have
          group.name = node.name;
          group.opacity = node.opacity;
          group.visible = node.visible;
          group.locked = node.locked;
          group.rotation = node.rotation;
          group.x = node.x;
          group.y = node.y;
          
          node.remove();
          return group;
        }
      } catch (error) {
        console.warn(`Error converting frame to group: ${error}`);
      }
    }

    return node;
  } catch (error) {
    console.error('Error importing node:', error);
    return null;
  }
}

// Entry point for importing Figma JSON
async function importFigmaJSON(jsonData: any): Promise<void> {
  try {
    // Create a container frame for the imported content
    const containerFrame = figma.createFrame();
    containerFrame.name = jsonData.name || 'Imported Design';
    
    // Set initial size - will be adjusted based on content
    containerFrame.resize(3000, 2000);
    containerFrame.fills = [];
    
    // Add to current page
    figma.currentPage.appendChild(containerFrame);
    
    // Initial bounds for the container
    const containerBounds = { x: 0, y: 0 };
    
    if (jsonData.document) {
      await importNode(jsonData.document, containerFrame, containerBounds);
    } else if (Array.isArray(jsonData)) {
      for (const nodeData of jsonData) {
        await importNode(nodeData, containerFrame, containerBounds);
      }
    } else {
      await importNode(jsonData, containerFrame, containerBounds);
    }

    // Select and zoom to the imported content
    figma.currentPage.selection = [containerFrame];
    figma.viewport.scrollAndZoomIntoView([containerFrame]);
    
  } catch (error) {
    console.error('Error importing Figma JSON:', error);
    throw error;
  }
}

const standardMode = async () => {
  figma.showUI(__html__, { 
    width: 675, 
    height: 825, 
    themeColors: true,
  });
  await initSettings();
  figma.on("selectionchange", () => {
    safeRun(userPluginSettings);
  });
  figma.ui.on('message', (msg) => {
    if (msg.type === "pluginSettingChanged") {
      (userPluginSettings as any)[msg.key] = msg.value;
      figma.clientStorage.setAsync("userPluginSettings", userPluginSettings);
      safeRun(userPluginSettings);
    } else if (msg.type === "delete-node") {
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        selection.forEach(node => node.remove());
        safeRun(userPluginSettings);
      }
    } else if (msg.type === "duplicate-node") {
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        selection.forEach(node => {
          const clone = node.clone();
          node.parent?.appendChild(clone);
        });
        safeRun(userPluginSettings);
      }
    } else if (msg.type === "fetch-figma-file") {
      const fileId = figma.fileKey;
      const accessToken = figma.clientStorage.getAsync('figmaAccessToken');
      
      if (!accessToken) {
        figma.ui.postMessage({
          type: "error",
          data: "请先设置Figma访问令牌",
        });
        return;
      }

      fetch(`https://api.figma.com/v1/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      .then(response => response.json())
      .then(data => {
        // 处理文件数据
        const processedData = {
          name: data.name,
          lastModified: data.lastModified,
          version: data.version,
          document: data.document,
        };
        
        // 发送处理后的数据到UI
        figma.ui.postMessage({
          type: "figma-file-data",
          data: processedData,
        });
      })
      .catch(error => {
        figma.ui.postMessage({
          type: "error",
          data: `获取Figma文件数据失败: ${error.message}`,
        });
      });
    } else if (msg.type === "import-figma-json") {
      const data = msg.data;
      if (!data) {
        throw new Error('No data provided');
      }

      importFigmaJSON(data).then(() => {
        // 发送成功消息
        figma.ui.postMessage({
          type: "success",
          data: "Figma文件导入成功",
        });
      }).catch((error) => {
        console.error('Error importing Figma JSON:', error);
        figma.ui.postMessage({
          type: "error",
          data: `导入Figma文件失败: ${error.message}`,
        });
      });
    }
    if (msg.type === 'resize') {
      figma.ui.resize(msg.width, msg.height);
    }
  });
};

const codegenMode = async () => {
  // figma.showUI(__html__, { visible: false });
  await getUserSettings();

  figma.codegen.on("generate", ({ language, node }) => {
    const convertedSelection = convertIntoNodes([node], null);

    switch (language) {
      case "html":
        return [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: false },
              true
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(false),
            language: "HTML",
          },
        ];
      case "html_jsx":
        return [
          {
            title: `Code`,
            code: htmlMain(
              convertedSelection,
              { ...userPluginSettings, jsx: true },
              true
            ),
            language: "HTML",
          },
          {
            title: `Text Styles`,
            code: htmlCodeGenTextStyles(true),
            language: "HTML",
          },
        ];
      case "tailwind":
      case "tailwind_jsx":
        return [
          {
            title: `Code`,
            code: tailwindMain(convertedSelection, {
              ...userPluginSettings,
              jsx: language === 'tailwind_jsx',
            }),
            language: "HTML",
          },
          // {
          //   title: `Style`,
          //   code: tailwindMain(convertedSelection, defaultPluginSettings),
          //   language: "HTML",
          // },
          {
            title: `Tailwind Colors`,
            code: retrieveGenericSolidUIColors("Tailwind")
              .map((d) => {
                let str = `${d.hex};`
                if (d.colorName !== d.hex) {
                  str += ` // ${d.colorName}`
                }
                if (d.meta) {
                  str += ` (${d.meta})`
                }
                return str;
              })
              .join("\n"),
            language: "JAVASCRIPT",
          },
          {
            title: `Text Styles`,
            code: tailwindCodeGenTextStyles(),
            language: "HTML",
          },
        ];
      case "flutter":
        return [
          {
            title: `Code`,
            code: flutterMain(convertedSelection, {
              ...userPluginSettings,
              flutterGenerationMode: "snippet",
            }),
            language: "SWIFT",
          },
          {
            title: `Text Styles`,
            code: flutterCodeGenTextStyles(),
            language: "SWIFT",
          },
        ];
      case "swiftUI":
        return [
          {
            title: `SwiftUI`,
            code: swiftuiMain(convertedSelection, {
              ...userPluginSettings,
              swiftUIGenerationMode: "snippet",
            }),
            language: "SWIFT",
          },
          {
            title: `Text Styles`,
            code: swiftUICodeGenTextStyles(),
            language: "SWIFT",
          },
        ];
      default:
        break;
    }

    const blocks: CodegenResult[] = [];
    return blocks;
  });
};

switch (figma.mode) {
  case "default":
  case "inspect":
    standardMode();
    break;
  case "codegen":
    codegenMode();
    break;
  default:
    break;
}
