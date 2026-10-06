import { Screen } from "../design/slots";
import { useAuth } from "../features/auth";
import { MediaDetailPanel } from "../features/media";

/**
 * Media detail (M4): poster, metadata, KP rating, reviews and own review form.
 */
export function MediaScreen({ id }: { id: string }) {
  const { user } = useAuth();
  return (
    <Screen title="Фильм">
      <MediaDetailPanel mediaId={id} currentUserId={user?.id ?? null} />
    </Screen>
  );
}
