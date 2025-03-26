import { PluginState } from '../core/state';
import { EventManager } from '../core/events';
import { SOURCE_ANNOTATION } from "../core/constants";

export abstract class BaseAnnotation {
  protected state: PluginState;
  protected eventManager: EventManager;

  constructor() {
    this.state = PluginState.getInstance();
    this.eventManager = EventManager.getInstance();
  }

  // 初始化标注计数器
  protected async initAnnotationCounter(): Promise<void> {
    try {
      let maxNumber = 0;

      // 使用缓存获取所有标注组
      const nodeCache = this.state.getCategoryNodeCache();
      const allGroups = [
        ...nodeCache.textAnnotations,
        ...nodeCache.hotspotAnnotations,
        ...nodeCache.sourceAnnotations
      ];

      // 查找最大编号
      for (const node of allGroups) {
        try {
          const nameParts = node.name.split("/");
          if (nameParts.length > 0) {
            const numberPart = nameParts[0].split("-");
            if (numberPart.length > 1) {
              const number = parseInt(numberPart[1]);
              if (!isNaN(number)) {
                maxNumber = Math.max(maxNumber, number);
              }
            }
          }
        } catch (error) {
          console.error(`解析节点名称时出错: ${error instanceof Error ? error.message : '未知错误'}`);
          // 继续处理其他节点
        }
      }

      this.state.annotationCounter = maxNumber;
    } catch (error) {
      console.error(`初始化标注计数器时出错: ${error instanceof Error ? error.message : '未知错误'}`);
      // 设置默认值
      this.state.annotationCounter = 0;
    }
  }

  // 更新标注编号
  protected async updateAnnotationNumbers(deletedNumber: number): Promise<void> {
    const groups: {
      node: SceneNode;
      number: number;
      type: "annotation" | "source" | "hotspot-annotation";
    }[] = [];

    // 查找所有标注组和源标记组，使用缓存
    const nodeCache = this.state.getCategoryNodeCache();
    const allGroups = [
      ...nodeCache.textAnnotations,
      ...nodeCache.hotspotAnnotations,
      ...nodeCache.sourceAnnotations
    ];

    // 处理所有组
    allGroups.forEach((node) => {
      let number: number | undefined;
      let type: "annotation" | "source" | "hotspot-annotation" | undefined;

      if (node.name.startsWith("标注组-")) {
        number = parseInt(node.name.split("/")[0].split("-")[1]);
        type = "annotation";
      } else if (node.name.startsWith("源标注组-")) {
        number = parseInt(node.name.split("/")[0].split("-")[1]);
        type = "source";
      } else if (node.name.startsWith("热区标注组-")) {
        number = parseInt(node.name.split("/")[0].split("-")[1]);
        type = "hotspot-annotation";
      }

      if (number !== undefined && type !== undefined && !isNaN(number)) {
        groups.push({ node, number, type });
      }
    });

    // 删除对应的源标记组
    const sourceGroup = groups.find(
      (g) => g.type === "source" && g.number === deletedNumber
    );
    if (sourceGroup) {
      this.state.deleteSourceMarker(sourceGroup.node.id);
      sourceGroup.node.remove();
    }

    // 更新剩余的编号
    const remainingGroups = groups.filter((g) => g.number > deletedNumber);
    for (const group of remainingGroups) {
      try {
        // 确保节点仍然存在
        if (!figma.getNodeById(group.node.id)) continue;
        
        const newNumber = group.number - 1;
        const prefix =
          group.type === "annotation"
            ? "标注组-"
            : group.type === "hotspot-annotation"
              ? "热区标注组-"
              : "源标注组-";
        const oldNameParts = group.node.name.split("/");
        const newName = `${prefix}${newNumber}/${oldNameParts[1]}/${oldNameParts[2]}`;
        group.node.name = newName;

        // 更新组内的所有文本节点
        try {
          const textNodes = (group.node as GroupNode).findChildren(
            (node) => node.type === "TEXT"
          ) as TextNode[];
          for (const textNode of textNodes) {
            try {
              const currentNumber = parseInt(textNode.characters);
              if (!isNaN(currentNumber) && currentNumber === group.number) {
                textNode.characters = String(newNumber);
              }
            } catch (error) {
              console.error(`更新文本节点时出错: ${error instanceof Error ? error.message : '未知错误'}`);
            }
          }
        } catch (error) {
          console.error(`查找文本节点时出错: ${error instanceof Error ? error.message : '未知错误'}`);
        }

        // 更新源标记组的映射
        if (group.type === "source") {
          try {
            const sourceNodeId = this.state.getSourceMarker(group.node.id);
            if (sourceNodeId) {
              this.state.deleteSourceMarker(group.node.id);
              this.state.setSourceMarker(group.node.id, sourceNodeId);
            }
          } catch (error) {
            console.error(`更新源标记组映射时出错: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }

        // 更新标注框的插件数据
        if (group.type === "annotation" || group.type === "hotspot-annotation") {
          try {
            const frame = (group.node as GroupNode).findOne(
              (node) =>
                node.type === "FRAME" &&
                (node.name === "标注框" || node.name === "热区标注框")
            );
            if (frame) {
              this.state.safeSetPluginData(frame, "annotation-number", String(newNumber));
            }
          } catch (error) {
            console.error(`更新标注框插件数据时出错: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }
      } catch (error) {
        console.error(`更新标注编号时出错: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  }

  // 创建源标注
  protected async createSourceAnnotation(
    node: SceneNode,
    annotationNumber: number
  ): Promise<FrameNode> {
    const sourceNumber = figma.createFrame();
    sourceNumber.name = "源标注";
    sourceNumber.resize(24, 24);
    sourceNumber.cornerRadius = 12;

    // 设置源标注背景图片
    if (!this.state.cachedSourceImageHash) {
      try {
        const response = await fetch(SOURCE_ANNOTATION);
        const arrayBuffer = await response.arrayBuffer();
        const sourceImage = figma.createImage(new Uint8Array(arrayBuffer));
        this.state.cachedSourceImageHash = sourceImage.hash;
      } catch (error) {
        console.error("设置源标注背景时出错:", error);
      }
    }

    if (this.state.cachedSourceImageHash) {
      sourceNumber.fills = [
        {
          type: "IMAGE",
          imageHash: this.state.cachedSourceImageHash,
          scaleMode: "FILL",
        },
      ];
    } else {
      sourceNumber.fills = [
        { type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } },
      ];
    }

    const bounds = node.absoluteBoundingBox;
    if (!bounds) {
      throw new Error("无法获取节点边界");
    }

    sourceNumber.x = bounds.x + (bounds.width - 24) / 2;
    sourceNumber.y = bounds.y - 24;

    // 创建源标注的数字
    const sourceLabel = figma.createText();
    sourceLabel.name = "源标注数字";
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    sourceLabel.fontSize = 14;
    sourceLabel.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    sourceLabel.characters = annotationNumber.toString();
    sourceLabel.textAlignHorizontal = "CENTER";
    sourceLabel.textAlignVertical = "CENTER";
    sourceLabel.x = (24 - sourceLabel.width) / 2;
    sourceLabel.y = (24 - sourceLabel.height) / 2;

    sourceNumber.appendChild(sourceLabel);
    return sourceNumber;
  }

  // 抽象方法，由具体的标注类实现
  abstract create(node: SceneNode): Promise<void>;
}