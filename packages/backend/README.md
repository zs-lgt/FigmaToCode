# @thsf2e/figma-create-backend

A powerful backend library for converting Figma designs to code, supporting multiple frameworks including React, Vue, Flutter, and SwiftUI.

## Installation

```bash
npm install @thsf2e/figma-create-backend
```

or

```bash
yarn add @thsf2e/figma-create-backend
```

## Features

- Export Figma nodes to JSON format
- Import JSON data back to Figma
- Clean and optimize exported data
- Handle various node types (Frame, Text, Vector, etc.)
- Support for images and assets
- Framework-specific code generation

## Usage

### Exporting Nodes

```typescript
import { exportNodes } from '@thsf2e/figma-create-backend';

// Export nodes with optimization
const result = await exportNodes(figma.currentPage.children, true);

// The result contains:
// - nodesInfo: Array of node information
// - description: Extracted description from #comments
// - images: Array of image references
// - optimize: Whether the data was optimized
```

### Importing JSON

```typescript
import { importFigmaJSON } from '@thsf2e/figma-create-backend';

// Import JSON data into Figma
await importFigmaJSON(jsonData);
```

### Working with Individual Nodes

```typescript
import { getNodeInfo, cleanExportData } from '@thsf2e/figma-create-backend';

// Get information about a specific node
const nodeInfo = getNodeInfo(someNode);

// Clean and optimize the node data
const cleanData = cleanExportData(nodeInfo);
```

## API Reference

### exportNodes(nodes: SceneNode[], optimize?: boolean): Promise<ExportNodesResult>

Exports Figma nodes to a structured format.

### importFigmaJSON(jsonData: any): Promise<void>

Imports JSON data into Figma, creating corresponding nodes.

### getNodeInfo(node: SceneNode): any

Extracts all relevant information from a Figma node.

### cleanExportData(data: any): any

Cleans and optimizes node data for export.

### getNodeExportImage(nodeId: string): Promise<string | null>

Exports a node as an image in base64 format.

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## License

MIT
