import { createPluginAPI, createUIAPI } from 'figma-jsonrpc';
import { isReactFigmaNode } from './helpers/isReactFigmaNode';
import * as renderers from './renderers';
import { nanoid } from 'nanoid/non-secure';
import { Subject } from 'rxjs';
import { safeGetPluginData } from './helpers/safeGetPluginData';
import { LayoutStyleProperties } from './styleTransformers/transformLayoutStyleProperties';
import { GeometryStyleProperties } from './styleTransformers/transformGeometryStyleProperties';
import { isEqualFontStyle } from './helpers/isEqualFontStyle';
import { CommonStyleProps } from './types';
import { DEFAULT_FONT } from './helpers/constants';

const getInitialTree = node => {
    return {
        id: node.id,
        type: node.type,
        reactId: safeGetPluginData('reactId')(node),
        children:
            node.children && node.children.filter(item => isReactFigmaNode(item)).map(item => getInitialTree(item))
    };
};

const findRoot = (node: any) => {
    if (!node) {
        return;
    }
    const parent = node.parent;
    if (!parent || !isReactFigmaNode(parent)) {
        return node;
    } else {
        return findRoot(parent);
    }
};

const transformNodesToTree = node => {
    if (!isReactFigmaNode(node)) {
        return;
    }
    const nodeBatchId = nanoid();
    node.setPluginData('nodeBatchId', nodeBatchId);
    const children = node.children && node.children.map(transformNodesToTree).filter(item => !!item);
    return {
        width: node.width,
        height: node.height,
        style:
            (safeGetPluginData('reactStyle')(node) && JSON.parse(safeGetPluginData('reactStyle')(node) || '')) ||
            undefined,
        children: children && children.length > 0 ? children : undefined,
        reactId: safeGetPluginData('reactId')(node),
        nodeBatchId
    };
};

const renderInstance = (type, node, props, reactId) => {
    const instance = renderers[type](node)(props);
    if (!node) {
        instance.setPluginData('isReactFigmaNode', 'true');
        instance.setPluginData('reactId', reactId);
    }
    return instance;
};

const cleanStubElements = parentNode => {
    if (parentNode.type === 'GROUP') {
        parentNode.children.forEach(child => {
            if (safeGetPluginData('isGroupStubElement')(child)) {
                child.remove();
            }
        });
    }

    if (parentNode.type === 'COMPONENT_SET') {
        parentNode.children.forEach(child => {
            if (safeGetPluginData('isComponentStubElement')(child)) {
                child.remove();
            }
        });
    }
};

const appendToContainer = (parentNode, childNode) => {
    if (!childNode || !parentNode || parentNode.type === 'INSTANCE') {
        return;
    }

    parentNode.appendChild(childNode);
    cleanStubElements(parentNode);
};

const insertToContainer = (parentNode, newChildNode, beforeChildNode) => {
    if (!parentNode || !newChildNode || !beforeChildNode || parentNode.type === 'INSTANCE') {
        return;
    }
    const beforeChildIndex = parentNode.children.indexOf(beforeChildNode);
    parentNode.insertChild(beforeChildIndex, newChildNode);
    cleanStubElements(parentNode);
};

const cache = {};

const transformToNode = smth => {
    if (!smth) {
        return;
    }
    if (smth.id) {
        return figma.getNodeById(smth.id);
    } else if (smth.reactId) {
        return cache[smth.reactId];
    } else {
        return smth;
    }
};

const findNodeByName = (children, name) => {
    return children && children.find(child => child.name === name || findNodeByName(child.children, name));
};

