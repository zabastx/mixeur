import { describe, it, expect } from 'vitest'
import { bytesToSize } from './format'

describe('bytesToSize', () => {
	it('reports zero as "0 Bytes" and negative bytes as "n/a"', () => {
		expect(bytesToSize(0)).toBe('0 Bytes')
		expect(bytesToSize(-10000)).toBe('n/a')
	})

	it('returns bytes for values less than 1024', () => {
		expect(bytesToSize(512)).toBe('512 Bytes')
		expect(bytesToSize(1)).toBe('1 Bytes')
		expect(bytesToSize(1023)).toBe('1023 Bytes')
	})

	it('converts to KB correctly', () => {
		expect(bytesToSize(1024)).toBe('1.0 KB')
		expect(bytesToSize(1536)).toBe('1.5 KB')
		expect(bytesToSize(2048)).toBe('2.0 KB')
	})

	it('converts to MB correctly', () => {
		expect(bytesToSize(1024 * 1024)).toBe('1.0 MB')
		expect(bytesToSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
	})

	it('converts to GB correctly', () => {
		expect(bytesToSize(1024 ** 3)).toBe('1.0 GB')
		expect(bytesToSize(1024 ** 3 * 3.7)).toBe('3.7 GB')
	})

	it('handles large numbers beyond GB', () => {
		expect(bytesToSize(1024 ** 4)).toBe('1024.0 GB')
	})

	it('formats with exactly 1 decimal place for non-byte values', () => {
		expect(bytesToSize(1024 * 100)).toBe('100.0 KB')
		expect(bytesToSize(1024 * 100 + 512)).toBe('100.5 KB')
	})
})
