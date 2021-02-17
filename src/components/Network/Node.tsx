import React, { SVGProps } from 'react';

export default ({ ...props }: SVGProps<SVGCircleElement>) => {
  return <circle className="node" {...props} />;
};
