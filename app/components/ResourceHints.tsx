import { Fragment } from "react";

interface ResourceHintsProps {
  hints: string[];
}

export function ResourceHints({ hints }: ResourceHintsProps) {
  return (
    <Fragment>
      {hints.map((hint, index) => (
        <link key={index} rel="preload" href={hint} as="script" />
      ))}
    </Fragment>
  );
}