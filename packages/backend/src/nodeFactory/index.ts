import {
  CanvasNodeCreator,
  ComponentNodeCreator,
  DocumentNodeCreator,
  EllipseNodeCreator,
  FrameNodeCreator,
  GroupNodeCreator,
  InstanceNodeCreator,
  RectangleNodeCreator,
  TextNodeCreator,
  VectorNodeCreator,
  BooleanOperationNodeCreator,
} from './nodeCreator';

import type { NodeCreator } from './baseNodeCreator'

export { NodeCreator };

// Factory for creating nodes
export class NodeFactory {
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
