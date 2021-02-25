import React, { HTMLProps } from 'react';

export default function Button(props: HTMLProps<HTMLButtonElement>) {
  // @ts-ignore
  return <button type="button" {...props} />;
}
