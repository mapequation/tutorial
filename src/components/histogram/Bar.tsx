import React, { SVGProps } from 'react';

export default function Bar(props: SVGProps<SVGRectElement>) {
  return <rect width={10} rx={2} {...props} />;
}
