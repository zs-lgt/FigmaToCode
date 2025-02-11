import { baseNodeMixin } from '../mixins/baseNodeMixin';
import { layoutMixin } from '../mixins/layoutMixin';
import { geometryMixin } from '../mixins/geometryMixin';
import { saveStyleMixin } from '../mixins/saveStyleMixin';
import { cornerMixin } from '../mixins/cornerMixin';
import { exportMixin } from '../mixins/exportMixin';
import { blendMixin } from '../mixins/blendMixin';

import { propsAssign } from '../helpers/propsAssign';
import { VectorProps } from '../components/vector/Vector';
import { sceneNodeMixin } from '../mixins/sceneNodeMixin';
import { constraintsMixin } from '../mixins/constraintsMixin';

const vectorNodePropsAssign = propsAssign<VectorProps, VectorProps>([
    'vectorPaths',
    'vectorNetwork',
    'handleMirroring'
]);

export const vector = (node: VectorNode) => (props: VectorProps) => {
    const vectorNode = node || props.node || figma.createVector();

    baseNodeMixin(vectorNode)(props);
    saveStyleMixin(vectorNode)(props);
    layoutMixin(vectorNode)(props);
    geometryMixin(vectorNode)(props);
    cornerMixin(vectorNode)(props);
    exportMixin(vectorNode)(props);
    blendMixin(vectorNode)(props);
    vectorNodePropsAssign(vectorNode)(props);
    sceneNodeMixin(vectorNode)(props);
    constraintsMixin(vectorNode)(props);

    return vectorNode;
};
