import { HTMLProps } from "react";

export default function Button({
  type = "button",
  ...props
}: HTMLProps<HTMLButtonElement>) {
  // @ts-ignore
  return <button type={type} {...props} />;
}
