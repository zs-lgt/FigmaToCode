import { PluginSettings, defaultPluginSettings, DeletedNode } from "./types";

export class PluginState {
  private static instance: PluginState;

  // 状态变量
  private _isTextEditingMode: boolean = false;
  private _isConnecting: boolean = false;
  private _sourceNode: SceneNode | null = null;
  private _annotationCounter: number = 0;
  private _userPluginSettings: PluginSettings = defaultPluginSettings;
  private _cachedSourceImageHash: string | null = null;
  private _lastDeletedNode: DeletedNode | null = null;
  private _sourceMarkerMap: Map<string, string> = new Map();

  // 缓存变量
  private _connectionGroupsCache: (GroupNode | FrameNode)[] = [];
  private _textAnnotationGroupsCache: (GroupNode | FrameNode)[] = [];
  private _hotspotAnnotationGroupsCache: (GroupNode | FrameNode)[] = [];
  private _sourceAnnotationGroupsCache: (GroupNode | FrameNode)[] = [];
  private _hotspotCache: SceneNode[] = [];
  private _cacheInitialized: boolean = false;
  private _cacheDirty: boolean = true;

  // 新增：节点ID到类型的映射缓存
  private _nodeTypeMap: Map<string, string> = new Map();
  // 新增：上次缓存时间
  private _lastCacheTime: number = 0;
  // 新增：缓存过期时间（5秒）
  private readonly CACHE_EXPIRY_TIME = 5000;

  private constructor() {}

  public static getInstance(): PluginState {
    if (!PluginState.instance) {
      PluginState.instance = new PluginState();
    }
    return PluginState.instance;
  }

  // 新增：检查缓存是否过期
  private isCacheExpired(): boolean {
    return Date.now() - this._lastCacheTime > this.CACHE_EXPIRY_TIME;
  }

  // 新增：快速检查节点类型
  private getNodeType(node: SceneNode): string | null {
    if (!node.name) return null;

    // 首先检查缓存
    const cachedType = this._nodeTypeMap.get(node.id);
    if (cachedType) return cachedType;

    // 如果没有缓存，则判断类型
    let type = null;
    if (node.type === "GROUP") {
      if (node.name.startsWith("连接线组")) {
        type = "connection";
      } else if (node.name.startsWith("热区标注组")) {
        type = "hotspot-annotation";
      } else if (node.name.startsWith("源标注组")) {
        type = "source";
      } else if (node.name.startsWith("标注组")) {
        type = "text-annotation";
      }
    } else if (node.type === "RECTANGLE") {
      // 修改热区节点的识别逻辑
      const isHotspot =
        this.safeGetPluginData(node, "isHotspot") === "true" ||
        this.safeGetPluginData(node, "type") === "hotspot";
      if (isHotspot) {
        type = "hotspot";
        // 记录热区节点的关联信息
        const annotationGroupId = this.safeGetPluginData(
          node,
          "annotation-group-id"
        );
        if (annotationGroupId) {
          this.safeSetPluginData(
            node,
            "annotation-group-id",
            annotationGroupId
          );
        }
      }
    }

    // 缓存结果
    if (type) {
      this._nodeTypeMap.set(node.id, type);
    }

    return type;
  }

