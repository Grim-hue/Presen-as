import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { User } from '@/services/types'

/**
 * A row of member marks, overlapped, with the overflow counted at the end.
 *
 * From Magic UI, ported rather than pasted. Not for `BorderBeam`'s reason — that one
 * needed Tailwind v4 utilities this project cannot compile, and this file is plain v3
 * — but because upstream is a different component wearing the same name. It takes
 * `avatarUrls: { imageUrl, profileUrl }[]`, wraps each face in an `<a>` to a profile
 * page, and paints the overflow chip `bg-black` / `dark:bg-white` with a
 * `border-white` ring. This application has no avatar images, no profile pages, and
 * no black or white that belongs to it: the palette is tokens, and a hardcoded pair
 * is wrong in one of the two themes by construction.
 *
 * What survives the port is the idea — overlapping marks with the overflow counted at
 * the end — over the one way this application already draws a person: the `.sq` mark
 * carrying their initials on `memberColour(id)`.
 * *
 * It draws people through `Avatar`, which is the one place that knows whether a
 * person has a picture or only initials.
 */
export function AvatarCircles({ users, limit = 12, size = 15, className }: {
  users: User[]
  /** How many marks the box has room for. The rest become the count. */
  limit?: number
  size?: number
  className?: string
}) {
  const shown = users.slice(0, limit)
  const over = users.length - shown.length

  return (
    <div className={cn('flex items-center -space-x-1', className)}>
      {shown.map((user) => (
        <Avatar
          key={user.id}
          user={user}
          className="shrink-0 ring-1 ring-card"
          style={{ width: size, height: size, fontSize: size * 0.44 }}
        />
      ))}
      {/* The overflow chip is the same mark in the page's own tokens rather than in
          somebody's colour, because it stands for people rather than being one. */}
      {over > 0 && (
        <span
          title={`mais ${over}`}
          className="sq shrink-0 bg-elev text-fg-muted ring-1 ring-card"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          +{over}
        </span>
      )}
    </div>
  )
}
