// Types for node creation
export interface NodeCreator {
  createNode(data: any): Promise<SceneNode | null>;
  setBaseProperties(node: SceneNode, data: any): void;
  setGeometry(node: SceneNode, data: any, parentBounds?: { x: number, y: number }): { x: number, y: number };
  setAppearance(node: SceneNode, data: any): void;
}

// Base node creator with common functionality
export class BaseNodeCreator implements NodeCreator {
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
      if (node.type === 'RECTANGLE') {
        console.log('aaaa', node.name, data);
      }
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