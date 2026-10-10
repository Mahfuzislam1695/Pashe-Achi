'use client'

import { calcMedicine, createMedicineOrderSchema, FORM_ERROR_PRIORITY, type MessageCode, type ScheduleInput, toAmount, validateForm } from '@/shared'
import { useMutation } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useState } from 'react'

import { DeliverySchedule, EMPTY_SCHEDULE } from '@/customer/components/delivery-schedule'
import { type Column, isRowStarted, LineTable, type Row } from '@/customer/components/line-table'
import { BillSummary, ConfirmButton, CustomerInfo, Field, FormError, ServiceCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useDraft } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, usePlaceOrder, useSession } from '@/customer/lib/queries'

type MedicineDraft = {
  address: string
  mobile: string
  schedule: ScheduleInput
  prescription: { id: string; name: string } | null
  rows: Row[]
}
const PRIORITY = FORM_ERROR_PRIORITY.medicine
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function MedicineScreen() {
  const { t } = useLang()
  const { user, catalog } = useSession()
  const [draft, setDraft] = useDraft<MedicineDraft>('medicine', () => ({ address: '', mobile: user.mobile, schedule: EMPTY_SCHEDULE, prescription: null, rows: [{}] }))
  const [showError, setShowError] = useState(false)
  const [uploadError, setUploadError] = useState<MessageCode | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const placeOrder = usePlaceOrder(api.orders.createMedicine)
  // The prescription is uploaded as soon as it is picked; the order then refers to it by id.
  const upload = useMutation({
    mutationFn: api.uploads.prescription,
    onSuccess: file => update({ prescription: { id: file.id, name: file.originalName } }),
    onError: error => setUploadError(errorCode(error)),
  })

  function update(patch: Partial<MedicineDraft>) {
    setDraft(current => ({ ...current, ...patch }))
    if (placeOrder.isError) placeOrder.reset()
  }

  const pickFile = (file: File | undefined) => {
    setUploadError(null)
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError('upload.size')
    upload.mutate(file)
  }

  const columns: Column[] = [
    { key: 'name', label: t('ঔষুধের নাম লিখুন', 'Medicine name'), placeholder: 'Napa' },
    { key: 'quantity', label: t('পরিমাণ', 'Quantity'), placeholder: t('1 পাতা', '1 strip') },
    { key: 'company', label: t('কোম্পানীর নাম', 'Company'), placeholder: 'Beximco' },
    { key: 'category', label: t('ক্যাটাগরি', 'Category'), placeholder: t('জ্বর', 'Fever') },
    { key: 'price', label: t('মূল্য', 'Price'), placeholder: '৳', numeric: true },
  ]
  const bill = calcMedicine(catalog.pricing, draft.rows.map(row => row.price))
  const check = validateForm(
    createMedicineOrderSchema,
    {
      address: draft.address,
      contactMobile: draft.mobile,
      schedule: draft.schedule,
      prescriptionUploadId: draft.prescription?.id,
      items: draft.rows.filter(isRowStarted).map(row => ({
        name: row.name ?? '',
        quantity: row.quantity ?? '',
        company: row.company ?? '',
        category: row.category ?? '',
        price: row.price?.trim() ? toAmount(row.price) : undefined,
      })),
    },
    PRIORITY,
  )
  const error = placeOrder.isError ? errorCode(placeOrder.error, PRIORITY) : showError && !check.success ? check.code : null

  const confirm = () => {
    if (upload.isPending) return
    if (!check.success) return setShowError(true)
    placeOrder.mutate(check.data, {
      onSuccess: () => {
        setDraft(current => ({ ...current, address: '', schedule: EMPTY_SCHEDULE, prescription: null, rows: [{}] }))
        setFileInputKey(key => key + 1)
        setShowError(false)
      },
    })
  }

  return (
    <ServiceCard
      id="medicine"
      summary={
        <>
          <BillSummary
            lines={[
              [t('ঔষুধ মূল্য', 'Medicine cost'), bill.itemsTotal],
              [t('ডেলিভারী চার্জ', 'Delivery charge'), bill.deliveryFee],
            ]}
            totalLabel="Total"
            total={bill.total}
          />
          <ConfirmButton error={error} pending={placeOrder.isPending || upload.isPending} onConfirm={confirm} />
        </>
      }
    >
      <CustomerInfo user={user} />
      <div className="field-pair">
        <Field label={t('গ্রহীতার ঠিকানা', "Receiver's address")}>
          <input value={draft.address} onChange={e => update({ address: e.target.value })} placeholder={t('বাসা, রোড, এলাকা', 'House, road, area')} />
        </Field>
        <Field label={t('গ্রহীতার মোবা', "Receiver's mobile")}>
          <input type="tel" inputMode="tel" value={draft.mobile} onChange={e => update({ mobile: e.target.value })} placeholder="01XXXXXXXXX" />
        </Field>
      </div>
      <DeliverySchedule value={draft.schedule} onChange={schedule => update({ schedule })} />
      <div className="invoice-upload">
        <input key={fileInputKey} id="prescription" type="file" accept="image/*,.pdf" onChange={e => pickFile(e.target.files?.[0])} />
        <label htmlFor="prescription" aria-busy={upload.isPending}>
          <Upload size={17} />
          <span>
            <strong>{t('* প্রেসক্রিপশন এড করুন', '* Add prescription')}</strong>
            <small>{upload.isPending ? t('আপলোড হচ্ছে…', 'Uploading…') : draft.prescription?.name || t('ছবি বা PDF', 'Photo or PDF')}</small>
          </span>
        </label>
        {uploadError && (
          <div className="upload-error">
            <FormError code={uploadError} />
          </div>
        )}
      </div>
      <LineTable template="1.2fr .8fr 1fr .9fr .8fr" columns={columns} rows={draft.rows} onChange={rows => update({ rows })} addLabel={t('আরো এড করুন', 'Add more')} />
    </ServiceCard>
  )
}