  // 修改：注册热区标注组和热区的关联
  public registerHotspotAnnotation(
    hotspotAnnotationGroup: GroupNode,
    hotspot: SceneNode,
    sourceGroup?: GroupNode
  ): void {
    console.log(`\n=== 注册热区和标注组到缓存 ===`);
    console.log(
      `热区ID: ${hotspot.id}, 标注组ID: ${hotspotAnnotationGroup.id}`
    );

    // 1. 设置热区的标识和关联
    this.safeSetPluginData(hotspot, "isHotspot", "true");
    this.safeSetPluginData(hotspot, "type", "hotspot");
    this.safeSetPluginData(
      hotspot,
      "annotation-group-id",
      hotspotAnnotationGroup.id
    );

    // 2. 设置标注组的标识和关联
    this.safeSetPluginData(hotspotAnnotationGroup, "hotspot-id", hotspot.id);
    this.safeSetPluginData(
      hotspotAnnotationGroup,
      "type",
      "hotspot-annotation"
    );
    // 添加创建时间戳，用于处理复制的节点
    this.safeSetPluginData(
      hotspotAnnotationGroup,
      "creation-timestamp",
      Date.now().toString()
    );

    // 3. 如果有源标注组，设置关联
    if (sourceGroup) {
      console.log(`关联源标注组: ${sourceGroup.id}`);
      this.safeSetPluginData(sourceGroup, "type", "source");
      this.safeSetPluginData(
        hotspotAnnotationGroup,
        "source-group-id",
        sourceGroup.id
      );
      // 添加创建时间戳，用于处理复制的节点
      this.safeSetPluginData(
        sourceGroup,
        "creation-timestamp",
        Date.now().toString()
      );
      this._sourceAnnotationGroupsCache.push(sourceGroup);
      this._nodeTypeMap.set(sourceGroup.id, "source");
    }

    // 4. 直接添加到缓存，不依赖遍历
    this._hotspotCache.push(hotspot);
    this._hotspotAnnotationGroupsCache.push(hotspotAnnotationGroup);
    this._nodeTypeMap.set(hotspot.id, "hotspot");
    this._nodeTypeMap.set(hotspotAnnotationGroup.id, "hotspot-annotation");

    console.log(`当前缓存状态:
      热区数量: ${this._hotspotCache.length}
      热区标注组数量: ${this._hotspotAnnotationGroupsCache.length}
      源标注组数量: ${this._sourceAnnotationGroupsCache.length}
    `);
  }

  // 新增：注册文本标注的方法
  public registerTextAnnotation(
    annotationGroup: GroupNode | FrameNode,
    sourceGroup: GroupNode | FrameNode
  ): void {
    console.log(`\n=== 注册文本标注到缓存 ===`);
    console.log(`标注组ID: ${annotationGroup.id}, 源组ID: ${sourceGroup.id}`);

    // 设置标注组的标识
    this.safeSetPluginData(annotationGroup, "type", "text-annotation");
    this.safeSetPluginData(sourceGroup, "type", "source");

    // 添加创建时间戳，用于处理复制的节点
    this.safeSetPluginData(annotationGroup, "creation-timestamp", Date.now().toString());
    this.safeSetPluginData(sourceGroup, "creation-timestamp", Date.now().toString());

    // 设置相互关联
    this.safeSetPluginData(annotationGroup, "source-group-id", sourceGroup.id);
    this.safeSetPluginData(sourceGroup, "annotation-group-id", annotationGroup.id);

    // 直接添加到缓存
    this._textAnnotationGroupsCache.push(annotationGroup);
    this._sourceAnnotationGroupsCache.push(sourceGroup);
    this._nodeTypeMap.set(annotationGroup.id, "text-annotation");
    this._nodeTypeMap.set(sourceGroup.id, "source");

    console.log(`当前缓存状态:
      文本标注组数量: ${this._textAnnotationGroupsCache.length}
      源标注组数量: ${this._sourceAnnotationGroupsCache.length}
    `);
  }

