'use client'

import { type OrderDetail, type ServiceId, SERVICE_LABELS } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList, FileText, PackageCheck, Pill, ShoppingBag, Truck, X } from 'lucide-react'
import Link from 'next/link'

import { BillSummary, FormError, LoadingNote, PageCard, StatusPill } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, queryKeys, useOrder, useOrders } from '@/customer/lib/queries'

export const SERVICE_ICONS: Record<ServiceId, typeof Truck> = { bazar: ShoppingBag, shifting: Truck, medicine: Pill, parcel: PackageCheck }

export function OrdersScreen() {
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
            <Link className="order-link" href={`/orders/${order.id}`} key={order.id}>
              <article className="order-card">
                <div className="order-icon">
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
                  <strong>{taka(order.total)}</strong>
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
  const { t, text } = useLang()
  const order = useOrder(id)

  return (
    <PageCard icon={ClipboardList} title={order.data ? order.data.code : t('অর্ডার', 'Order')} subtitle={order.data ? text(SERVICE_LABELS[order.data.service]) : undefined}>
      <Link href="/orders" className="link-button back detail-back">
        <ArrowLeft size={15} />
        {t('অর্ডার হিস্ট্রি', 'Order history')}
      </Link>
      {order.isPending && <LoadingNote />}
      {order.isError && <FormError code={errorCode(order.error)} />}
      {order.data && <OrderDetailBody order={order.data} />}
    </PageCard>
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

  const billLines: [string, number][] =
    order.service === 'bazar'
      ? [
          [t('সর্বমোট বাজারের দাম', 'Total bazar cost'), order.itemsTotal],
          [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), order.serviceFee],
          [t('ডেলিভারী খরচ', 'Delivery charge'), order.deliveryFee],
        ]
      : order.service === 'medicine'
        ? [
            [t('ঔষুধ মূল্য', 'Medicine cost'), order.itemsTotal],
            [t('ডেলিভারী চার্জ', 'Delivery charge'), order.deliveryFee],
          ]
        : order.service === 'shifting'
          ? [
              [t('গাড়ী', 'Vehicle'), order.itemsTotal],
              [t('লেবার ও ফ্লোর', 'Labour and floors'), order.serviceFee],
            ]
          : [[t('ডেলিভারী খরচ', 'Delivery charge'), order.deliveryFee]]

  return (
    <>
      <div className="order-head">
        <StatusPill status={order.status} />
        <small>{formatDate(order.createdAt, true)}</small>
      </div>

      <section className="detail-section">
        <dl className="detail-grid">
          <dt>{t('ডেলিভারি', 'Delivery')}</dt>
          <dd>
            {formatDate(order.scheduledDate)} · {order.scheduledTime}
          </dd>
          {order.address && (
            <>
              <dt>{t('ঠিকানা', 'Address')}</dt>
              <dd>{order.address}</dd>
            </>
          )}
          <dt>{t('মোবা', 'Mobile')}</dt>
          <dd>{order.contactMobile}</dd>
          {order.shifting && (
            <>
              <dt>Loading Area</dt>
              <dd>{order.shifting.loadingArea}</dd>
              <dt>Unloading Area</dt>
              <dd>{order.shifting.unloadingArea}</dd>
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
              <dd>{order.parcel.pickupAddress}</dd>
              <dt>{t('পৌঁছানো', 'Drop-off')}</dt>
              <dd>{order.parcel.dropoffAddress}</dd>
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

      <section className="detail-section">
        <BillSummary lines={billLines} totalLabel={t('Total Bill', 'Total bill')} total={order.total} />
      </section>

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

      {order.canCancel && (
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
    </>
  )
}
