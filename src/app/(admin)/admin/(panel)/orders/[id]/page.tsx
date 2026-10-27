'use client'

import {
  adminNextStatuses,
  directionsLink,
  FORM_ERROR_PRIORITY,
  type GeoPoint,
  isAwaitingPrice,
  can,
  isQuotedService,
  mapLink,
  type MessageCode,
  ORDER_STATUS_LABELS,
  type OrderDetail,
  type OrderStatus,
  QUOTE_EDITABLE,
  quoteOrderSchema,
  SERVICE_LABELS,
  shiftingQuoteSchema,
  toAmount,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, FileText, MapPin, Phone, Plus, Route, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AuditFeed } from '@/admin/components/audit-feed'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, StatusBadge, Table, Td, Textarea, Th } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { PermissionGate } from '@/admin/components/permission-gate'
import { queryKeys, useCatalog, useCurrentAdmin, useOrder, useOrderHistory } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLang()
  return (
    <PermissionGate permission="orders.view" title={t('অর্ডার', 'Order')}>
      <Order params={params} />
    </PermissionGate>
  )
}

function Order({ params }: { params: Promise<{ id: string }> }) {
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

/** Opens an address's pin in Google Maps (on a rider's phone, the Maps app with directions). */
function MapLink({ pin }: { pin: GeoPoint | null }) {
  const { t } = useLang()
  if (!pin) return null
  return (
    <a href={mapLink(pin)} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline">
      <MapPin className="size-3.5" />
      {t('ম্যাপে দেখুন', 'Open in map')}
    </a>
  )
}

function OrderView({ order }: { order: OrderDetail }) {
  const { t, text, taka, formatDate } = useLang()
  const admin = useCurrentAdmin()
  // Pricing and status changes are separate permissions; without them the cards are read-only or hidden.
  const canPrice = can(admin, 'orders.send_price')
  const queryClient = useQueryClient()
  const onUpdated = (updated: OrderDetail) => {
    queryClient.setQueryData(queryKeys.order(order.id), updated)
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }
  // What itemsTotal is: shifting's vehicle rent, or the goods' prices.
  const goodsLabel = order.service === 'shifting' ? t('গাড়ী ভাড়া', 'Vehicle rent') : t('পণ্যের দাম', 'Items')

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
                  <dd className="font-medium">
                    {order.address}
                    <MapLink pin={order.addressPin} />
                  </dd>
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
                    <MapLink pin={order.shifting.loadingPin} />
                  </dd>
                  <dt className="text-muted">Unloading Area</dt>
                  <dd className="font-medium">
                    {order.shifting.unloadingArea} · {t('ফ্লোর', 'floor')} {order.shifting.unloadingFloor}
                    <MapLink pin={order.shifting.unloadingPin} />
                  </dd>
                  <dt className="text-muted">{t('গাড়ী', 'Vehicle')}</dt>
                  <dd className="font-medium">
                    {text(order.shifting.vehicleName)} ·{' '}
                    {order.shifting.vehicleRate === null ? <span className="text-warning-ink">{t('ভাড়া এখনো দেওয়া হয়নি', 'Rent not priced yet')}</span> : taka(order.shifting.vehicleRate)}
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
                  <dd className="font-medium">
                    {order.parcel.pickupAddress}
                    <MapLink pin={order.parcel.pickupPin} />
                  </dd>
                  <dt className="text-muted">{t('পৌঁছানো', 'Drop-off')}</dt>
                  <dd className="font-medium">
                    {order.parcel.dropoffAddress}
                    <MapLink pin={order.parcel.dropoffPin} />
                  </dd>
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

          {order.shifting
            ? canPrice && QUOTE_EDITABLE.includes(order.status) && <VehicleQuoteCard order={order} onUpdated={onUpdated} />
            : (order.items.length > 0 || (canPrice && isQuotedService(order.service) && QUOTE_EDITABLE.includes(order.status))) && (
                <ItemsCard order={order} onUpdated={onUpdated} canPrice={canPrice} />
              )}

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
                {can(admin, 'customers.view') ? (
                  <Link href={`/admin/customers/${order.customer.id}`} className="font-semibold text-brand-700 hover:underline">
                    {order.customer.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{order.customer.name}</span>
                )}
                <a href={`tel:${order.customer.mobile}`} className="text-muted tabular-nums hover:underline">
                  {order.customer.mobile}
                </a>
              </div>
            )}
          </Card>
          {can(admin, 'orders.update_status') && <StatusCard order={order} onUpdated={onUpdated} />}
          <Card title={t('বিল', 'Bill')}>
            <dl className="grid gap-1.5 text-sm">
              {isAwaitingPrice(order.service, order.status) ? (
                <BillRow label={goodsLabel} value={t('এখনো দেওয়া হয়নি', 'Not priced yet')} />
              ) : (
                order.itemsTotal > 0 && <BillRow label={goodsLabel} value={taka(order.itemsTotal)} />
              )}
              {order.serviceFee > 0 && <BillRow label={order.service === 'shifting' ? t('লেবার ও ফ্লোর', 'Labour and floors') : t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee')} value={taka(order.serviceFee)} />}
              {order.deliveryFee > 0 && <BillRow label={t('ডেলিভারী খরচ', 'Delivery charge')} value={taka(order.deliveryFee)} />}
              <div className="mt-1 flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
                <dt>{t('মোট', 'Total')}</dt>
                <dd className="tabular-nums">
                  {isAwaitingPrice(order.service, order.status)
                    ? `${taka(order.total)} + ${order.service === 'shifting' ? t('গাড়ী ভাড়া', 'vehicle rent') : t('পণ্যের দাম', 'items')}`
                    : taka(order.total)}
                </dd>
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
  const next = adminNextStatuses(order.service, order.status)
  // Bazar and medicine: staff price the order in the Items card, shifting in the Vehicle rent card; booking is the customer's confirm.
  const hint =
    isQuotedService(order.service) && order.status === 'PENDING'
      ? order.service === 'shifting'
        ? t('দূরত্ব দেখে গাড়ী ভাড়া পাঠান; গ্রাহক কনফার্ম করলে অর্ডার বুক হবে।', 'Send the vehicle rent for the distance; the order is booked when the customer confirms.')
        : t('পণ্যের তালিকায় দাম দিয়ে পাঠান; গ্রাহক কনফার্ম করলে অর্ডার বুক হবে।', 'Price the items and send them; the order is booked when the customer confirms.')
      : order.status === 'QUOTED'
        ? t('গ্রাহকের কনফার্মের অপেক্ষায়। দাম বদলাতে হলে নতুন দাম পাঠান।', 'Waiting for the customer to confirm. To change the price, send a new one.')
        : null
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
          {hint && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-muted">{hint}</p>}
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

/** A line in the quote editor: one of the customer's lines (`id`) or one staff added. */
type QuoteLine = { key: string; id?: string; name: string; quantity: string; detail: string; price: string }

const linesOf = (order: OrderDetail): QuoteLine[] =>
  order.items.map(item => ({
    key: item.id,
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    detail: [item.variety, item.company, item.category].filter(Boolean).join(' · '),
    price: item.price === null ? '' : String(item.price),
  }))

const feesOf = (order: OrderDetail) => ({ serviceFee: String(order.serviceFee), deliveryFee: String(order.deliveryFee) })
/** A blank fee is sent as null, so the form reports quote.fees instead of quietly keeping the old one. */
const feeValue = (value: string) => (value.trim() ? toAmount(value) : null)

/**
 * The order's lines. For bazar and medicine, until the customer confirms, this is the quote:
 * staff price every line, drop what isn't available, add lines (a prescription's medicines),
 * adjust the shopping fee and delivery charge if needed, and send it; the customer then confirms
 * or cancels. Once confirmed it is read-only.
 */
function ItemsCard({ order, onUpdated, canPrice }: { order: OrderDetail; onUpdated: (order: OrderDetail) => void; canPrice: boolean }) {
  const { t, taka } = useLang()
  const editable = canPrice && isQuotedService(order.service) && QUOTE_EDITABLE.includes(order.status)
  const requoting = order.status === 'QUOTED'
  const hasShoppingFee = order.service === 'bazar'
  const [lines, setLines] = useState<QuoteLine[]>(() => linesOf(order))
  const [fees, setFees] = useState(() => feesOf(order))
  const [added, setAdded] = useState({ name: '', quantity: '', price: '' })
  const [note, setNote] = useState('')
  const [error, setError] = useState<MessageCode | null>(null)
  // Start again from the saved lines and fees whenever the order changes (sent, or updated elsewhere).
  useEffect(() => {
    setLines(linesOf(order))
    setFees(feesOf(order))
  }, [order])
  const total = lines.reduce((sum, line) => sum + toAmount(line.price), 0) + (hasShoppingFee ? toAmount(fees.serviceFee) : 0) + toAmount(fees.deliveryFee)
  const editFee = (field: 'serviceFee' | 'deliveryFee', value: string) => {
    setFees(current => ({ ...current, [field]: value }))
    setError(null)
  }

  const edit = (key: string, price: string) => {
    setLines(current => current.map(line => (line.key === key ? { ...line, price } : line)))
    setError(null)
  }
  const addLine = () => {
    if (!added.name.trim() || !added.quantity.trim() || !added.price.trim()) return setError('quote.items')
    setLines(current => [...current, { key: `new-${Date.now()}`, name: added.name.trim(), quantity: added.quantity.trim(), detail: '', price: added.price }])
    setAdded({ name: '', quantity: '', price: '' })
    setError(null)
  }

  const send = useMutation({
    mutationFn: () => {
      const body = {
        items: lines.map(line => ({ ...(line.id ? { id: line.id } : {}), name: line.name, quantity: line.quantity, price: line.price.trim() ? toAmount(line.price) : undefined })),
        ...(hasShoppingFee ? { serviceFee: feeValue(fees.serviceFee) } : {}),
        deliveryFee: feeValue(fees.deliveryFee),
        note: note.trim() || undefined,
      }
      const check = validateForm(quoteOrderSchema, body, FORM_ERROR_PRIORITY.quote)
      if (!check.success) throw check.code
      return api.orders.quote(order.id, check.data)
    },
    onSuccess: updated => {
      onUpdated(updated)
      setNote('')
      toast.success(requoting ? t('নতুন দাম পাঠানো হয়েছে', 'New price sent') : t('দাম পাঠানো হয়েছে', 'Price sent'), {
        description: t(`মোট ${taka(updated.total)}। গ্রাহক কনফার্ম বা বাতিল করবেন।`, `Total ${taka(updated.total)}. The customer will confirm or cancel.`),
      })
    },
    onError: failure => setError(errorCode(failure, FORM_ERROR_PRIORITY.quote)),
  })

  const confirmed = isQuotedService(order.service) && !editable && order.status !== 'CANCELLED'
  return (
    <Card title={t('পণ্যের তালিকা', 'Items')} actions={confirmed ? <Badge tone="brand">{t('কনফার্ম করা দাম', 'Confirmed price')}</Badge> : null}>
      {editable && (
        <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-sm text-muted">
          {requoting
            ? t('দাম পাঠানো হয়েছে; গ্রাহকের কনফার্মের অপেক্ষায়। দাম বদলালে নতুন দাম পাঠান।', 'Price sent; waiting for the customer. If a price changes, send a new one.')
            : t('প্রতিটি লাইনের দাম দিন। পাওয়া না গেলে লাইন বাদ দিন, দরকার হলে নতুন লাইন যোগ করুন।', 'Price every line. Remove what is not available and add lines if needed.')}{' '}
          {t('দূরত্ব বা পরিমাণের জন্য চার্জ বদলালে গ্রাহক নোটিফিকেশনে আগের ও নতুন অঙ্ক দেখবেন।', 'If you change a charge (distance, a big order), the customer sees the old and new amount in the notification.')}
        </p>
      )}
      {lines.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>{t('নাম', 'Name')}</Th>
              <Th>{t('পরিমাণ', 'Quantity')}</Th>
              <Th>{order.service === 'medicine' ? t('কোম্পানী · ক্যাটাগরি', 'Company · category') : t('জাত বা ধরণ', 'Variety')}</Th>
              <Th className="w-36 text-right">{t('দাম', 'Price')}</Th>
              {editable && <Th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.key}>
                <Td className="text-muted">{index + 1}</Td>
                <Td className="font-medium">
                  {line.name}
                  {!line.id && <span className="ml-1.5 text-xs font-normal text-success-ink">{t('নতুন', 'new')}</span>}
                </Td>
                <Td>{line.quantity}</Td>
                <Td className="text-muted">{line.detail || '—'}</Td>
                <Td className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      aria-label={`${t('দাম', 'Price')}: ${line.name}`}
                      className="ml-auto h-8 w-28 text-right tabular-nums"
                      value={line.price}
                      onChange={e => edit(line.key, e.target.value)}
                    />
                  ) : (
                    <span className="tabular-nums">{line.price === '' ? '—' : taka(toAmount(line.price))}</span>
                  )}
                </Td>
                {editable && (
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${t('বাদ দিন', 'Remove')}: ${line.name}`}
                      onClick={() => setLines(current => current.filter(other => other.key !== line.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t('কোনো লাইন নেই। প্রেসক্রিপশন দেখে লাইন যোগ করুন।', 'No lines. Add them from the prescription.')}</Empty>
      )}

      {editable && (
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <Field label={t('নতুন লাইন: নাম', 'New line: name')}>
              <Input value={added.name} maxLength={120} onChange={e => setAdded({ ...added, name: e.target.value })} placeholder={order.service === 'medicine' ? 'Napa' : t('আলু', 'Potatoes')} />
            </Field>
            <Field label={t('পরিমাণ', 'Quantity')}>
              <Input value={added.quantity} maxLength={40} onChange={e => setAdded({ ...added, quantity: e.target.value })} placeholder={t('১ কেজি', '1 kg')} />
            </Field>
            <Field label={t('দাম', 'Price')}>
              <Input type="number" min={0} step={1} inputMode="numeric" value={added.price} onChange={e => setAdded({ ...added, price: e.target.value })} />
            </Field>
            <Button variant="secondary" onClick={addLine}>
              <Plus className="size-4" />
              {t('যোগ করুন', 'Add')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-canvas/60 p-3 sm:grid-cols-2">
            <p className="text-sm font-semibold text-navy sm:col-span-2">{t('চার্জ', 'Charges')}</p>
            {hasShoppingFee && (
              <FeeInput label={t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee')} value={fees.serviceFee} was={order.serviceFee} onChange={value => editFee('serviceFee', value)} />
            )}
            <FeeInput
              label={order.service === 'medicine' ? t('ডেলিভারী চার্জ', 'Delivery charge') : t('ডেলিভারী খরচ', 'Delivery charge')}
              value={fees.deliveryFee}
              was={order.deliveryFee}
              onChange={value => editFee('deliveryFee', value)}
            />
          </div>
          <Field label={t('গ্রাহকের জন্য নোট (ঐচ্ছিক)', 'Note for the customer (optional)')}>
            <Input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('যেমন: দেশি আলু পাওয়া যায়নি, ডায়মন্ড দেওয়া হলো', 'e.g. No local potatoes today, priced Diamond instead')} />
          </Field>
          <ErrorNote code={error} />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm text-muted">
              {t('চার্জসহ মোট', 'Total with charges')} <strong className="text-ink tabular-nums">{taka(total)}</strong>
            </span>
            <Button loading={send.isPending} onClick={() => send.mutate()}>
              <Send className="size-4" />
              {requoting ? t('নতুন দাম পাঠান', 'Send new price') : t('দাম পাঠান', 'Send price')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * A shifting order's price, until the customer confirms: staff check the road distance between the
 * two pins and send the vehicle rent, starting from the vehicle's Catalog rate. Labour and floors
 * stay at the rates the order was placed with. The customer then confirms or cancels.
 */
function VehicleQuoteCard({ order, onUpdated }: { order: OrderDetail; onUpdated: (order: OrderDetail) => void }) {
  const { t, text, taka } = useLang()
  const catalog = useCatalog()
  const shifting = order.shifting!
  const requoting = order.status === 'QUOTED'
  const startRate = catalog.data?.vehicles.find(vehicle => vehicle.id === shifting.vehicleId)?.rate ?? null
  const saved = shifting.vehicleRate ?? startRate
  const [rent, setRent] = useState(saved === null ? '' : String(saved))
  const [note, setNote] = useState('')
  const [error, setError] = useState<MessageCode | null>(null)
  // Start again from the sent rent (or the Catalog rate) whenever the order changes or the Catalog loads.
  useEffect(() => setRent(saved === null ? '' : String(saved)), [order, saved])
  const total = toAmount(rent) + order.serviceFee + order.deliveryFee
  const route = shifting.loadingPin && shifting.unloadingPin ? directionsLink(shifting.loadingPin, shifting.unloadingPin) : null

  const send = useMutation({
    mutationFn: () => {
      const body = { vehicleRate: rent.trim() ? toAmount(rent) : undefined, note: note.trim() || undefined }
      const check = validateForm(shiftingQuoteSchema, body, FORM_ERROR_PRIORITY.shiftingQuote)
      if (!check.success) throw check.code
      return api.orders.quoteShifting(order.id, check.data)
    },
    onSuccess: updated => {
      onUpdated(updated)
      setNote('')
      toast.success(requoting ? t('নতুন ভাড়া পাঠানো হয়েছে', 'New rent sent') : t('গাড়ী ভাড়া পাঠানো হয়েছে', 'Vehicle rent sent'), {
        description: t(`মোট ${taka(updated.total)}। গ্রাহক কনফার্ম বা বাতিল করবেন।`, `Total ${taka(updated.total)}. The customer will confirm or cancel.`),
      })
    },
    onError: failure => setError(errorCode(failure, FORM_ERROR_PRIORITY.shiftingQuote)),
  })

  return (
    <Card
      title={t('গাড়ী ভাড়া', 'Vehicle rent')}
      actions={
        route && (
          <a href={route} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <Route className="size-4" />
            {t('দূরত্ব দেখুন', 'See the distance')}
          </a>
        )
      }
    >
      <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-sm text-muted">
        {requoting
          ? t('ভাড়া পাঠানো হয়েছে; গ্রাহকের কনফার্মের অপেক্ষায়। বদলাতে হলে নতুন ভাড়া পাঠান।', 'Rent sent; waiting for the customer. To change it, send a new one.')
          : t('Loading থেকে Unloading Area-র দূরত্ব দেখে গাড়ী ভাড়া দিন। লেবার ও ফ্লোরের খরচ অর্ডারের সময়ের রেটেই থাকবে।', 'Check the distance from the loading to the unloading area and set the vehicle rent. Labour and floors stay at the rates the order was placed with.')}
      </p>
      <div className="grid gap-3">
        <dl className="grid gap-1.5 text-sm">
          <BillRow label={t('গাড়ী', 'Vehicle')} value={text(shifting.vehicleName)} />
          <BillRow label={t('লেবার ও ফ্লোর', 'Labour and floors')} value={taka(order.serviceFee)} />
        </dl>
        <Field label={t('গাড়ী ভাড়া (টাকা)', 'Vehicle rent (taka)')} hint={startRate === null ? undefined : t(`শুরুর রেট ${taka(startRate)}`, `Starting rate ${taka(startRate)}`)}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="h-9 w-36 text-right tabular-nums"
              value={rent}
              onChange={e => {
                setRent(e.target.value)
                setError(null)
              }}
            />
            {requoting && shifting.vehicleRate !== null && rent.trim() !== '' && toAmount(rent) !== shifting.vehicleRate && (
              <span className="text-xs text-warning-ink">
                {t('আগে', 'was')} <span className="tabular-nums line-through">{taka(shifting.vehicleRate)}</span>
              </span>
            )}
          </div>
        </Field>
        <Field label={t('গ্রাহকের জন্য নোট (ঐচ্ছিক)', 'Note for the customer (optional)')}>
          <Input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('যেমন: মিরপুর থেকে উত্তরা ১৪ কিমি', 'e.g. Mirpur to Uttara is 14 km')} />
        </Field>
        <ErrorNote code={error} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-muted">
            {t('চার্জসহ মোট', 'Total with charges')} <strong className="text-ink tabular-nums">{taka(total)}</strong>
          </span>
          <Button loading={send.isPending} onClick={() => send.mutate()}>
            <Send className="size-4" />
            {requoting ? t('নতুন ভাড়া পাঠান', 'Send new rent') : t('ভাড়া পাঠান', 'Send rent')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

/** One charge in the quote, with the amount it had before when staff changed it. */
function FeeInput({ label, value, was, onChange }: { label: string; value: string; was: number; onChange: (value: string) => void }) {
  const { t, taka } = useLang()
  const changed = value.trim() !== '' && toAmount(value) !== was
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} step={1} inputMode="numeric" className="h-9 w-32 text-right tabular-nums" value={value} onChange={e => onChange(e.target.value)} />
        {changed && (
          <span className="text-xs text-warning-ink">
            {t('আগে', 'was')} <span className="tabular-nums line-through">{taka(was)}</span>
          </span>
        )}
      </div>
    </Field>
  )
}
