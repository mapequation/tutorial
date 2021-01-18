import React from 'react';

export default ({ r, cx, cy, ...props }) => {
  return <circle r={r} cx={cx} cy={cy} className="node" {...props} />;
};
