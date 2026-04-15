import { HttpTypes } from "@medusajs/types"
import { Table, Text } from "@medusajs/ui"

import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import Thumbnail from "@modules/products/components/thumbnail"
import { convertToLocale } from "@lib/util/money"
import { getBundleBookLabel } from "@lib/util/bundle-quantity"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  /**
   * Currency code from the order — needed so we can price from the order line
   * item itself instead of the live variant catalog (which may have drifted).
   */
  currencyCode?: string
}

const Item = ({ item, currencyCode }: ItemProps) => {
  // Loslatenboek bundle SKUs encode N books into one line item (quantity=1).
  // Show "2 boeken" instead of "1x" so the customer doesn't think they only
  // received a single book.
  const sku = (item as any).variant_sku || item.variant?.sku || null
  const bundleLabel = getBundleBookLabel(sku, item.quantity || 1, "nl")

  // For placed orders we have `currencyCode` — trust the line item's own
  // `unit_price` / `total` (what the customer actually paid). This avoids
  // mismatches with the catalog price if the variant price was updated after
  // the order was placed, or if the bundle has a promo-adjusted price.
  const hasOrderCurrency = !!currencyCode
  const unitPrice = (item as any).unit_price
  const lineTotal =
    (item as any).total ??
    ((item as any).unit_price != null
      ? (item as any).unit_price * (item.quantity || 1)
      : undefined)

  return (
    <Table.Row className="w-full" data-testid="product-row">
      <Table.Cell className="!pl-0 p-4 w-24">
        <div className="flex w-16">
          <Thumbnail thumbnail={item.thumbnail} size="square" />
        </div>
      </Table.Cell>

      <Table.Cell className="text-left">
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-name"
        >
          {item.title}
        </Text>
        {bundleLabel ? (
          <Text className="text-ui-fg-subtle txt-small">Aantal: {bundleLabel}</Text>
        ) : (
          item.variant && (
            <LineItemOptions variant={item.variant} data-testid="product-variant" />
          )
        )}
      </Table.Cell>

      <Table.Cell className="!pr-0">
        <span className="!pr-0 flex flex-col items-end h-full justify-center">
          <span className="flex gap-x-1 ">
            <Text className="text-ui-fg-muted">
              <span data-testid="product-quantity">
                {bundleLabel ? bundleLabel : `${item.quantity}x`}
              </span>
              {!bundleLabel && " "}
            </Text>
            {hasOrderCurrency && unitPrice != null ? (
              <Text className="text-ui-fg-muted" data-testid="product-unit-price">
                {convertToLocale({ amount: unitPrice, currency_code: currencyCode! })}
              </Text>
            ) : (
              <LineItemUnitPrice item={item} style="tight" />
            )}
          </span>

          {hasOrderCurrency && lineTotal != null ? (
            <Text className="text-ui-fg-subtle" data-testid="product-price">
              {convertToLocale({ amount: lineTotal, currency_code: currencyCode! })}
            </Text>
          ) : (
            <LineItemPrice item={item} style="tight" />
          )}
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