export const api = createPluginAPI(
    {
        getInitialTree() {
            return getInitialTree(figma.root);
        },

        renderInstance(type, _node, props, tempNode) {
            const node = transformToNode(_node);
            const instance = renderInstance(
                type,
                node,
                props && {
                    ...props,
                    ...(type === 'instance' && props.component ? { component: transformToNode(props.component) } : {}),
                    ...(props.node ? { node: transformToNode(props.node) } : {})
                },
                tempNode.reactId
            );
            cache[tempNode.reactId] = instance;
            uiApi.bindReactIdWithNode(tempNode.reactId, instance.id);
        },

        appendToContainer(_parentNode, _childNode) {
            const parentNode = transformToNode(_parentNode);
            const childNode = transformToNode(_childNode);
            appendToContainer(parentNode, childNode);
        },

        insertToContainer(_parentNode, _newChildNode, _beforeChildNode) {
            const parentNode = transformToNode(_parentNode);
            const newChildNode = transformToNode(_newChildNode);
            const beforeChildNode = transformToNode(_beforeChildNode);
            insertToContainer(parentNode, newChildNode, beforeChildNode);
        },

        async listAvailableFontsAsync() {
            return figma.listAvailableFontsAsync();
        },

        async loadFontAsync(fontName) {
            return figma.loadFontAsync(fontName);
        },

        remove(_childNode) {
            const childNode = transformToNode(_childNode);
            if (!childNode || childNode.removed) {
                return;
            }
            childNode.remove();
        },

        getTreeForYoga(_instance) {
            const node = transformToNode(_instance);
            const root = findRoot(node);
            return transformNodesToTree(root);
        },

        findNodeByName(_node, name) {
            const node = transformToNode(_node);
            const instanceItemNode = findNodeByName(node.children, name);
            return instanceItemNode && getInitialTree(instanceItemNode);
        },

        createImage(data) {
            const image = figma.createImage(data);
            return image.hash;
        },

        setCurrentPage(_node) {
            const node = transformToNode(_node);
            figma.currentPage = node;
        },

        highlightNativeElement(_node) {
            const node = transformToNode(_node);

            if (!node || node.type === 'DOCUMENT') {
                return;
            }

            if (figma.currentPage.selection.includes(node)) {
                return;
            }

            const nodePage = findRoot(node);

            if (figma.currentPage !== nodePage) {
                figma.currentPage = nodePage;
            }

            if (node.type !== 'PAGE') {
                figma.viewport.scrollAndZoomIntoView([node]);
                figma.currentPage.selection = [node];
            }
        },

        async importStyleByKeyAsync(key: string): Promise<BaseStyle> {
            return figma.importStyleByKeyAsync(key);
        },

        createOrUpdatePaintStyle(properties: {
            paints: ReadonlyArray<Paint> | symbol | void;
            params: CommonStyleProps;
        }) {
            const { paints, params } = properties;
            const { name, id, description } = params;
            const foundPaintStyle = figma.getLocalPaintStyles().find(style => style.name === name || style.id === id);
            const paintStyle = foundPaintStyle || figma.createPaintStyle();
            if (name) {
                paintStyle.name = name;
            }
            if (description) {
                paintStyle.description = description;
            }
            if (paints) {
                paintStyle.paints = paints as any;
            }
            return paintStyle.id;
        },

        createOrUpdateTextStyle(properties: { textProperties: any | void; params: CommonStyleProps; loadedFont: any }) {
            const { textProperties = {}, params, loadedFont } = properties;
            const { name, id, description } = params;
            const foundTextStyle = figma.getLocalTextStyles().find(style => style.name === name || style.id === id);
            const textStyle = foundTextStyle || figma.createTextStyle();
            if (name) {
                textStyle.name = name;
            }
            if (description) {
                textStyle.description = description;
            }

            const { fontName = DEFAULT_FONT } = textProperties;
            if (
                loadedFont &&
                fontName &&
                loadedFont.family === fontName.family &&
                isEqualFontStyle(loadedFont.style, fontName.style)
            ) {
                Object.keys(textProperties).forEach(key => {
                    textStyle[key] = textProperties[key];
                });
            }
            return textStyle.id;
        },

        createOrUpdateEffectStyle(properties: {
            effects: ReadonlyArray<Effect> | symbol | void;
            params: CommonStyleProps;
        }) {
            const { effects, params } = properties;
            const { name, id, description } = params;
            const foundEffectStyle = figma.getLocalEffectStyles().find(style => style.name === name || style.id === id);
            const effectStyle = foundEffectStyle || figma.createEffectStyle();
            if (name) {
                effectStyle.name = name;
            }
            if (description) {
                effectStyle.description = description;
            }
            if (effects) {
                effectStyle.effects = effects as any;
            }
            return effectStyle.id;
        }
    },
    {
        timeout: 60 * 1000
    }
);

export const setupMainThread = () => {
    figma.on('currentpagechange', () => {
        const reactId = figma.currentPage.getPluginData('reactId');
        uiApi.currentPageChange(reactId);
    });

    figma.on('selectionchange', () => {
        const reactIds = figma.currentPage.selection.map(safeGetPluginData('reactId'));
        uiApi.selectionChange(reactIds);
    });
};

export const $currentPageTempId = new Subject();

export const $selectionReactIds = new Subject();

export const $updateYogaReactId = new Subject();

export const $bindReactIdWithNodeId = new Subject<[string, string]>();

// those methods will be executed in the Figma UI,
// regardless of where they are called from
export const uiApi = createUIAPI(
    {
        currentPageChange: reactId => {
            $currentPageTempId.next(reactId);
        },
        selectionChange: reactIds => {
            $selectionReactIds.next(reactIds);
        },
        updateYogaNode: reactId => {
            $updateYogaReactId.next(reactId);
        },
        bindReactIdWithNode: (reactId, nodeId) => {
            $bindReactIdWithNodeId.next([reactId, nodeId]);
        }
    },
    {
        timeout: 60 * 1000
    }
);
