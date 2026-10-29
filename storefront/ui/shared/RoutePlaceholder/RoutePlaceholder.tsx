import { Wrapper } from './RoutePlaceholder.styles';

/** Temporary stub for routes that are not converted (or out of module). */
export function RoutePlaceholder({ route }: { route: string }) {
  return <Wrapper>Route: {route}</Wrapper>;
}
