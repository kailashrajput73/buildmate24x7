import { QuotationView } from '@/ui/screens'
export const metadata = { title: 'Quotation', robots: { index: false } }
export default function Page({ params }: { params: { id: string } }) { return <QuotationView id={Number(params.id)} /> }