  // 新增：检测并处理可能的重复节点(处理复制过的节点)
  private detectAndHandleDuplicateNodes(): void {
    try {
      // 使用创建时间戳检测复制的节点
      const processedIds = new Set<string>();
      const annotations = [...this._textAnnotationGroupsCache, ...this._hotspotAnnotationGroupsCache];

      for (const anno of annotations) {
        if (processedIds.has(anno.id)) continue;

        const timestamp = this.safeGetPluginData(anno, "creation-timestamp");
        if (!timestamp) continue;

        // 寻找可能有相同时间戳的其他节点(复制出来的一般会有相同时间戳)
        const possibleDuplicates = annotations.filter(node =>
          node.id !== anno.id &&
          this.safeGetPluginData(node, "creation-timestamp") === timestamp
        );

        // 如果找到可能的重复，处理它们
        for (const duplicate of possibleDuplicates) {
          const isHotspot = this.safeGetPluginData(duplicate, "type") === "hotspot-annotation";
          const number = parseInt(duplicate.name.split("-")[1]?.split("/")[0]) || 0;

          // 确保编号唯一，给复制的标注分配新的编号
          const newNumber = this._annotationCounter + 1;
          this._annotationCounter = newNumber;

          // 更新名称
          const prefix = isHotspot ? "热区标注组" : "标注组";
          const nameParts = duplicate.name.split("/");
          const newName = `${prefix}-${newNumber}/${nameParts.slice(1).join("/")}`;
          duplicate.name = newName;

          // 更新内部文本
          const textNodes = duplicate.findAll(node =>
            node.type === "TEXT" && !isNaN(parseInt(node.characters))
          ) as TextNode[];

          for (const textNode of textNodes) {
            // 只有当文本完全是数字时才更新
            if (textNode.characters && /^\d+$/.test(textNode.characters)) {
              textNode.characters = newNumber.toString();
            }
          }

          // 更新frame的插件数据
          const frame = duplicate.findOne(node =>
            node.type === "FRAME" &&
            (node.name === "标注框" || node.name === "热区标注框")
          );

          if (frame) {
            this.safeSetPluginData(frame, "annotation-number", newNumber.toString());
          }

          // 更新关联的源标注组
          const sourceGroupId = this.safeGetPluginData(duplicate, "source-group-id");
          if (sourceGroupId) {
            const sourceGroup = this.findNodeById(sourceGroupId);
            if (sourceGroup) {
              const nameParts = sourceGroup.name.split("/");
              const newSourceName = `源标注组-${newNumber}/${nameParts.slice(1).join("/")}`;
              sourceGroup.name = newSourceName;

              // 更新源标注组内的文本
              const sourceTextNodes = (sourceGroup as GroupNode).findAll(node =>
                node.type === "TEXT" && !isNaN(parseInt(node.characters))
              ) as TextNode[];

              for (const textNode of sourceTextNodes) {
                // 只有当文本完全是数字时才更新
                if (textNode.characters && /^\d+$/.test(textNode.characters)) {
                  textNode.characters = newNumber.toString();
                }
              }

              // 更新时间戳让它成为唯一标注
              this.safeSetPluginData(sourceGroup, "creation-timestamp", Date.now().toString());
            }
          }

          // 更新时间戳让它成为唯一标注
          this.safeSetPluginData(duplicate, "creation-timestamp", Date.now().toString());

          // 标记为已处理
          processedIds.add(duplicate.id);
        }

        // 标记原始节点为已处理
        processedIds.add(anno.id);
      }
    } catch (error) {
      console.error(`检测处理重复节点时出错: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  // 修改：初始化缓存方法
  private initCache(): void {
    if (this._cacheInitialized && !this._cacheDirty && !this.isCacheExpired()) {
      return;
    }

    try {
      console.log("\n=== 初始化缓存 ===");

      // 清空所有缓存
      this._connectionGroupsCache = [];
      this._textAnnotationGroupsCache = [];
      this._hotspotAnnotationGroupsCache = [];
      this._sourceAnnotationGroupsCache = [];
      this._hotspotCache = [];
      this._nodeTypeMap.clear();

      // 只处理顶层节点，查找标注组
      for (const node of figma.currentPage.children) {
        if (node.type === "GROUP" || node.type === "FRAME") {
          // 首先通过名称判断
          if (node.name.startsWith("源标注组")) {
            this._sourceAnnotationGroupsCache.push(node);
            this._nodeTypeMap.set(node.id, "source");
            continue;
          } else if (node.name.startsWith("标注组-")) {
            this._textAnnotationGroupsCache.push(node);
            this._nodeTypeMap.set(node.id, "text-annotation");
            continue;
          }

          // 然后通过插件数据判断
          const nodeType = this.safeGetPluginData(node, "type");
          switch (nodeType) {
            case "connection":
              this._connectionGroupsCache.push(node);
              this._nodeTypeMap.set(node.id, "connection");
              break;
            case "hotspot-annotation":
              this._hotspotAnnotationGroupsCache.push(node);
              this._nodeTypeMap.set(node.id, "hotspot-annotation");
              // 找到对应的热区
              const hotspotId = this.safeGetPluginData(node, "hotspot-id");
              if (hotspotId) {
                const hotspot = figma.getNodeById(hotspotId);
                if (
                  hotspot &&
                  this.safeGetPluginData(hotspot, "isHotspot") === "true"
                ) {
                  this._hotspotCache.push(hotspot as SceneNode);
                  this._nodeTypeMap.set(hotspot.id, "hotspot");
                }
              }
              break;
            case "text-annotation":
              this._textAnnotationGroupsCache.push(node);
              this._nodeTypeMap.set(node.id, "text-annotation");
              break;
          }
        }
      }

      // 处理可能复制出来的重复节点
      this.detectAndHandleDuplicateNodes();

      this._cacheInitialized = true;
      this._cacheDirty = false;
      this._lastCacheTime = Date.now();

      console.log(`缓存初始化完成:
        连接线组: ${this._connectionGroupsCache.length}
        文本标注组: ${this._textAnnotationGroupsCache.length}
        热区标注组: ${this._hotspotAnnotationGroupsCache.length}
        源标注组: ${this._sourceAnnotationGroupsCache.length}
        热区: ${this._hotspotCache.length}
        节点类型映射: ${this._nodeTypeMap.size}
      `);
    } catch (error) {
      console.error(
        `初始化缓存时出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
      this.invalidateCache();
    }
  }

  // 优化缓存失效方法
  public invalidateCache(): void {
    this._cacheDirty = true;
    this._cacheInitialized = false;
    this._lastCacheTime = 0;
    // 保留节点类型映射，只在必要时清除
    if (this._nodeTypeMap.size > 10000) {
      // 如果映射过大，才清除
      this._nodeTypeMap.clear();
    }
  }

  // Getters
  get isTextEditingMode(): boolean {
    return this._isTextEditingMode;
  }
  get isConnecting(): boolean {
    return this._isConnecting;
  }
  get sourceNode(): SceneNode | null {
    return this._sourceNode;
  }
  get annotationCounter(): number {
    return this._annotationCounter;
  }
  get userPluginSettings(): PluginSettings {
    return this._userPluginSettings;
  }
  get cachedSourceImageHash(): string | null {
    return this._cachedSourceImageHash;
  }
  get lastDeletedNode(): DeletedNode | null {
    return this._lastDeletedNode;
  }
  get sourceMarkerMap(): Map<string, string> {
    return this._sourceMarkerMap;
  }

  // Setters
  set isTextEditingMode(value: boolean) {
    this._isTextEditingMode = value;
  }
  set isConnecting(value: boolean) {
    this._isConnecting = value;
  }
  set sourceNode(value: SceneNode | null) {
    this._sourceNode = value;
  }
  set annotationCounter(value: number) {
    this._annotationCounter = value;
  }
  set cachedSourceImageHash(value: string | null) {
    this._cachedSourceImageHash = value;
  }
  set lastDeletedNode(value: DeletedNode | null) {
    this._lastDeletedNode = value;
  }

  // 安全地获取节点
  public findNodeById(id: string): BaseNode | null {
    try {
      if (!id) return null;
      return figma.getNodeById(id);
    } catch (error) {
      console.error(
        `获取节点时出错 (ID: ${id}): ${error instanceof Error ? error.message : "未知错误"}`
      );
      return null;
    }
  }

  // 更新设置
  public updateSettings(settings: Partial<PluginSettings>): void {
    this._userPluginSettings = { ...this._userPluginSettings, ...settings };
    figma.clientStorage.setAsync(
      "userPluginSettings",
      this._userPluginSettings
    );
  }

  // 初始化设置
  public async initSettings(): Promise<void> {
    try {
      const savedSettings =
        await figma.clientStorage.getAsync("userPluginSettings");
      if (savedSettings) {
        this._userPluginSettings = {
          ...defaultPluginSettings,
          ...savedSettings,
        };
      }
    } catch (error) {
      console.error("加载设置时出错:", error);
      this._userPluginSettings = defaultPluginSettings;
    }
  }

  // 源标记映射方法
  public setSourceMarker(sourceId: string, targetId: string): void {
    this._sourceMarkerMap.set(sourceId, targetId);
  }

  public getSourceMarker(sourceId: string): string | undefined {
    return this._sourceMarkerMap.get(sourceId);
  }

  public deleteSourceMarker(sourceId: string): void {
    this._sourceMarkerMap.delete(sourceId);
  }

  // 获取连接线组缓存
  public getConnectionGroups(): (GroupNode | FrameNode)[] {
    this.initCache();
    return [...this._connectionGroupsCache];
  }

  // 获取文本标注组缓存
  public getTextAnnotationGroups(): (GroupNode | FrameNode)[] {
    this.initCache();
    return [...this._textAnnotationGroupsCache];
  }

  // 获取热区标注组缓存
  public getHotspotAnnotationGroups(): (GroupNode | FrameNode)[] {
    this.initCache();
    return [...this._hotspotAnnotationGroupsCache];
  }

  // 获取源标注组缓存
  public getSourceAnnotationGroups(): (GroupNode | FrameNode)[] {
    this.initCache();
    return [...this._sourceAnnotationGroupsCache];
  }

  // 获取所有标注相关节点
  public getAllAnnotationNodes(): SceneNode[] {
    this.initCache();
    return [
      ...this._connectionGroupsCache,
      ...this._textAnnotationGroupsCache,
      ...this._hotspotAnnotationGroupsCache,
      ...this._sourceAnnotationGroupsCache,
      ...this._hotspotCache,
    ];
  }

  // 获取按类别分组的节点缓存
  public getCategoryNodeCache(): {
    connections: (GroupNode | FrameNode)[];
    textAnnotations: (GroupNode | FrameNode)[];
    hotspotAnnotations: (GroupNode | FrameNode)[];
    sourceAnnotations: (GroupNode | FrameNode)[];
  } {
    this.initCache();
    return {
      connections: [...this._connectionGroupsCache],
      textAnnotations: [...this._textAnnotationGroupsCache],
      hotspotAnnotations: [...this._hotspotAnnotationGroupsCache],
      sourceAnnotations: [...this._sourceAnnotationGroupsCache],
    };
  }

  // 获取热区缓存
  public getHotspots(): SceneNode[] {
    this.initCache();
    return [...this._hotspotCache];
  }

  // 安全地获取插件数据
  public safeGetPluginData(node: BaseNode, key: string): string {
    try {
      if (!node || !node.id) return "";
      // 检查节点是否仍然存在
      if (!figma.getNodeById(node.id)) return "";
      return node.getPluginData(key);
    } catch (error) {
      console.error(
        `安全获取插件数据时出错 (节点ID: ${node?.id || "未知"}, 键: ${key}): ${error instanceof Error ? error.message : "未知错误"}`
      );
      return "";
    }
  }

  // 安全地设置插件数据
  public safeSetPluginData(
    node: BaseNode,
    key: string,
    value: string
  ): boolean {
    try {
      if (!node || !node.id) return false;
      // 检查节点是否仍然存在
      if (!figma.getNodeById(node.id)) return false;
      node.setPluginData(key, value);
      return true;
    } catch (error) {
      console.error(
        `安全设置插件数据时出错 (节点ID: ${node?.id || "未知"}, 键: ${key}): ${error instanceof Error ? error.message : "未知错误"}`
      );
      return false;
    }
  }

  // 重置状态
  public reset(): void {
    this._isTextEditingMode = false;
    this._isConnecting = false;
    this._sourceNode = null;
    this._annotationCounter = 0;
    this._cachedSourceImageHash = null;
    this._lastDeletedNode = null;
    this._sourceMarkerMap.clear();
    this.invalidateCache();
  }

  // 修改：删除热区及其关联节点
  public async deleteHotspotAndRelated(hotspotAnnotationGroup: GroupNode) : Promise<void> {
    try {
      console.log(`\n=== 开始删除热区标注组 ===`);
      console.log(`标注组ID: ${hotspotAnnotationGroup.id}`);
      console.log(`标注组名称: ${hotspotAnnotationGroup.name}`);

      // 获取当前标注编号
      const currentNumber = parseInt(
        hotspotAnnotationGroup.name.split("-")[1]?.split("/")[0]
      );
      console.log(`当前标注编号: ${currentNumber}`);

      // 1. 从缓存中找到关联的热区
      const hotspotId = this.safeGetPluginData(
        hotspotAnnotationGroup,
        "hotspot-id"
      );
      console.log(`关联的热区ID: ${hotspotId}`);

      // 2. 从缓存中获取热区
      const hotspot = hotspotId ? figma.getNodeById(hotspotId) : null;

      if (hotspot) {
        console.log(`找到关联热区，准备删除`);
        // 从缓存中移除
        this._hotspotCache = this._hotspotCache.filter(
          (h) => h.id !== hotspotId
        );
        // 从_nodeTypeMap中移除
        this._nodeTypeMap.delete(hotspotId);
        // 删除节点
        hotspot.remove();
      }

      // 3. 删除源标注组
      const sourceGroupId = this.safeGetPluginData(
        hotspotAnnotationGroup,
        "source-group-id"
      );
      console.log(`关联的源标注组ID: ${sourceGroupId}`);

      if (sourceGroupId) {
        const sourceGroup = figma.getNodeById(sourceGroupId);
        if (sourceGroup) {
          console.log(`找到源标注组，准备删除: ${sourceGroup.name}`);
          // 从缓存中移除
          this._sourceAnnotationGroupsCache =
            this._sourceAnnotationGroupsCache.filter(
              (group) => group.id !== sourceGroupId
            );
          // 从_nodeTypeMap中移除
          this._nodeTypeMap.delete(sourceGroupId);
          // 删除节点
          sourceGroup.remove();
          console.log(`源标注组已删除`);
        } else {
          console.warn(`未找到源标注组节点: ${sourceGroupId}`);
          // 从_nodeTypeMap中移除失效的ID
          this._nodeTypeMap.delete(sourceGroupId);
        }
      } else {
        console.warn(`热区标注组未关联源标注组`);
      }

      // 4. 从缓存中移除热区标注组
      this._hotspotAnnotationGroupsCache =
        this._hotspotAnnotationGroupsCache.filter(
          (group) => group.id !== hotspotAnnotationGroup.id
        );

      // 从_nodeTypeMap中移除
      this._nodeTypeMap.delete(hotspotAnnotationGroup.id);

      // 5. 删除标注组节点
      hotspotAnnotationGroup.remove();

      console.log(`删除完成，当前缓存状态:
        热区数量: ${this._hotspotCache.length}
        热区标注组数量: ${this._hotspotAnnotationGroupsCache.length}
        源标注组数量: ${this._sourceAnnotationGroupsCache.length}
      `);

      // 6. 先更新标注编号
      await this.updateAllAnnotationNumbers();

      // 7. 然后强制刷新缓存
      this.invalidateCache();
      this.initCache();
    } catch (error) {
      console.error(
        `删除热区时出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  // 修改：更新所有标注编号方法，添加热区处理
  public async updateAllAnnotationNumbers(): Promise<void> {
    try {
      console.log(`\n=== 开始更新所有标注编号 ===`);

      // 初始化缓存
      this.initCache();

      // 获取所有标注组
      const allAnnotations = [
        ...this._textAnnotationGroupsCache,
        ...this._hotspotAnnotationGroupsCache,
      ];

      console.log(`找到标注组总数: ${allAnnotations.length}`);

      // 按照当前编号排序
      allAnnotations.sort((a, b) => {
        const aNum = parseInt(a.name.split("-")[1]?.split("/")[0]) || 0;
        const bNum = parseInt(b.name.split("-")[1]?.split("/")[0]) || 0;
        return aNum - bNum;
      });

      // 加载字体
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });

      // 遍历所有标注组，将编号大于删除号码的标注组编号减一
      for (const group of allAnnotations) {
        try {
          const currentNumber =
            parseInt(group.name.split("-")[1]?.split("/")[0]) || 0;
          const isHotspot = group.name.startsWith("热区标注组");
          const prefix = isHotspot ? "热区标注组" : "标注组";
          const nameParts = group.name.split("/");

          // 更新组名
          const newName = `${prefix}-${currentNumber}/${nameParts.slice(1).join("/")}`;
          console.log(`更新组名: ${group.name} -> ${newName}`);
          group.name = newName;

          // 更新数字标签 - 仅更新纯数字标签
          const textNodes = group.findAll(
            (node) => node.type === "TEXT"
          ) as TextNode[];

          for (const textNode of textNodes) {
            // 只有当文本完全是数字时才更新
            if (textNode.characters && /^\d+$/.test(textNode.characters)) {
              // 通过节点名称判断是否是标注编号
              const isAnnotationNumber =
                textNode.name === "目标标记数字" ||
                textNode.name === "标注编号" ||
                textNode.name === "热区标注编号";
              if (isAnnotationNumber) {
                textNode.characters = String(currentNumber);
              }
            }
          }

          // 更新标注框的插件数据
          const frame = group.findOne(
            (node) =>
              node.type === "FRAME" &&
              (node.name === "标注框" || node.name === "热区标注框")
          );
          if (frame) {
            this.safeSetPluginData(
              frame,
              "annotation-number",
              String(currentNumber)
            );
          }

          // 如果是热区标注组，更新对应热区的编号
          if (isHotspot) {
            const hotspotId = this.safeGetPluginData(group, "hotspot-id");
            if (hotspotId) {
              const hotspot = figma.getNodeById(hotspotId);
              if (hotspot) {
                this.safeSetPluginData(
                  hotspot,
                  "hotspot-number",
                  String(currentNumber)
                );
              }
            }
          }

          // 更新对应的源标注组
          const sourceGroupId = this.safeGetPluginData(
            group,
            "source-group-id"
          );
          if (sourceGroupId) {
            const sourceGroup = figma.getNodeById(sourceGroupId) as GroupNode;
            if (sourceGroup) {
              const sourceNameParts = sourceGroup.name.split("/");
              const newSourceName = `源标注组-${currentNumber}/${sourceNameParts.slice(1).join("/")}`;
              sourceGroup.name = newSourceName;

              // 更新源标注组内的数字标签
              const sourceTextNodes = sourceGroup.findAll(
                (node) => node.type === "TEXT"
              ) as TextNode[];

              for (const textNode of sourceTextNodes) {
                // 只有当文本完全是数字时才更新
                if (textNode.characters && /^\d+$/.test(textNode.characters)) {
                  textNode.characters = String(currentNumber);
                }
              }
            }
          }
        } catch (error) {
          console.error(
            `处理标注组时出错: ${error instanceof Error ? error.message : "未知错误"}`
          );
        }
      }

      // 更新计数器
      this._annotationCounter = allAnnotations.length;
      await figma.clientStorage.setAsync(
        "annotationCounter",
        this._annotationCounter
      );

      // 刷新缓存
      this.invalidateCache();

      console.log(`\n=== 标注编号更新完成 ===`);
      console.log(`最终计数器值: ${this._annotationCounter}`);
      console.log(`更新的标注组总数: ${allAnnotations.length}`);
    } catch (error) {
      console.error(
        `更新所有标注编号时出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }
}
