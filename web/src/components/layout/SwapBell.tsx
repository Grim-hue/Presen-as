import { ArrowRight, Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Empty } from '@/components/layout/Feedback'
import { SwapRow, SwapSection } from '@/components/swaps/SwapRow'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useSwaps } from '@/context/SwapContext'
import { errorText } from '@/lib/useAsync'
import { cn } from '@/lib/utils'
import { swaps as swapsApi } from '@/services'

/**
 * The bell: what is waiting for an answer, and nothing else.
 *
 * The record of everything already settled used to sit under these two lists. It
 * only ever grew, it could not be acted on, and behind a bell it was somewhere
 * nobody would think to look for it. It lives on its own page now, and the line at
 * the foot of this window is the way there.
 */
export function SwapBell() {
  const { incoming, outgoing, pending, reload } = useSwaps()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const waiting = incoming.filter((r) => r.status === 'PENDING')
  const sent = outgoing.filter((r) => r.status === 'PENDING')

  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await work()
      toast.success(done)
    } catch (e) {
      // A request can go stale between being listed and being answered, and the
      // sentence the API returns says which way. Reload either way.
      toast.error(errorText(e))
    } finally {
      setBusy(false)
      reload()
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Trocas"
        aria-label={pending > 0 ? `Trocas, ${pending} por responder` : 'Trocas'}
        className={cn(
          'relative flex h-[31px] items-center rounded border border-line px-2.5',
          'text-fg-muted hover:bg-[var(--hover2)] hover:text-fg-strong',
          pending > 0 && 'border-accent text-fg-strong'
        )}
      >
        <Bell size={15} strokeWidth={1.6} className={cn(pending > 0 && 'text-accent')} />
        {/* On the corner rather than beside the bell: a number in the row reads as a
            second label in a header full of them, and this one is meant to be the
            thing the eye catches. The count is in the label above, so the bubble
            itself is decoration to a reader. */}
        {pending > 0 && (
          <span
            aria-hidden
            className="absolute -right-[7px] -top-[7px] flex h-[17px] min-w-[17px] animate-rise
                       items-center justify-center rounded-full border-2 border-bg bg-accent px-[3px]
                       font-mono text-[9.5px] font-semibold leading-none text-accent-fg"
          >
            {pending > 9 ? '9+' : pending}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Trocas" width={520}>
        {waiting.length === 0 && sent.length === 0 ? (
          <Empty title="Nada por responder." hint="As trocas já resolvidas estão em Trocas." />
        ) : (
          <div className="flex flex-col gap-4">
            {waiting.length > 0 && (
              <SwapSection title="RECEBIDOS">
                {waiting.map((r) => (
                  <SwapRow
                    key={r.id}
                    request={r}
                    other={r.requester}
                    give={r.target}
                    take={r.requester}
                    actions={
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          disabled={busy}
                          onClick={() => act(() => swapsApi.approve(r.id), 'Troca aceite.')}
                        >
                          ACEITAR
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => act(() => swapsApi.reject(r.id), 'Troca recusada.')}
                        >
                          RECUSAR
                        </Button>
                      </>
                    }
                  />
                ))}
              </SwapSection>
            )}

            {sent.length > 0 && (
              <SwapSection title="ENVIADOS">
                {sent.map((r) => (
                  <SwapRow
                    key={r.id}
                    request={r}
                    other={r.target}
                    give={r.requester}
                    take={r.target}
                    actions={
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => act(() => swapsApi.cancel(r.id), 'Pedido cancelado.')}
                      >
                        CANCELAR
                      </Button>
                    }
                  />
                ))}
              </SwapSection>
            )}
          </div>
        )}

        {/* The way to everything this window no longer carries. It shows even with
            nothing waiting, because an empty inbox is exactly when somebody is
            looking for the trade they already made. */}
        <Link
          to="/trocas"
          onClick={() => setOpen(false)}
          className="mt-4 flex items-center gap-1.5 border-t border-line-soft pt-3 font-mono
                     text-[11px] tracking-[0.06em] text-fg-muted hover:text-fg-strong"
        >
          VER TODAS AS TROCAS
          <ArrowRight size={13} strokeWidth={1.6} />
        </Link>
      </Dialog>
    </>
  )
}
