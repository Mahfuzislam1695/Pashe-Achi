import { APP_NAME, APP_NAME_SUFFIX, splitBrand } from '@/shared'
import { Fragment } from 'react'

/**
 * Any visible text holding the name: every " BD24" in it is drawn at half the height of the text around it, on the
 * same baseline. The space stays in the span, so copying and screen readers get "Kingfisher BD24".
 */
export function BrandText({ text }: { text: string }) {
  return (
    <>
      {splitBrand(text).map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="ml-[0.1em] text-[0.5em] tracking-normal">{` ${APP_NAME_SUFFIX}`}</span>}
          {part}
        </Fragment>
      ))}
    </>
  )
}

/** The name as a wordmark (the panel shows it in English). */
export function AppName() {
  return <BrandText text={APP_NAME.en} />
}
