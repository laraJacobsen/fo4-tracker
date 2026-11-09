import type { Entry } from '../types';

/** Small inline markers: unverified "?", missable "!", faction/choice lock. */
export function Badges({ e }: { e: Entry }) {
  return (
    <>
      {e.missable && (
        <span className="badge warn" title="Missable: can be permanently lost">
          !
        </span>
      )}
      {e.lockedBy && (
        <span className="badge" title={`Locked: ${e.lockedBy.note}`}>
          LOCK
        </span>
      )}
      {!e.verified && (
        <span className="badge q" title="Unverified: double-check this in-game">
          ?
        </span>
      )}
    </>
  );
}
