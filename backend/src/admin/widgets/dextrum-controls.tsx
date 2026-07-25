// @ts-nocheck
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useState } from "react"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Text,
  Textarea,
  Badge,
  FocusModal,
  toast,
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

// Dextrum WMS control tools — cancel / edit / live status / tracking.
// BUILT BUT INACTIVE: the card renders the buttons disabled until the backend
// flag DEXTRUM_CONTROLS_ENABLED=true is set. While inactive, no button reaches
// the Dextrum/mySTOCK API (the routes themselves also return 503).
function DextrumControlsWidget({ data: order }: { data: any }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [pickup, setPickup] = useState("")
  const [note, setNote] = useState("")

  // Is the feature active? While off, everything stays disabled.
  const { data: flag } = useQuery({
    queryKey: ["dextrum-controls-status"],
    queryFn: () => sdk.client.fetch<{ enabled: boolean }>("/admin/dextrum/controls-status", { method: "GET" }),
  })
  const enabled = !!flag?.enabled

  const call = (path: string, method: string, body?: any) =>
    sdk.client.fetch(`/admin/dextrum/orders/${order.id}/${path}`, { method, body })

  const status = useMutation({
    mutationFn: () => call("wms-status", "GET"),
    onSuccess: (r: any) => toast.success(`WMS stav: ${r?.wms?.state ?? r?.local_status ?? "?"}`),
    onError: (e: any) => toast.error(e?.message || "Chyba"),
  })
  const tracking = useMutation({
    mutationFn: () => call("tracking", "GET"),
    onSuccess: (r: any) => toast.success(`Tracking: ${r?.tracking_number || "—"} (${r?.carrier_name || "?"})`),
    onError: (e: any) => toast.error(e?.message || "Chyba"),
  })
  const cancel = useMutation({
    mutationFn: () => call("cancel", "POST"),
    onSuccess: () => {
      toast.success("Objednávka zrušena ve WMS")
      queryClient.invalidateQueries({ queryKey: ["order", order.id] })
    },
    onError: (e: any) => toast.error(e?.message || "Chyba"),
  })
  const edit = useMutation({
    mutationFn: () =>
      call("edit", "POST", {
        pickup_place_code: pickup.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Objednávka upravena ve WMS")
      setEditOpen(false)
      setPickup("")
      setNote("")
      queryClient.invalidateQueries({ queryKey: ["order", order.id] })
    },
    onError: (e: any) => toast.error(e?.message || "Chyba"),
  })

  const busy = status.isPending || tracking.isPending || cancel.isPending || edit.isPending
  const off = !enabled || busy

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h2">Dextrum — ovládání zásilky</Heading>
            {!enabled && <Badge size="2xsmall" color="grey">Neaktivní</Badge>}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {enabled
              ? "Zrušit, editovat, živý stav a tracking (funguje jen do expedice)"
              : "Nástroje jsou připravené, ale vypnuté (aktivace přes DEXTRUM_CONTROLS_ENABLED)"}
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" disabled={off} isLoading={status.isPending} onClick={() => status.mutate()}>
            Živý stav
          </Button>
          <Button size="small" variant="secondary" disabled={off} isLoading={tracking.isPending} onClick={() => tracking.mutate()}>
            Tracking
          </Button>
          <FocusModal open={editOpen} onOpenChange={setEditOpen}>
            <FocusModal.Trigger asChild>
              <Button size="small" variant="secondary" disabled={off}>Editovat</Button>
            </FocusModal.Trigger>
            <FocusModal.Content>
              <FocusModal.Header>
                <Button size="small" disabled={off || (!pickup.trim() && !note.trim())} isLoading={edit.isPending} onClick={() => edit.mutate()}>
                  Uložit do WMS
                </Button>
              </FocusModal.Header>
              <FocusModal.Body className="flex flex-col items-center py-16">
                <div className="flex w-full max-w-lg flex-col gap-y-6">
                  <div className="flex flex-col gap-y-1">
                    <Heading level="h2">Editovat WMS objednávku</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      {order.display_id ? `Objednávka #${order.display_id}` : order.id}
                    </Text>
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">Kód výdejního místa (Packeta / Zásilkovna)</Label>
                    <Input placeholder="např. 12345" value={pickup} onChange={(e) => setPickup(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">Poznámka</Label>
                    <Textarea placeholder="Poznámka pro sklad" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <Text size="small" className="text-ui-fg-subtle">
                    Funguje jen dokud je objednávka „Nezahájena". Po expedici mySTOCK úpravu odmítne.
                  </Text>
                </div>
              </FocusModal.Body>
            </FocusModal.Content>
          </FocusModal>
          <Button
            size="small"
            variant="danger"
            disabled={off}
            isLoading={cancel.isPending}
            onClick={() => { if (window.confirm("Opravdu zrušit objednávku ve WMS?")) cancel.mutate() }}
          >
            Zrušit
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default DextrumControlsWidget
