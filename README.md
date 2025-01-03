<!-- <p align="center"><img src="assets/icon_256.png" alt="Figma to Code" height="128px"></p> -->

[![Figma to Code](assets/git_preview.png)](https://www.figma.com/community/plugin/842128343887142055)

# Figma to Code

<p align="center">
<a href="https://github.com/bernaferrari/FigmaToCode/actions/"><img src="https://github.com/bernaferrari/FigmaToCode/workflows/CI/badge.svg"/></a>
<a href="https://codecov.io/gh/bernaferrari/FigmaToCode"><img src="https://codecov.io/gh/bernaferrari/FigmaToCode/branch/master/graph/badge.svg" /></a>
<a href="http://twitter.com/bernaferrari">
<img src="https://img.shields.io/badge/Twitter-@bernaferrari-brightgreen.svg?style=flat" alt="Twitter"/></a>
</p><p align="center">
<a href="https://www.figma.com/community/plugin/842128343887142055"><img src="assets/badge.png" height="60"/></a>
</p>

[English](./README.md) | 简体中文

## 项目简介

Figma to Code 是一个强大的 Figma 插件，能够将 Figma 设计稿转换为多个主流框架的代码实现。与其他设计转代码工具相比，本项目致力于生成高质量的**响应式**布局代码。

### 当前支持的框架
- [Tailwind CSS](https://tailwindcss.com/)：流行的原子化 CSS 框架
- [Flutter](https://flutter.github.io/)：Google 的跨平台 UI 框架
- [SwiftUI](https://developer.apple.com/xcode/swiftui/)：Apple 的声明式 UI 框架

### 计划支持的框架
- [Jetpack Compose](https://developer.android.com/jetpack/compose)：Android 原生 UI 框架
- 标准 HTML/CSS
- [React Native](https://reactnative.dev/)：跨平台移动应用框架
- [Bootstrap](https://getbootstrap.com/)：响应式 CSS 框架
- [Fluent](https://www.microsoft.com/design/fluent/)：微软设计系统

## 核心特性

- 🎯 **精准转换**：优化的代码转换算法，确保设计还原度
- 📱 **响应式布局**：生成的代码默认支持响应式设计
- 🛠 **多框架支持**：支持主流前端和移动端框架
- 🔍 **智能优化**：在转换前对布局进行优化，提升代码质量
- 🎨 **设计系统集成**：支持颜色、字体等设计标记的转换
- 📦 **组件化支持**：可以选择单个组件进行转换

## 工作原理

插件采用创新的方法来提升代码质量：在开始转换之前，首先对布局进行优化。

### 转换流程

1. **节点虚拟化**
   - 将 Figma 标准节点转换为虚拟 `AltNodes`
   - 保持原始设计不变的情况下进行优化

2. **布局分析**
   - 智能识别布局结构
   - 分析元素间的对齐方式和间距
   - 优化嵌套层级

3. **代码优化**
   - 根据不同框架的特性生成优化后的代码
   - 应用框架特定的最佳实践

![转换工作流程](assets/workflow.png)

## 使用指南

### 基础用法

1. **安装插件**
   - 在 Figma 插件市场搜索 "Figma to Code"
   - 点击安装按钮

2. **选择设计元素**
   - 在 Figma 中选择要转换的设计元素
   - 可以选择整个页面或单个组件

3. **运行插件**
   - 点击插件图标启动
   - 选择目标框架（Tailwind/Flutter/SwiftUI）
   - 点击"生成代码"

4. **使用生成的代码**
   - 复制生成的代码到你的项目中
   - 根据需要进行微调

### 高级技巧

- **组件转换**：选择单个组件进行转换，便于调试和组件化开发
- **布局优化**：使用 Frame 或 Group 包装元素可以获得更好的布局效果
- **响应式设计**：注意设计稿中元素的宽度，建议不超过 384px（Tailwind 限制）
- **复杂布局处理**：对于复杂的自由布局，建议先在 Figma 中使用 Auto Layout

### 常见问题处理

1. **未对齐元素**
   - 问题：当 Group 或 Frame 中有多个子元素且没有垂直或水平对齐时
   - 解决方案：
     - Tailwind：使用 [insets](https://tailwindcss.com/docs/top-right-bottom-left/#app) 或标准 CSS 定位
     - Flutter：使用 `Stack` 和 `Positioned.fill`
     - 建议：尽可能使用 Auto Layout 来避免这种情况

2. **特殊元素处理**
   - 矢量图形：HTML 中处理复杂，Flutter 暂不支持
   - 本地图片：需要单独处理资源引用
   - 特殊图形：目前优先支持矩形和椭圆，其他形状持续开发中

## 框架特定说明

### Tailwind CSS

#### 特性
- 支持响应式设计
- 自动生成原子化类名
- 智能处理布局和样式

#### 限制
- 最大宽度限制为 384px
- 超出限制的元素会被设置为 `w-full`
- 支持相对宽度（如 `w-1/2`、`w-1/3` 等）

### Flutter

#### 特性
- 生成原生 Flutter 组件
- 支持复杂布局转换
- 保持设计精确度

#### 优化方向
- 简化 Stack 的使用
- 添加 Material Design 风格匹配
- 优化按钮等常用组件的识别
- 支持自定义主题

### SwiftUI

#### 特性
- 生成原生 SwiftUI 视图
- 支持基础布局转换
- 符合 Apple 设计规范

#### 持续优化
- 改进布局系统适配
- 增强动画支持
- 优化代码结构

## 数据导出与导入

### UI 信息导出

插件支持将 Figma 设计导出为标准化的 JSON 数据结构，包含以下信息：

#### 节点基本信息
- 节点 ID 和名称
- 节点类型（如 Frame、Group、Text 等）
- 可见性和透明度
- 混合模式和遮罩属性

#### 布局信息
- 位置信息（x, y 坐标）
- 尺寸信息（宽度、高度）
- 旋转角度
- 布局约束和对齐方式
- 自动布局属性（padding、spacing 等）

#### 样式信息
- 填充（颜色、渐变、图案）
- 描边（宽度、颜色、样式）
- 特效（阴影、模糊等）
- 圆角属性

#### 文本特有属性
- 字体和字号
- 字重和样式
- 行高和字间距
- 文本对齐方式
- 文本装饰（下划线等）

#### 图片资源
- 图片节点的导出设置
- Base64 编码的图片数据
- 图片尺寸和格式信息

### JSON 数据结构

```typescript
interface NodeInfo {
  // 基本信息
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  blendMode?: string;
  isMask?: boolean;

  // 布局属性
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  layoutAlign?: string;

  // 样式属性
  fills?: Array<{
    type: string;
    opacity?: number;
    color?: {
      r: number;
      g: number;
      b: number;
    };
    gradientStops?: Array<{
      position: number;
      color: string;
    }>;
  }>;
  
  strokes?: Array<{
    type: string;
    opacity?: number;
    color?: {
      r: number;
      g: number;
      b: number;
    };
  }>;
  strokeWeight?: number;

  // 特效
  effects?: Array<{
    type: string;
    color: string;
    offset?: { x: number; y: number };
    radius?: number;
  }>;

  // 子节点
  children?: NodeInfo[];
}
```

### 导出流程

1. **节点选择**
   - 支持选择单个或多个节点
   - 支持导出整个页面
   - 可选择是否包含隐藏图层

2. **数据收集**
   ```typescript
   function getNodeInfo(node: SceneNode) {
     const nodeInfo: NodeInfo = {
       id: node.id,
       name: node.name,
       type: node.type,
     };

     // 收集基本属性
     if ('visible' in node) nodeInfo.visible = node.visible;
     if ('opacity' in node) nodeInfo.opacity = node.opacity;
     // ... 其他属性

     // 收集子节点信息
     if ('children' in node) {
       nodeInfo.children = node.children.map(child => getNodeInfo(child));
     }

     return nodeInfo;
   }
   ```

3. **图片处理**
   ```typescript
   async function getNodeExportImage(nodeId: string) {
     const node = figma.getNodeById(nodeId);
     if (node && 'exportAsync' in node) {
       const buffer = await node.exportAsync({
         format: 'PNG',
         constraint: { type: 'SCALE', value: 2 }
       });
       return buffer;
     }
     return null;
   }
   ```

4. **数据优化**
   - 移除未使用的属性
   - 压缩图片数据
   - 优化数据结构

### 导入功能

#### JSON 导入流程

1. **数据验证**
   - 检查 JSON 格式
   - 验证必需字段
   - 类型检查

2. **节点创建**
   ```typescript
   function createNodeFromJson(json: NodeInfo) {
     // 根据类型创建节点
     const node = figma.createFrame(); // 或其他节点类型

     // 应用基本属性
     node.name = json.name;
     if (json.visible !== undefined) node.visible = json.visible;
     if (json.opacity !== undefined) node.opacity = json.opacity;

     // 应用布局
     if (json.x !== undefined) node.x = json.x;
     if (json.y !== undefined) node.y = json.y;
     // ... 其他属性

     // 递归创建子节点
     if (json.children) {
       json.children.forEach(childJson => {
         const childNode = createNodeFromJson(childJson);
         node.appendChild(childNode);
       });
     }

     return node;
   }
   ```

3. **资源处理**
   - 导入并链接字体
   - 创建样式库
   - 处理图片资源

4. **布局重建**
   - 重建自动布局
   - 应用约束
   - 恢复组件实例

### 最佳实践

1. **数据导出**
   - 使用语义化的命名
   - 保持层级结构清晰
   - 导出前整理图层

2. **数据导入**
   - 验证数据完整性
   - 处理异常情况
   - 保持样式一致性

3. **版本控制**
   - 记录导出版本
   - 保存导出历史
   - 支持增量更新

## 开发指南

### 项目结构
```
FigmaToCode/
├── packages/
│   ├── backend/        # 核心转换逻辑
│   ├── plugin-ui/      # 插件界面
│   └── tsconfig/       # TypeScript 配置
├── apps/              # 示例应用
└── scripts/           # 构建脚本
```

### 构建系统
项目支持两种构建方式：
- **Webpack**：推荐用于 TypeScript 开发
- **Rollup**：必须用于 UI 相关开发

### 开发环境设置
1. 克隆项目
```bash
git clone https://github.com/bernaferrari/FigmaToCode.git
cd FigmaToCode
```

2. 安装依赖
```bash
pnpm install
```

3. 启动开发服务器
```bash
pnpm dev
```

## 贡献指南

我们欢迎各种形式的贡献，包括但不限于：
- 🐛 Bug 报告和修复
- 💡 新功能建议
- 📖 文档改进
- 🔍 代码审查
- 🌐 国际化支持

### 如何贡献
1. Fork 项目
2. 创建特性分支
3. 提交变更
4. 发起 Pull Request

### 开发规范
- 遵循 TypeScript 最佳实践
- 保持代码简洁清晰
- 添加必要的注释和文档
- 编写单元测试

## 问题反馈

- 发现 bug？有改进建议？请[提交 issue](../../issues)
- 项目设计文件：[Figma 文件链接](https://www.figma.com/file/8buWpm6Mpq4yK9MhbkcdJB/Figma-to-Code)
- 技术讨论：欢迎在 GitHub Discussions 中参与讨论
- 邮件联系：[作者邮箱]

## 许可证

本项目采用 [MIT 许可证](LICENSE)
