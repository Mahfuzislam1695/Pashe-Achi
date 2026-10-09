'use client'

import { type OrderSummary, SERVICE_LABELS } from '@/shared'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useLang } from '@/admin/lib/i18n'
import { StatusBadge, Table, Td, Th } from './ui'

/** Orders as a table; a row opens the order (also reachable by keyboard through the code link). */
export function OrderTable({ orders, showCustomer = true }: { orders: OrderSummary[]; showCustomer?: boolean }) {
  const { t, text, taka, formatDate } = useLang()
  const router = useRouter()
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('কোড', 'Code')}</Th>
          {showCustomer && <Th>{t('গ্রাহক', 'Customer')}</Th>}
          <Th>{t('সেবা', 'Service')}</Th>
          <Th>{t('বিবরণ', 'Details')}</Th>
          <Th>{t('ডেলিভারি', 'Delivery')}</Th>
          <Th className="text-right">{t('মোট', 'Total')}</Th>
          <Th>{t('অবস্থা', 'Status')}</Th>
        </tr>
      </thead>
      <tbody>
        {orders.map(order => (
          <tr key={order.id} className="cursor-pointer hover:bg-canvas" onClick={() => router.push(`/admin/orders/${order.id}`)}>
            <Td>
              <Link href={`/admin/orders/${order.id}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline" onClick={event => event.stopPropagation()}>
                {order.code}
              </Link>
              <div className="text-xs text-muted">{formatDate(order.createdAt, true)}</div>
            </Td>
            {showCustomer && (
              <Td>
                <div className="font-medium">{order.customer?.name}</div>
                <div className="text-xs text-muted tabular-nums">{order.customer?.mobile}</div>
              </Td>
            )}
            <Td>{text(SERVICE_LABELS[order.service])}</Td>
            <Td className="max-w-64">
              <span className="line-clamp-2">{order.summary}</span>
            </Td>
            <Td className="whitespace-nowrap">
              {formatDate(order.scheduledDate)}
              <div className="text-xs text-muted">{order.scheduledTime}</div>
            </Td>
            <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{taka(order.total)}</Td>
            <Td>
              <StatusBadge status={order.status} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
