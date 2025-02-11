import { baseNodeMixin } from '../mixins/baseNodeMixin';
import { layoutMixin } from '../mixins/layoutMixin';
import { geometryMixin } from '../mixins/geometryMixin';
import { propsAssign } from '../helpers/propsAssign';
import { StarProps } from '../components/star/Star';
import { cornerMixin } from '../mixins/cornerMixin';
import { exportMixin } from '../mixins/exportMixin';
import { blendMixin } from '../mixins/blendMixin';
import { sceneNodeMixin } from '../mixins/sceneNodeMixin';
import { constraintsMixin } from '../mixins/constraintsMixin';

const starNodePropsAssign = propsAssign<StarProps, StarProps>(['pointCount', 'innerRadius']);

export const star = (node: StarNode) => (props: StarProps) => {
    const starNode = node || props.node || figma.createStar();

    baseNodeMixin(starNode)(props);
    layoutMixin(starNode)(props);
    geometryMixin(starNode)(props);
    exportMixin(starNode)(props);
    cornerMixin(starNode)(props);
    blendMixin(starNode)(props);
    starNodePropsAssign(starNode)(props);
    sceneNodeMixin(starNode)(props);
    constraintsMixin(starNode)(props);

    return starNode;
};
