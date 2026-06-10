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
  FocusModal,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

// Widget: add a brand-new line item to an order that is already in the mySTOCK
// WMS but not yet dispatched. Calls POST /admin/dextrum/orders/:id/items, which
// PUTs the new item to mySTOCK (orderIncoming update). Only works while the WMS
// order status is still "Nezahájena".
function DextrumAddItemWidget({ data: order }: { data: any }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [sku, setSku] = useState("")
  const [qty, setQty] = useState("1")
  const [name, setName] = useState("")

  const addItem = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch(`/admin/dextrum/orders/${order.id}/items`, {
        method: "POST",
        body: {
          items: [
            {
              product_code: sku.trim(),
              quantity: Number(qty),
              product_name: name.trim() || undefined,
            },
          ],
        },
      })
    },
    onSuccess: (res: any) => {
      const codes = (res?.added || []).map((a: any) => `${a.productId} ×${a.quantity}`).join(", ")
      toast.success(`Položka přidána do WMS objednávky${codes ? `: ${codes}` : ""}`)
      setOpen(false)
      setSku("")
      setQty("1")
      setName("")
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["order", order.id] })
    },
    onError: (err: any) => {
      const detail = err?.message || "Neznámá chyba"
      toast.error(`Přidání položky selhalo: ${detail}`)
    },
  })

  const canSubmit = sku.trim().length > 0 && Number(qty) > 0 && !addItem.isPending

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Dextrum WMS</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Přidat položku do již importované objednávky (jen dokud není expedována)
          </Text>
        </div>
        <FocusModal open={open} onOpenChange={setOpen}>
          <FocusModal.Trigger asChild>
            <Button size="small" variant="secondary">
              Přidat položku
            </Button>
          </FocusModal.Trigger>
          <FocusModal.Content>
            <FocusModal.Header>
              <Button
                size="small"
                disabled={!canSubmit}
                isLoading={addItem.isPending}
                onClick={() => addItem.mutate()}
              >
                Přidat do WMS
              </Button>
            </FocusModal.Header>
            <FocusModal.Body className="flex flex-col items-center py-16">
              <div className="flex w-full max-w-lg flex-col gap-y-6">
                <div className="flex flex-col gap-y-1">
                  <Heading level="h2">Přidat položku do WMS objednávky</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    {order.display_id ? `Objednávka #${order.display_id}` : order.id}
                  </Text>
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    SKU (kód sortimentu) *
                  </Label>
                  <Input
                    placeholder="např. LLWJK7824627392"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Množství *
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus">
                    Název (volitelně)
                  </Label>
                  <Input
                    placeholder="např. Laat Los Wat Je Kapotmaakt"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <Text size="small" className="text-ui-fg-subtle">
                  Funguje jen pokud je WMS objednávka ve stavu „Nezahájena". Po
                  vytvoření expedice mySTOCK úpravu odmítne.
                </Text>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default DextrumAddItemWidget
