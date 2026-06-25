import { HTMLProps } from "react";

/**
 * Simple wrapper around an HTML button element. Provides a minimal styled
 * interface for demo controls.
 */
export default function Button({
  type = "button",
  ...props
}: HTMLProps<HTMLButtonElement>) {
  // @ts-ignore
  return <button type={type} {...props} />;
}
