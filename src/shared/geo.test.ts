import { describe, expect, it } from 'vitest'

import { shortArea } from './geo'

describe('shortArea', () => {
  it('keeps the last two parts of the address', () => {
    expect(shortArea('বাসা ১২, রোড ৫, মিরপুর ১০, ঢাকা-১২১৬')).toBe('মিরপুর ১০, ঢাকা-১২১৬')
  })

  it('returns a short address as it is, without empty parts', () => {
    expect(shortArea('Dhaka')).toBe('Dhaka')
    expect(shortArea(' Gulshan , , Dhaka ')).toBe('Gulshan, Dhaka')
  })
})
