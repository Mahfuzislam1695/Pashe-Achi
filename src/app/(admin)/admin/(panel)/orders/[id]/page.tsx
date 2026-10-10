'use client'

import {
  BILL_EDITABLE,
  type MessageCode,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type OrderDetail,
  type OrderStatus,
  SERVICE_LABELS,
  toAmount,
  updateOrderItemsSchema,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, FileText, Phone, Save } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AuditFeed } from '@/admin/components/audit-feed'
import { Button, Card, Empty, ErrorNote, Field, Input, Loading, StatusBadge, Table, Td, Textarea, Th } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useOrder, useOrderHistory } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useLang()
  const order = useOrder(id)
  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" />
        {t('সব অর্ডার', 'All orders')}
      </Link>
      {order.isPending && <Loading />}
      <ErrorNote code={order.isError ? errorCode(order.error) : null} />
      {order.data && <OrderView order={order.data} />}
    </>
  )
}

function OrderView({ order }: { order: OrderDetail }) {
  const { t, text, taka, formatDate } = useLang()
  const queryClient = useQueryClient()
  const onUpdated = (updated: OrderDetail) => {
    queryClient.setQueryData(queryKeys.order(order.id), updated)
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold">{order.code}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {text(SERVICE_LABELS[order.service])} · {t('অর্ডারের সময়', 'Placed')} {formatDate(order.createdAt, true)}
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{taka(order.total)}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="grid min-w-0 content-start gap-5">
          <Card title={t('অর্ডারের বিবরণ', 'Order details')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">{t('ডেলিভারি', 'Delivery')}</dt>
              <dd className="font-medium">
                {formatDate(order.scheduledDate)} · {order.scheduledTime}
              </dd>
              {order.address && (
                <>
                  <dt className="text-muted">{t('ঠিকানা', 'Address')}</dt>
                  <dd className="font-medium">{order.address}</dd>
                </>
              )}
              <dt className="text-muted">{t('যোগাযোগ', 'Contact')}</dt>
              <dd>
                <a href={`tel:${order.contactMobile}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                  <Phone className="size-3.5" />
                  {order.contactMobile}
                </a>
              </dd>
              {order.shifting && (
                <>
                  <dt className="text-muted">Loading Area</dt>
                  <dd className="font-medium">
                    {order.shifting.loadingArea} · {t('ফ্লোর', 'floor')} {order.shifting.loadingFloor}
                  </dd>
                  <dt className="text-muted">Unloading Area</dt>
                  <dd className="font-medium">
                    {order.shifting.unloadingArea} · {t('ফ্লোর', 'floor')} {order.shifting.unloadingFloor}
                  </dd>
                  <dt className="text-muted">{t('গাড়ী', 'Vehicle')}</dt>
                  <dd className="font-medium">
                    {text(order.shifting.vehicleName)} · {taka(order.shifting.vehicleRate)}
                  </dd>
                  <dt className="text-muted">{t('লেবার', 'Labourers')}</dt>
                  <dd className="font-medium">
                    {order.shifting.labourers} × {taka(order.shifting.wagePerLabourer)}
                  </dd>
                </>
              )}
              {order.parcel && (
                <>
                  <dt className="text-muted">{t('পণ্য', 'Product')}</dt>
                  <dd className="font-medium">
                    {order.parcel.product}
                    {order.parcel.weight ? ` · ${order.parcel.weight}` : ''}
                  </dd>
                  <dt className="text-muted">{t('গ্রহণ', 'Pickup')}</dt>
                  <dd className="font-medium">{order.parcel.pickupAddress}</dd>
                  <dt className="text-muted">{t('পৌঁছানো', 'Drop-off')}</dt>
                  <dd className="font-medium">{order.parcel.dropoffAddress}</dd>
                  <dt className="text-muted">{t('গ্রহীতা', 'Receiver')}</dt>
                  <dd>
                    <a href={`tel:${order.parcel.receiverMobile}`} className="font-medium text-brand-700 hover:underline">
                      {order.parcel.receiverMobile}
                    </a>
                  </dd>
                </>
              )}
              {order.note && (
                <>
                  <dt className="text-muted">{t('নোট', 'Note')}</dt>
                  <dd className="font-medium">{order.note}</dd>
                </>
              )}
            </dl>
          </Card>

          {order.items.length > 0 && <ItemsCard order={order} onUpdated={onUpdated} />}

          {order.prescription && (
            <Card
              title={t('প্রেসক্রিপশন', 'Prescription')}
              actions={
                <a href={api.uploads.url(order.prescription.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                  <ExternalLink className="size-4" />
                  {t('নতুন ট্যাবে খুলুন', 'Open in new tab')}
                </a>
              }
            >
              {order.prescription.mime.startsWith('image/') && order.prescription.mime !== 'image/heic' ? (
                // A plain <img>: the file is served by the API behind the admin cookie, not a static asset.
                <img src={api.uploads.url(order.prescription.id)} alt={order.prescription.originalName} className="max-h-[480px] rounded-lg border border-line object-contain" />
              ) : (
                <p className="inline-flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-muted" />
                  {order.prescription.originalName}
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <Card title={t('গ্রাহক', 'Customer')}>
            {order.customer && (
              <div className="grid gap-1 text-sm">
                <Link href={`/admin/customers/${order.customer.id}`} className="font-semibold text-brand-700 hover:underline">
                  {order.customer.name}
                </Link>
                <a href={`tel:${order.customer.mobile}`} className="text-muted tabular-nums hover:underline">
                  {order.customer.mobile}
                </a>
              </div>
            )}
          </Card>
          <StatusCard order={order} onUpdated={onUpdated} />
          <Card title={t('বিল', 'Bill')}>
            <dl className="grid gap-1.5 text-sm">
              {order.itemsTotal > 0 && <BillRow label={order.service === 'shifting' ? t('গাড়ী', 'Vehicle') : t('পণ্যের দাম', 'Items')} value={taka(order.itemsTotal)} />}
              {order.serviceFee > 0 && <BillRow label={order.service === 'shifting' ? t('লেবার ও ফ্লোর', 'Labour and floors') : t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee')} value={taka(order.serviceFee)} />}
              {order.deliveryFee > 0 && <BillRow label={t('ডেলিভারী খরচ', 'Delivery charge')} value={taka(order.deliveryFee)} />}
              <div className="mt-1 flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
                <dt>{t('মোট', 'Total')}</dt>
                <dd className="tabular-nums">{taka(order.total)}</dd>
              </div>
            </dl>
          </Card>
          <HistoryCard orderId={order.id} />
        </div>
      </div>
    </div>
  )
}

/** Everything that happened to this order, oldest first: placed, each status change and bill correction, and who did it. */
function HistoryCard({ orderId }: { orderId: string }) {
  const { t } = useLang()
  const history = useOrderHistory(orderId)
  return (
    <Card title={t('ইতিহাস', 'History')}>
      {history.isPending && <Loading />}
      <ErrorNote code={history.isError ? errorCode(history.error) : null} />
      {history.isSuccess && (history.data.length ? <AuditFeed entries={history.data} showEntity={false} /> : <Empty>{t('এখনো কিছু নেই।', 'Nothing yet.')}</Empty>)}
    </Card>
  )
}

const BillRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-muted">{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
)

/** The next statuses this order may move to, with an optional note that the customer sees. */
function StatusCard({ order, onUpdated }: { order: OrderDetail; onUpdated: (order: OrderDetail) => void }) {
  const { t, text } = useLang()
  const [note, setNote] = useState('')
  const next = ORDER_TRANSITIONS[order.status]
  const update = useMutation({
    mutationFn: (status: OrderStatus) => api.orders.updateStatus(order.id, { status, note: note.trim() || undefined }),
    onSuccess: (updated, status) => {
      onUpdated(updated)
      setNote('')
      toast.success(t(`অবস্থা: ${text(ORDER_STATUS_LABELS[status])}`, `Status: ${text(ORDER_STATUS_LABELS[status])}`), {
        description: t('গ্রাহককে জানানো হয়েছে।', 'The customer has been notified.'),
      })
    },
  })

  return (
    <Card title={t('অবস্থা বদলান', 'Update status')}>
      {next.length === 0 ? (
        <p className="text-sm text-muted">{t('এই অর্ডার শেষ হয়েছে।', 'This order is finished.')}</p>
      ) : (
        <div className="grid gap-3">
          <Field label={t('গ্রাহকের জন্য নোট (ঐচ্ছিক)', 'Note for the customer (optional)')}>
            <Textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('যেমন: রাইডার ৩০ মিনিটে পৌঁছাবে', 'e.g. The rider will arrive in 30 minutes')} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {next.map(status => (
              <Button
                key={status}
                variant={status === 'CANCELLED' ? 'danger' : 'primary'}
                size="sm"
                loading={update.isPending && update.variables === status}
                disabled={update.isPending}
                onClick={() => {
                  if (status === 'CANCELLED' && !window.confirm(t('অর্ডারটি বাতিল করবেন?', 'Cancel this order?'))) return
                  update.mutate(status)
                }}
              >
                {text(ORDER_STATUS_LABELS[status])}
              </Button>
            ))}
          </div>
          <ErrorNote code={update.isError ? errorCode(update.error) : null} />
        </div>
      )}
    </Card>
  )
}

/** Line items; bazar and medicine prices can be corrected until the order is finished. */
function ItemsCard({ order, onUpdated }: { order: OrderDetail; onUpdated: (order: OrderDetail) => void }) {
  const { t, taka } = useLang()
  const editable = BILL_EDITABLE.includes(order.status) && (order.service === 'bazar' || order.service === 'medicine')
  const original = Object.fromEntries(order.items.map(item => [item.id, item.price === null ? '' : String(item.price)]))
  const [prices, setPrices] = useState<Record<string, string>>(original)
  const [note, setNote] = useState('')
  const [error, setError] = useState<MessageCode | null>(null)
  // Reset when the order changes (e.g. saved, or updated elsewhere).
  useEffect(() => setPrices(original), [order])
  const changed = order.items.filter(item => prices[item.id] !== original[item.id])
  const previewTotal = order.items.reduce((sum, item) => sum + toAmount(prices[item.id]), 0) + order.serviceFee + order.deliveryFee

  const save = useMutation({
    mutationFn: () => {
      const body = { items: changed.map(item => ({ id: item.id, price: toAmount(prices[item.id]) })), note: note.trim() || undefined }
      const check = validateForm(updateOrderItemsSchema, body, [])
      if (!check.success) throw check.code
      return api.orders.updateItems(order.id, check.data)
    },
    onSuccess: updated => {
      onUpdated(updated)
      setNote('')
      toast.success(t('বিল আপডেট হয়েছে', 'Bill updated'), { description: t('গ্রাহককে নতুন মোট জানানো হয়েছে।', 'The customer has been told the new total.') })
    },
    onError: failure => setError(errorCode(failure)),
  })

  return (
    <Card
      title={t('পণ্যের তালিকা', 'Items')}
      actions={
        editable && changed.length > 0 ? (
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
            <Save className="size-4" />
            {t(`সেভ করুন · নতুন মোট ${taka(previewTotal)}`, `Save · new total ${taka(previewTotal)}`)}
          </Button>
        ) : null
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>{t('নাম', 'Name')}</Th>
            <Th>{t('পরিমাণ', 'Quantity')}</Th>
            <Th>{order.service === 'medicine' ? t('কোম্পানী · ক্যাটাগরি', 'Company · category') : t('জাত বা ধরণ', 'Variety')}</Th>
            <Th className="w-36 text-right">{t('দাম', 'Price')}</Th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item.id}>
              <Td className="text-muted">{index + 1}</Td>
              <Td className="font-medium">{item.name}</Td>
              <Td>{item.quantity}</Td>
              <Td className="text-muted">{[item.variety, item.company, item.category].filter(Boolean).join(' · ') || '—'}</Td>
              <Td className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    aria-label={`${t('দাম', 'Price')}: ${item.name}`}
                    className="ml-auto h-8 w-28 text-right tabular-nums"
                    value={prices[item.id] ?? ''}
                    onChange={e => {
                      setPrices({ ...prices, [item.id]: e.target.value })
                      setError(null)
                    }}
                  />
                ) : (
                  <span className="tabular-nums">{item.price === null ? '—' : taka(item.price)}</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editable && changed.length > 0 && (
        <Field label={t('কারণ (ঐচ্ছিক, ইতিহাসে থাকবে)', 'Reason (optional, kept in the history)')} className="mt-3">
          <Input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('যেমন: বাজারে দাম বেশি ছিল', 'e.g. Market price was higher today')} />
        </Field>
      )}
      <div className="mt-3">
        <ErrorNote code={error} />
      </div>
    </Card>
  )
}
