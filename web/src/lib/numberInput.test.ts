import { describe, it, expect } from 'vitest'
import { parseNumberInput } from './numberInput'

describe('parseNumberInput', () => {
  it('turns an empty field into null (not 0), so "unset" survives a save', () => {
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('   ')).toBeNull()
  })

  it('keeps 0 and other numbers', () => {
    expect(parseNumberInput('0')).toBe(0)
    expect(parseNumberInput('700')).toBe(700)
    expect(parseNumberInput('-2.5')).toBe(-2.5)
  })

  it('turns text the browser lets through into null', () => {
    expect(parseNumberInput('e')).toBeNull()
  })
})
