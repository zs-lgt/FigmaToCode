/// <reference types="@figma/plugin-typings" />

export interface PluginSettings {
  isCodeGenerationEnabled: boolean;
  isFlowchartMode: boolean;
  isAnnotationsVisible: boolean;
}

export const defaultPluginSettings: PluginSettings = {
  isCodeGenerationEnabled: true,
  isFlowchartMode: false,
  isAnnotationsVisible: true,
};

export type AnnotationType = "text" | "hotspot";

export interface AnnotationGroup {
  node: SceneNode;
  number: number;
  type: "annotation" | "source" | "hotspot-annotation";
}

export interface DeletedNode {
  id: string;
  name: string;
  type: string;
} 