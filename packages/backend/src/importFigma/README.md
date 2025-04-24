# Figma 节点导入属性说明

本文档说明了导入 Figma 节点时所需的和支持的属性。

## 核心属性

### 必需属性
- `type`: 节点类型（如 'FRAME'、'TEXT'、'RECTANGLE' 等）
- `id`: 节点唯一标识符

### 基础属性
- `name`: 节点名称
- `visible`: 可见性（默认值：true）
- `locked`: 锁定状态（默认值：false）
- `opacity`: 不透明度（0-1，默认值：1）
- `constrainProportions`: 是否保持宽高比

## 几何属性

### 位置和尺寸
- `width`: 节点宽度（默认值：100）
- `height`: 节点高度（默认值：100）
- `x`: X 坐标（默认值：0）
- `y`: Y 坐标（默认值：0）
- `rotation`: 旋转角度
- `relativeTransform`: 用于精确定位和旋转的变换矩阵

### 布局属性
- `layoutMode`: 自动布局模式（'NONE'：无、'HORIZONTAL'：水平、'VERTICAL'：垂直）
- `layoutSizingHorizontal`: 水平尺寸行为（'FIXED'：固定、'HUG'：自适应、'FILL'：填充）
- `layoutSizingVertical`: 垂直尺寸行为（'FIXED'：固定、'HUG'：自适应、'FILL'：填充）
- `primaryAxisSizingMode`: 主轴尺寸模式
- `counterAxisSizingMode`: 交叉轴尺寸模式
- `layoutAlign`: 在自动布局父级中的对齐方式

## 外观属性

### 填充属性
- `fills`: 填充图层数组
  - 支持的类型：'SOLID'（纯色）、'GRADIENT_LINEAR'（线性渐变）、'GRADIENT_RADIAL'（径向渐变）、'GRADIENT_ANGULAR'（角度渐变）、'GRADIENT_DIAMOND'（菱形渐变）、'IMAGE'（图片）
  - 每个填充都包含：`type`（类型）、`visible`（可见性）、`opacity`（不透明度）、`blendMode`（混合模式）

### 描边属性
- `strokes`: 描边图层数组
- `strokeWeight`: 描边粗细
- `strokeAlign`: 描边对齐方式（'INSIDE'：内部、'OUTSIDE'：外部、'CENTER'：居中）
- `strokeCap`: 线条端点样式（'NONE'：无、'ROUND'：圆形、'SQUARE'：方形、'ARROW_LINES'：箭头线、'ARROW_EQUILATERAL'：等边箭头）
- `strokeJoin`: 线条连接样式（'MITER'：尖角、'BEVEL'：斜角、'ROUND'：圆角）
- `strokeMiterLimit`: 尖角限制值

### 效果
- `effects`: 效果数组
  - 支持的类型：'DROP_SHADOW'（投影）、'INNER_SHADOW'（内阴影）、'LAYER_BLUR'（图层模糊）、'BACKGROUND_BLUR'（背景模糊）
  - 每个效果都包含：`type`（类型）、`visible`（可见性）、`radius`（半径）
  - 阴影效果还包含：`color`（颜色）、`offset`（偏移）、`spread`（扩散）

### 圆角属性
- `cornerRadius`: 圆角半径（用于矩形）
- `topLeftRadius`: 左上角圆角半径
- `topRightRadius`: 右上角圆角半径
- `bottomLeftRadius`: 左下角圆角半径
- `bottomRightRadius`: 右下角圆角半径

## 特殊节点类型

### 文本节点
文本节点的额外属性：
- `characters`: 文本内容
- `fontName`: 字体系列和样式
- `fontSize`: 字体大小
- `textAlignHorizontal`: 水平文本对齐
- `textAlignVertical`: 垂直文本对齐
- `textAutoResize`: 文本自动调整大小行为
- `textCase`: 文本大小写转换
- `textDecoration`: 文本装饰（下划线、删除线）
- `letterSpacing`: 字间距
- `lineHeight`: 行高
- `paragraphIndent`: 段落缩进
- `paragraphSpacing`: 段落间距

### 矢量节点
矢量节点的额外属性：
- `vectorPaths`: 矢量路径数组
- `strokeGeometry`: 描边路径几何
- `fillGeometry`: 填充路径几何

### 实例节点
组件实例的额外属性：
- `componentKey`: 主组件的键值
- `componentProperties`: 组件属性值

## 注意事项
- 除了 `type` 和 `id` 外，所有属性都是可选的
- 缺失的属性将使用默认值
- 某些属性仅适用于特定节点类型
- 布局属性需要正确的父子关系
- 文本节点的字体加载是自动处理的
