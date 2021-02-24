import React, { SVGProps } from 'react';

export default function Svg(props: SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" {...props} />;
}
