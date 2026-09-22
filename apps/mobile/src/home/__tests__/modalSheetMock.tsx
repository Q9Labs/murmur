import type { ReactNode } from "react";

export function ModalSheet({
  children,
  open,
  title,
}: {
  children?: ReactNode;
  open: boolean;
  title: string;
}): ReactNode {
  return open ? <section><h1>{title}</h1>{children}</section> : null;
}
