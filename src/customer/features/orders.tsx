'use client'

import { isApiError } from '@/api-client'
import { type GeoPoint, isAwaitingPrice, mapLink, type OrderDetail, type ServiceId, SERVICE_LABELS } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ClipboardList, FileText, MapPin, PackageCheck, Pill, ShoppingBag, Truck, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PushPrompt } from '@/customer/components/push-prompt'
import { BillSummary, FormError, LoadingNote, PageCard, StatusPill } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useLang } from '@/customer/lib/i18n'
import { usePaths } from '@/customer/lib/paths'
import { errorCode, queryKeys, useOrder, useOrders } from '@/customer/lib/queries'

export const SERVICE_ICONS: Record<ServiceId, typeof Truck> = { bazar: ShoppingBag, shifting: Truck, medicine: Pill, parcel: PackageCheck }

export function OrdersScreen() {
  const paths = usePaths()
  const { t, text, taka, formatDate } = useLang()
  const orders = useOrders()
  const items = orders.data?.pages.flatMap(page => page.items) ?? []

  return (
    <PageCard icon={ClipboardList} title={t('অর্ডার হিস্ট্রি', 'Order history')} subtitle={t('আপনার সব সেবার অর্ডার এক জায়গায়।', 'All your service orders in one place.')}>
      {orders.isPending && <LoadingNote />}
      {orders.isError && <FormError code={errorCode(orders.error)} />}
      {orders.isSuccess && !items.length && <p className="empty-note">{t('এখনো কোনো অর্ডার নেই।', 'No orders yet.')}</p>}
      <div className="order-list">
        {items.map(order => {
          const Icon = SERVICE_ICONS[order.service]
          return (
            <Link className="order-link" href={paths.order(order.id)} key={order.id}>
              <article className="order-card">
                <div className={`order-icon svc-${order.service}`}>
                  <Icon size={18} />
                </div>
                <div className="order-info">
                  <div>
                    <strong>{text(SERVICE_LABELS[order.service])}</strong>
                    <span>{order.code}</span>
                  </div>
                  <p>{order.summary}</p>
                  <small>{formatDate(order.createdAt)}</small>
                </div>
                <div className="order-total">
                  <strong className={isAwaitingPrice(order.service, order.status) ? 'price-coming' : undefined}>
                    {isAwaitingPrice(order.service, order.status) ? t('দাম আসছে', 'Price coming') : taka(order.total)}
                  </strong>
                  <StatusPill status={order.status} />
                </div>
              </article>
            </Link>
          )
        })}
      </div>
      {orders.hasNextPage && (
        <button type="button" className="secondary-button load-more" onClick={() => orders.fetchNextPage()} disabled={orders.isFetchingNextPage}>
          {orders.isFetchingNextPage ? t('লোড হচ্ছে…', 'Loading…') : t('আরো দেখুন', 'Show more')}
        </button>
      )}
    </PageCard>
  )
}

export function OrderDetailScreen({ id }: { id: string }) {
  const paths = usePaths()
  const { t, text } = useLang()
  const order = useOrder(id)

  return (
    <PageCard icon={ClipboardList} title={order.data ? order.data.code : t('অর্ডার', 'Order')} subtitle={order.data ? text(SERVICE_LABELS[order.data.service]) : undefined}>
      <Link href={paths.orders} className="link-button back detail-back">
        <ArrowLeft size={15} />
        {t('অর্ডার হিস্ট্রি', 'Order history')}
      </Link>
      {order.isPending && <LoadingNote />}
      {order.isError && <FormError code={errorCode(order.error)} />}
      {order.data && <OrderDetailBody key={order.data.id} order={order.data} />}
    </PageCard>
  )
}

/** "Map" after an address that has a pin: opens it in the phone's maps app. */
function MapLink({ pin }: { pin: GeoPoint | null }) {
  const { t } = useLang()
  if (!pin) return null
  return (
    <a className="map-link" href={mapLink(pin)} target="_blank" rel="noopener noreferrer">
      <MapPin size={12} />
      {t('ম্যাপ', 'Map')}
    </a>
  )
}

