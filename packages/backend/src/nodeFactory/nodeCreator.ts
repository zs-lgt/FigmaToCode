import { BaseNodeCreator } from "./baseNodeCreator";
// 文本节点
export class TextNodeCreator extends BaseNodeCreator {
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
export class DocumentNodeCreator extends BaseNodeCreator {
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
export class CanvasNodeCreator extends BaseNodeCreator {
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
export class FrameNodeCreator extends BaseNodeCreator {
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
export class RectangleNodeCreator extends BaseNodeCreator {
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
export class GroupNodeCreator extends BaseNodeCreator {
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
export class ComponentNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createComponent();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Instance node creator
export class InstanceNodeCreator extends BaseNodeCreator {
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
export class VectorNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createVector();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Boolean operation node creator
export class BooleanOperationNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createBooleanOperation();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}

// Ellipse node creator
export class EllipseNodeCreator extends BaseNodeCreator {
  async createNode(data: any): Promise<SceneNode | null> {
    const node = figma.createEllipse();
    this.setBaseProperties(node, data);
    this.setAppearance(node, data);
    return node;
  }
}