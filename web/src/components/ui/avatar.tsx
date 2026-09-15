import { useState, type CSSProperties, type ReactNode } from 'react'
import { cn, initials, memberColour } from '@/lib/utils'
import type { User } from '@/services/types'

/** Everything drawing a person needs. Anything with these fields will do. */
type Person = Pick<User, 'id' | 'forename' | 'surname' | 'displayName'> & {
  avatarUrl?: string | null
}

/**
 * One person, as a mark.
 *
 * The single place in the application that decides how somebody is drawn, which is
 * what makes a picture possible at all: fifteen call sites each spelled out their own
 * initials over their own `memberColour`, so a photograph would have had to be added
 * to all fifteen, and whichever one was missed would have quietly gone on drawing
 * letters for somebody who has a face.
 *
 * The picture is an improvement on the mark, never a thing the layout waits for.
 * `avatarUrl` is null for everybody today, and nothing fills it in automatically:
 * Active Directory authenticates and holds no photographs, so a picture exists only
 * where somebody has set one. Initials are the ordinary case and will stay the
 * ordinary case, the colour underneath is drawn either way, and an image that fails
 * to load leaves the mark it was covering rather than a hole.
 *
 * Size comes from the caller's own classes, as it did before this existed, because
 * the sizes are not a scale: they are what each surface had room for, from thirteen
 * pixels in a calendar cell to twenty four in the sidebar.
 */
export function Avatar({ user, className, style, title, children }: {
  user: Person
  className?: string
  style?: CSSProperties
  /** Overrides the hover label. Defaults to their full name. */
  title?: string
  /** Replaces the initials, for the rare mark that stands for something else. */
  children?: ReactNode
}) {
  /*
   * A picture that will not load is the same as no picture.
   *
   * Without this the browser draws its own broken-image glyph inside the mark, which
   * is worse than the initials it replaced: the colour is already painted underneath,
   * so falling back costs nothing and looks like nothing happened. Keyed on the
   * address so that replacing a picture gets a fresh attempt rather than inheriting
   * the last one's failure.
   */
  const [broken, setBroken] = useState<string | null>(null)
  const showImage = Boolean(user.avatarUrl) && broken !== user.avatarUrl

  return (
    <span
      title={title ?? user.displayName}
      className={cn('sq overflow-hidden not-italic', className)}
      style={{ background: memberColour(user.id), ...style }}
    >
      {showImage ? (
        <img
          src={user.avatarUrl ?? undefined}
          onError={() => setBroken(user.avatarUrl ?? null)}
          // Decorative: the name it stands for is already beside it or in the title,
          // and a screen reader reading "photograph of André Freitas" next to the
          // words André Freitas says it twice.
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        children ?? initials(user.forename, user.surname)
      )}
    </span>
  )
}
