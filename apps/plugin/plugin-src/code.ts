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
let isCodeGenerationEnabled = true;  // 添加代码生成状态控制

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
    let width = 100;
    let height = 100;
    let x = 0;
    let y = 0;

    // Get absolute bounds
    if (data.absoluteBoundingBox) {
      width = Math.max(1, Math.abs(data.absoluteBoundingBox.width || 0));
      height = Math.max(1, Math.abs(data.absoluteBoundingBox.height || 0));
      x = data.absoluteBoundingBox.x || 0;
      y = data.absoluteBoundingBox.y || 0;
    } else if (data.relativeTransform) {
      // 使用相对变换矩阵计算位置
      x = data.relativeTransform[0][2];
      y = data.relativeTransform[1][2];
      width = Math.max(1, Math.abs(data.size?.width || data.width || width));
      height = Math.max(1, Math.abs(data.size?.height || data.height || height));
    } else {
      // Fallback to individual properties
      width = Math.max(1, Math.abs(data.size?.width || data.width || width));
      height = Math.max(1, Math.abs(data.size?.height || data.height || height));
      x = data.x || 0;
      y = data.y || 0;
    }

    // Apply size if supported
    if ('resize' in node) {
      try {
        node.resize(width, height);
      } catch (error) {
        console.warn(`Failed to resize ${node.name}:`, error);
      }
    }

    // Convert absolute coordinates to relative if parent bounds are provided
    if (parentBounds) {
      // 如果是 instance 节点，使用相对变换矩阵中的位置
      if (data.type === 'INSTANCE' && data.relativeTransform) {
        x = data.relativeTransform[0][2];
        y = data.relativeTransform[1][2];
      } else {
        x = x - parentBounds.x;
        y = y - parentBounds.y;
      }
    }

    // Apply position if supported
    if ('x' in node) node.x = x;
    if ('y' in node) node.y = y;

    return { x, y };
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
      const loadedFont = await this.loadFont(data);
      
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

  private async loadFont(data: any): Promise<FontName> {
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

      // Get available fonts
      const availableFonts = await figma.listAvailableFontsAsync();
      
      // Try to find exact match first
      let matchedFont = availableFonts.find(font => 
        font.fontName.family === fontName.family && 
        font.fontName.style === fontName.style
      );

      // If no exact match, try to find a similar font
      if (!matchedFont && fontName.family.includes("SF Pro")) {
        // Try variations of SF Pro font names
        const sfProVariants = ["SF Pro", "SF Pro Text", "SF Pro Display"];
        for (const variant of sfProVariants) {
          matchedFont = availableFonts.find(font =>
            font.fontName.family === variant &&
            font.fontName.style === fontName.style
          );
          if (matchedFont) break;
        }

        // If still no match, try to match style
        if (!matchedFont) {
          // Map common style names
          const styleMap: { [key: string]: string[] } = {
            "Semibold": ["SemiBold", "Semi Bold", "Medium"],
            "Medium": ["Medium", "Regular"],
            "Bold": ["Bold", "Heavy"],
            "Regular": ["Regular", "Normal"]
          };

          const targetStyle = fontName.style;
          const alternativeStyles = styleMap[targetStyle] || [targetStyle];

          for (const variant of sfProVariants) {
            for (const style of alternativeStyles) {
              matchedFont = availableFonts.find(font =>
                font.fontName.family === variant &&
                font.fontName.style === style
              );
              if (matchedFont) break;
            }
            if (matchedFont) break;
          }
        }
      }

      // If we found a matching font, try to load it
      if (matchedFont) {
        try {
          await figma.loadFontAsync(matchedFont.fontName);
          console.log(`Successfully loaded font: ${matchedFont.fontName.family} ${matchedFont.fontName.style}`);
          return matchedFont.fontName;
        } catch (error) {
          console.warn(`Failed to load matched font ${matchedFont.fontName.family} ${matchedFont.fontName.style}, falling back to Inter:`, error);
        }
      } else {
        console.warn(`No matching font found for ${fontName.family} ${fontName.style}, falling back to Inter`);
      }

      // Fallback to Inter
      const fallbackFont = { family: "Inter", style: "Regular" };
      await figma.loadFontAsync(fallbackFont);
      return fallbackFont;

    } catch (error) {
      console.warn('Font loading error, falling back to Inter:', error);
      const fallbackFont = { family: "Inter", style: "Regular" };
      await figma.loadFontAsync(fallbackFont);
      return fallbackFont;
    }
  }

  async applyTextStyles(node: TextNode, data: any) {
    try {
      // Get style object combining direct properties and style object
      const style = { ...data.style, ...data };

      // Load and set font first
      if (style.fontName) {
        const loadedFont = await this.loadFont({ fontName: style.fontName });
        node.fontName = loadedFont;
      }

      // Set text auto resize first to ensure proper width calculation
      if (style.textAutoResize) {
        node.textAutoResize = style.textAutoResize;
      } else {
        // Default to WIDTH_AND_HEIGHT for title-like text
        node.textAutoResize = "WIDTH_AND_HEIGHT";
      }

      // Apply text segments if available
      if (style.textSegments && Array.isArray(style.textSegments)) {
        try {
          // Clear existing text
          node.characters = '';
          
          // Apply segments
          for (const segment of style.textSegments) {
            const start = node.characters.length;
            
            // Load font before applying text
            if (segment.fontName) {
              const loadedFont = await this.loadFont({ fontName: segment.fontName });
              segment.fontName = loadedFont;
            }
            
            // Insert text
            node.insertCharacters(start, segment.characters);
            
            // Apply segment-specific styles
            if (segment.fontSize) {
              node.setRangeFontSize(start, start + segment.characters.length, segment.fontSize);
            }
            if (segment.fontName) {
              node.setRangeFontName(start, start + segment.characters.length, segment.fontName);
            }
            if (segment.fills) {
              node.setRangeFills(start, start + segment.characters.length, this.processFills(segment.fills));
            }
            if (segment.textDecoration) {
              node.setRangeTextDecoration(start, start + segment.characters.length, segment.textDecoration);
            }
            if (segment.letterSpacing) {
              node.setRangeLetterSpacing(start, start + segment.characters.length, segment.letterSpacing);
            }
            if (segment.lineHeight) {
              node.setRangeLineHeight(start, start + segment.characters.length, segment.lineHeight);
            }
            if (segment.textCase) {
              node.setRangeTextCase(start, start + segment.characters.length, segment.textCase);
            }
          }
        } catch (error) {
          console.warn('Failed to apply text segments:', error);
          // Fallback to simple text
          node.characters = data.characters || '';
        }
      }

      // Apply other text styles
      if (style.fontSize) node.fontSize = style.fontSize;
      if (style.textAlignHorizontal) node.textAlignHorizontal = style.textAlignHorizontal;
      if (style.textAlignVertical) node.textAlignVertical = style.textAlignVertical;
      if (style.textCase) node.textCase = style.textCase;
      if (style.textDecoration) node.textDecoration = style.textDecoration;
      if (style.letterSpacing) node.letterSpacing = style.letterSpacing;
      if (style.lineHeight) node.lineHeight = style.lineHeight;
      if (style.paragraphIndent) node.paragraphIndent = style.paragraphIndent;
      if (style.paragraphSpacing) node.paragraphSpacing = style.paragraphSpacing;

      // Ensure constraints are set for auto-width
      if (node.textAutoResize === "WIDTH_AND_HEIGHT") {
        node.constraints = {
          horizontal: "MIN",
          vertical: "MIN"
        };
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

    // 设置特殊的布局属性
    if (data.layoutMode) {
      node.layoutMode = data.layoutMode;
      if (data.primaryAxisSizingMode) node.primaryAxisSizingMode = data.primaryAxisSizingMode;
      if (data.counterAxisSizingMode) node.counterAxisSizingMode = data.counterAxisSizingMode;
      if (data.primaryAxisAlignItems) node.primaryAxisAlignItems = data.primaryAxisAlignItems;
      if (data.counterAxisAlignItems) node.counterAxisAlignItems = data.counterAxisAlignItems;
      if (data.paddingLeft) node.paddingLeft = data.paddingLeft;
      if (data.paddingRight) node.paddingRight = data.paddingRight;
      if (data.paddingTop) node.paddingTop = data.paddingTop;
      if (data.paddingBottom) node.paddingBottom = data.paddingBottom;
      if (data.itemSpacing) node.itemSpacing = data.itemSpacing;
    }

    // 设置变换属性
    if (data.relativeTransform) {
      // 从变换矩阵中提取位置和旋转信息
      const [a, b, x] = data.relativeTransform[0];
      const [c, d, y] = data.relativeTransform[1];
      
      // 设置位置
      node.x = x;
      node.y = y;
      
      // 计算并设置旋转角度
      if (a !== 1 || b !== 0 || c !== 0 || d !== 1) {
        const rotation = Math.atan2(b, a) * (180 / Math.PI);
        node.rotation = rotation;
      }
    }

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
      // 如果是 instance 节点，使用其自身的位置作为子节点的参考点
      const childParentBounds = data.type === 'INSTANCE' ? {
        x: data.relativeTransform ? data.relativeTransform[0][2] : 0,
        y: data.relativeTransform ? data.relativeTransform[1][2] : 0
      } : nodeBounds;

      for (const childData of data.children) {
        await importNode(childData, node as BaseNode & ChildrenMixin, childParentBounds);
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
    // Get the actual content to import (skip document and canvas layers)
    let contentToImport: any[] = [];
    
    if (jsonData.document?.children) {
      // If we have a document, look for actual content in its children
      for (const child of jsonData.document.children) {
        if (child.type === 'CANVAS' && child.children) {
          // If it's a canvas, add its children
          contentToImport.push(...child.children);
        } else {
          // If it's not a canvas, add it directly
          contentToImport.push(child);
        }
      }
    } else if (Array.isArray(jsonData)) {
      contentToImport = jsonData;
    } else {
      contentToImport = [jsonData];
    }

    // Create a container frame for the imported content
    const containerFrame = figma.createFrame();
    containerFrame.name = jsonData.name || 'Imported Design';
    
    // Find the bounds of the content
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Helper function to update bounds from absoluteBoundingBox
    const updateBounds = (box: any) => {
      if (box) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + (box.width || 0));
        maxY = Math.max(maxY, box.y + (box.height || 0));
      }
    };

    // Helper function to recursively find bounds
    const findBounds = (node: any) => {
      if (node.absoluteBoundingBox) {
        updateBounds(node.absoluteBoundingBox);
      }
      if (node.children) {
        node.children.forEach(findBounds);
      }
    };

    // Find bounds in the content
    contentToImport.forEach(findBounds);

    // If no bounds found, use default size
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 3000;
      maxY = 2000;
    }

    // Add padding
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Set container frame size and position
    containerFrame.resize(maxX - minX, maxY - minY);
    containerFrame.x = minX;
    containerFrame.y = minY;
    containerFrame.fills = [];
    
    // Add to current page
    figma.currentPage.appendChild(containerFrame);
    
    // Initial bounds for the container
    const containerBounds = { x: minX, y: minY };
    
    // Import all content
    for (const nodeData of contentToImport) {
      await importNode(nodeData, containerFrame, containerBounds);
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

  // 从本地存储获取代码生成状态
  const savedCodeGenState = await figma.clientStorage.getAsync('codeGenerationEnabled');
  if (savedCodeGenState !== undefined) {
    isCodeGenerationEnabled = savedCodeGenState;
  }

  // 初始化时发送状态到UI
  figma.ui.postMessage({
    type: "code-gen-state",
    enabled: isCodeGenerationEnabled
  });

  figma.on("selectionchange", () => {
    if (isCodeGenerationEnabled) {
      safeRun(userPluginSettings);
    }
  });

  figma.ui.on('message', (msg) => {
    if (msg.type === "get-code-gen-state") {
      figma.ui.postMessage({
        type: "code-gen-state",
        enabled: isCodeGenerationEnabled
      });
    } else if (msg.type === "toggle-code-generation") {
      isCodeGenerationEnabled = msg.enabled;
      // 保存状态到本地存储
      figma.clientStorage.setAsync('codeGenerationEnabled', isCodeGenerationEnabled);
      if (!isCodeGenerationEnabled) {
        // 清空当前代码
        figma.ui.postMessage({
          type: "update-code",
          code: "",
        });
      } else {
        // 重新生成代码
        safeRun(userPluginSettings);
      }
    } else if (msg.type === "pluginSettingChanged") {
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
