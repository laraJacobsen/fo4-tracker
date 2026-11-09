import type { World } from '../types';

interface Props {
  world: World;
  focus?: { id: string; place: boolean };
  onFocusHandled: () => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onJump: (id: string) => void;
}

export function MapScreen({ world }: Props) {
  return <div className="empty">MAP ({world.toUpperCase()}) COMING NEXT</div>;
}
