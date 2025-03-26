import { PluginState } from "./state";
import { DeletedNode } from "./types";

export class EventManager {
  private static instance: EventManager;
  private state: PluginState;
  private localEventIds: Set<string> = new Set();

  private constructor() {
    this.state = PluginState.getInstance();
    this.initializeEventListeners();
  }

  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  private initializeEventListeners(): void {
    // 监听选择变化
    figma.on("selectionchange", this.handleSelectionChange.bind(this));

    // 监听页面变化
    figma.on("currentpagechange", this.handlePageChange.bind(this));
  }

  private handleSelectionChange(): void {
    const selection = figma.currentPage.selection;
    if (selection.length === 1) {
      const node = selection[0];
      this.state.lastDeletedNode = {
        id: node.id,
        name: node.name,
        type: node.type,
      };

      // 如果选中的是源标注组
      if (node.type === "GROUP" && node.name.startsWith("源标注组-")) {
        // 获取原始节点ID
        const sourceNodeId = this.state.getSourceMarker(node.id);
        if (sourceNodeId) {
          // 获取原始节点
          const sourceNode = figma.getNodeById(sourceNodeId);
          if (sourceNode) {
            // 选中原始节点
            figma.currentPage.selection = [sourceNode];
          }
        }
      }
    }
  }

  private handlePageChange(): void {
    // 这里可以添加页面切换时的处理逻辑
  }

  // 处理文档变更事件
  public handleDocumentChange(event: DocumentChangeEvent): void {
    try {
      // 如果是本地事件，直接返回
      if (this.isLocalEvent(event)) return;

      const changes = event.documentChanges;
      console.log("文档变更:", changes);

      // 处理删除操作
      const deleteOperations = changes.filter(
        (change) => change.type === "DELETE"
      );

      if (deleteOperations.length > 0) {
        console.log("检测到删除操作:", deleteOperations);
        this.handleDeleteOperations(deleteOperations);
      }
    } catch (error) {
      console.error(
        `处理文档变更时出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  // 处理删除操作
  private handleDeleteOperations(deleteOperations: DocumentChange[]): void {
    try {
      for (const operation of deleteOperations) {
        const deletedNode = operation.node;
        console.log("处理删除节点:", deletedNode);

        // 检查是否是热区标注组
        if (
          deletedNode.type === "GROUP" &&
          deletedNode.name.startsWith("热区标注组")
        ) {
          console.log("检测到热区标注组被删除:", deletedNode.name);
          this.state.deleteHotspotAndRelated(deletedNode as GroupNode);
        }

        // 保存最后删除的节点信息
        this.state.lastDeletedNode = {
          id: deletedNode.id,
          name: deletedNode.name,
          type: deletedNode.type,
        } as DeletedNode;
      }
    } catch (error) {
      console.error(
        `处理删除操作时出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  // 检查是否为本地事件
  public isLocalEvent(event: DocumentChangeEvent): boolean {
    return event.documentChanges.some((change) =>
      this.localEventIds.has(change.id)
    );
  }

  // 标记本地事件
  public markLocalEvent(eventId: string): void {
    this.localEventIds.add(eventId);
    // 5秒后自动清除
    setTimeout(() => {
      this.localEventIds.delete(eventId);
    }, 5000);
  }

  // 防抖函数
  public debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  }
}