function OrderDetailBody({ order }: { order: OrderDetail }) {
  const { t, text, taka, formatDate, rowNumber } = useLang()
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(order.id),
    onSuccess: updated => {
      queryClient.setQueryData(queryKeys.order(order.id), updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orderList })
    },
  })

  // The customer accepts the staff's prices. If staff sent a newer price meanwhile, the API refuses
  // (order.quote_changed) and the order reloads with the new price to confirm.
  const confirm = useMutation({
    mutationFn: () => api.orders.confirm(order.id, { total: order.total, quoteVersion: order.quoteVersion }),
    onSuccess: updated => {
      queryClient.setQueryData(queryKeys.order(order.id), updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orderList })
    },
    onError: failure => {
      if (isApiError(failure) && failure.code === 'order.quote_changed') void queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) })
    },
  })
  const busy = confirm.isPending || cancel.isPending
  const awaitingPrice = isAwaitingPrice(order.service, order.status)
  // A price that arrived while the page was open (the socket refreshes the order) is pointed out,
  // and an old "price changed" error goes: the card now shows the price to confirm.
  const [seenVersion] = useState(order.quoteVersion)
  const freshQuote = order.canConfirm && order.quoteVersion > seenVersion
  const resetConfirm = confirm.reset
  useEffect(() => resetConfirm(), [order.quoteVersion, resetConfirm])
  const goods: number | string = awaitingPrice ? t('দাম আসছে', 'Price coming') : order.itemsTotal
  const quoteNote = order.events.filter(event => event.to === 'QUOTED').at(-1)?.note

  const billLines: [string, number | string][] =
    order.service === 'bazar'
      ? [
          [t('সর্বমোট বাজারের দাম', 'Total bazar cost'), goods],
          [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), order.serviceFee],
          [t('ডেলিভারী খরচ', 'Delivery charge'), order.deliveryFee],
        ]
      : order.service === 'medicine'
        ? [
            [t('ঔষুধ মূল্য', 'Medicine cost'), goods],
            [t('ডেলিভারী চার্জ', 'Delivery charge'), order.deliveryFee],
          ]
        : order.service === 'shifting'
          ? [
              [t('গাড়ী', 'Vehicle'), order.itemsTotal],
              [t('লেবার ও ফ্লোর', 'Labour and floors'), order.serviceFee],
            ]
          : [[t('ডেলিভারী খরচ', 'Delivery charge'), order.deliveryFee]]

  // Phone: one column. Web: the order on the left, the bill, timeline and cancel beside it.
  return (
    <div className="order-detail">
      <div className="order-detail-main">
        <div className="order-head">
          <StatusPill status={order.status} />
          <small>{formatDate(order.createdAt, true)}</small>
        </div>

        {awaitingPrice && (
          <>
            <p className="quote-notice">
              {t(
                'আমরা দাম যাচাই করছি। দাম জানালেই নোটিফিকেশন পাবেন, তারপর অর্ডারটি কনফার্ম বা বাতিল করতে পারবেন।',
                'We are checking the prices. You will get a notification with the bill, then you can confirm or cancel the order.',
              )}
            </p>
            <PushPrompt />
          </>
        )}

        {order.canConfirm && (
          <section className="quote-card" aria-labelledby="quote-title">
            <h3 id="quote-title">{t('দাম জানানো হয়েছে', 'Your price is ready')}</h3>
            {freshQuote && (
              <p className="quote-fresh" role="status">
                {seenVersion === 0 ? t('দাম এসে গেছে! দেখে কনফার্ম করুন।', 'Your price just arrived. Check it, then confirm.') : t('নতুন দাম এসেছে। বদলানো বিল দেখে কনফার্ম করুন।', 'A new price just arrived. Check the updated bill, then confirm.')}
              </p>
            )}
            <p>{t('নিচের বিল দেখে অর্ডারটি কনফার্ম করুন, অথবা বাতিল করুন। কনফার্ম করার পর দাম আর বদলাবে না।', 'Check the bill below, then confirm or cancel. Once you confirm, the price will not change.')}</p>
            {quoteNote && <p className="quote-note">{quoteNote}</p>}
            <dl className="quote-lines">
              {billLines.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{typeof value === 'number' ? taka(value) : value}</dd>
                </div>
              ))}
            </dl>
            <div className="quote-total">
              <span>{t('মোট বিল', 'Total bill')}</span>
              <strong>{taka(order.total)}</strong>
            </div>
            <FormError code={confirm.isError ? errorCode(confirm.error) : cancel.isError ? errorCode(cancel.error) : null} />
            <div className="quote-actions">
              <button type="button" className="primary-button" disabled={busy} aria-busy={confirm.isPending} onClick={() => confirm.mutate()}>
                <Check size={17} />
                {confirm.isPending ? t('অপেক্ষা করুন…', 'Please wait…') : t('কনফার্ম করুন', 'Confirm')}
              </button>
              <button
                type="button"
                className="secondary-button danger-button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('অর্ডারটি বাতিল করবেন?', 'Cancel this order?'))) cancel.mutate()
                }}
              >
                <X size={16} />
                {t('বাতিল করুন', 'Cancel')}
              </button>
            </div>
          </section>
        )}

        <section className="detail-section">
          <dl className="detail-grid">
            <dt>{t('ডেলিভারি', 'Delivery')}</dt>
            <dd>
              {formatDate(order.scheduledDate)} · {order.scheduledTime}
            </dd>
            {order.address && (
              <>
                <dt>{t('ঠিকানা', 'Address')}</dt>
                <dd>
                  {order.address}
                  <MapLink pin={order.addressPin} />
                </dd>
              </>
            )}
            <dt>{t('মোবা', 'Mobile')}</dt>
            <dd>{order.contactMobile}</dd>
            {order.shifting && (
              <>
                <dt>Loading Area</dt>
                <dd>
                  {order.shifting.loadingArea}
                  <MapLink pin={order.shifting.loadingPin} />
                </dd>
                <dt>Unloading Area</dt>
                <dd>
                  {order.shifting.unloadingArea}
                  <MapLink pin={order.shifting.unloadingPin} />
                </dd>
                <dt>{t('গাড়ী', 'Vehicle')}</dt>
                <dd>
                  {text(order.shifting.vehicleName)} · {taka(order.shifting.vehicleRate)}
                </dd>
                <dt>{t('লেবার', 'Labourers')}</dt>
                <dd>{order.shifting.labourers}</dd>
                <dt>{t('ফ্লোর', 'Floors')}</dt>
                <dd>
                  {order.shifting.loadingFloor} → {order.shifting.unloadingFloor}
                </dd>
              </>
            )}
            {order.parcel && (
              <>
                <dt>{t('পণ্য', 'Product')}</dt>
                <dd>
                  {order.parcel.product}
                  {order.parcel.weight ? ` · ${order.parcel.weight}` : ''}
                </dd>
                <dt>{t('গ্রহণ', 'Pickup')}</dt>
                <dd>
                  {order.parcel.pickupAddress}
                  <MapLink pin={order.parcel.pickupPin} />
                </dd>
                <dt>{t('পৌঁছানো', 'Drop-off')}</dt>
                <dd>
                  {order.parcel.dropoffAddress}
                  <MapLink pin={order.parcel.dropoffPin} />
                </dd>
                <dt>{t('গ্রহীতা', 'Receiver')}</dt>
                <dd>{order.parcel.receiverMobile}</dd>
              </>
            )}
          </dl>
        </section>

        {order.items.length > 0 && (
          <section className="detail-section">
            <ul className="detail-items">
              {order.items.map((item, index) => (
                <li key={item.id}>
                  <span>
                    {rowNumber(index)} {item.name}
                    <small>{[item.quantity, item.variety, item.company, item.category].filter(Boolean).join(' · ')}</small>
                  </span>
                  <strong>{item.price ?? '—'}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        {order.prescription && (
          <section className="detail-section">
            <a className="secondary-button" href={api.uploads.url(order.prescription.id)} target="_blank" rel="noopener noreferrer">
              <FileText size={16} />
              {t('প্রেসক্রিপশন দেখুন', 'View prescription')}
            </a>
          </section>
        )}
      </div>
      <div className="order-detail-side">
        {/* While a price waits for a confirm, the bill is in the price card instead. */}
        {!order.canConfirm && (
          <section className="detail-section">
            <BillSummary
              lines={billLines}
              totalLabel={t('Total Bill', 'Total bill')}
              total={awaitingPrice ? t(`${taka(order.total)} + পণ্যের দাম`, `${taka(order.total)} + goods`) : order.total}
            />
          </section>
        )}

        <section className="detail-section">
          <ol className="timeline">
            {order.events.map(event => (
              <li key={event.id}>
                <StatusPill status={event.to} />
                {event.note && <span className="timeline-note">{event.note}</span>}
                <small>{formatDate(event.createdAt, true)}</small>
              </li>
            ))}
          </ol>
        </section>

        {order.canCancel && !order.canConfirm && (
          <div className="confirm detail-section">
            <FormError code={cancel.isError ? errorCode(cancel.error) : null} />
            <button
              type="button"
              className="secondary-button danger-button"
              disabled={cancel.isPending}
              onClick={() => {
                if (window.confirm(t('অর্ডারটি বাতিল করবেন?', 'Cancel this order?'))) cancel.mutate()
              }}
            >
              <X size={16} />
              {t('অর্ডার বাতিল করুন', 'Cancel order')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
